/**
 * Ejecuta la migración real sobre Postgres en memoria (PGlite) con un
 * esqueleto mínimo de los esquemas auth y storage de Supabase, y comprueba
 * las reglas que la base de datos debe imponer por sí misma.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { ORDER_STATUSES, canTransition } from "@/lib/domain/order-status";

const SUPABASE_STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets(id), name text, owner uuid);
  alter table storage.objects enable row level security;
  create role anon;
  create role authenticated;
`;

const migrationsDir = join(__dirname, "..", "..", "supabase", "migrations");
let db: PGlite;

async function newOrder(overrides: Record<string, unknown> = {}) {
  const values = {
    total_cents: 330000,
    due_now_cents: 165000,
    balance_cents: 165000,
    ...overrides,
  };
  const res = await db.query<{ id: string; code: string }>(
    `insert into orders (customer_id, customer_name, customer_whatsapp, required_date, payment_plan,
       total_cents, due_now_cents, balance_cents, terms_version, terms_accepted_at, tracking_token_hash)
     values ((select id from customers limit 1), 'Cliente de prueba', '18090000000', '2026-12-18', 'deposit_50',
       $1, $2, $3, 1, now(), md5(random()::text))
     returning id, code`,
    [values.total_cents, values.due_now_cents, values.balance_cents],
  );
  return res.rows[0];
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const file of readdirSync(migrationsDir).sort()) {
    await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
  }
  await db.exec(readFileSync(join(migrationsDir, "..", "seed.sql"), "utf8"));
  await db.exec(`
    insert into terms_versions (version, body, is_current) values (1, 'Condiciones de prueba', true);
    insert into customers (full_name, whatsapp) values ('Cliente de prueba', '18090000000');
  `);
});

describe("migración", () => {
  it("crea los buckets con los privados marcados como no públicos", async () => {
    const { rows } = await db.query<{ id: string; public: boolean }>("select id, public from storage.buckets order by id");
    expect(rows).toEqual([
      { id: "catalog", public: true },
      { id: "customer-files", public: false },
      { id: "receipts", public: false },
    ]);
  });

  it("todas las tablas públicas tienen RLS activado", async () => {
    const { rows } = await db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    );
    expect(rows).toEqual([]);
  });

  it("las transiciones SQL coinciden exactamente con las de la aplicación", async () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const { rows } = await db.query<{ ok: boolean }>("select order_transition_allowed($1, $2) as ok", [from, to]);
        expect(rows[0].ok, `${from} → ${to}`).toBe(canTransition(from, to));
      }
    }
  });
});

describe("pedidos", () => {
  it("genera el código PEV-000001 y registra el estado inicial", async () => {
    const order = await newOrder();
    expect(order.code).toMatch(/^PEV-\d{6}$/);
    const { rows } = await db.query("select from_status, to_status from order_status_history where order_id = $1", [order.id]);
    expect(rows).toEqual([{ from_status: null, to_status: "pending_payment" }]);
  });

  it("exige anticipo + saldo = total", async () => {
    await expect(newOrder({ total_cents: 330000, due_now_cents: 165000, balance_cents: 100000 })).rejects.toThrow();
  });

  it("bloquea saltos de estado no permitidos", async () => {
    const order = await newOrder();
    await expect(db.query("update orders set status = 'in_production' where id = $1", [order.id])).rejects.toThrow(/no permitido/);
  });

  it("no confirma sin pago verificado y sí con él", async () => {
    const order = await newOrder();
    await db.query("update orders set status = 'payment_review' where id = $1", [order.id]);
    await expect(db.query("update orders set status = 'confirmed' where id = $1", [order.id])).rejects.toThrow(/pago verificado/);

    // Pago declarado pero sin verificar: no cuenta como dinero recibido.
    const pay = await db.query<{ id: string }>(
      "insert into payments (order_id, declared_cents) values ($1, 165000) returning id",
      [order.id],
    );
    let paid = await db.query<{ paid_verified_cents: number }>("select paid_verified_cents from orders where id = $1", [order.id]);
    expect(Number(paid.rows[0].paid_verified_cents)).toBe(0);

    await db.query("update payments set status = 'verified', verified_cents = 165000, verified_at = now() where id = $1", [pay.rows[0].id]);
    paid = await db.query("select paid_verified_cents from orders where id = $1", [order.id]);
    expect(Number(paid.rows[0].paid_verified_cents)).toBe(165000);

    await db.query("update orders set status = 'confirmed' where id = $1", [order.id]);
    const { rows } = await db.query<{ confirmed_at: Date | null }>("select confirmed_at from orders where id = $1", [order.id]);
    expect(rows[0].confirmed_at).not.toBeNull();
    const history = await db.query<{ to_status: string }>("select to_status from order_status_history where order_id = $1 order by id", [order.id]);
    expect(history.rows.map((r) => r.to_status)).toEqual(["pending_payment", "payment_review", "confirmed"]);
  });
});

describe("catálogo y campañas", () => {
  it("los banners solo enlazan dentro del sitio (sin anuncios de terceros)", async () => {
    const insert = (href: string) =>
      db.query("insert into banners (title, cta_label, cta_href, image_desktop_path) values ('B', '¡Ver ofertas!', $1, 'x.webp')", [href]);
    await expect(insert("/ofertas")).resolves.toBeDefined();
    await expect(insert("https://anunciante.com")).rejects.toThrow();
    await expect(insert("//anunciante.com")).rejects.toThrow();
  });

  it("una promoción necesita fechas coherentes y un único objetivo", async () => {
    const cat = await db.query<{ id: string }>("insert into categories (slug, name) values ('tazas', 'Tazas personalizadas') returning id");
    const promo = (start: string, end: string) =>
      db.query(
        "insert into promotions (name, category_id, discount_kind, discount_bps, starts_at, ends_at) values ('P', $1, 'percent', 1500, $2, $3)",
        [cat.rows[0].id, start, end],
      );
    await expect(promo("2026-12-01T04:00:00Z", "2026-12-21T04:00:00Z")).resolves.toBeDefined();
    await expect(promo("2026-12-21T04:00:00Z", "2026-12-01T04:00:00Z")).rejects.toThrow();
  });

  it("rechaza slugs que no son URLs amigables", async () => {
    await expect(db.query("insert into categories (slug, name) values ('Tazas Rojas', 'x')")).rejects.toThrow();
  });
});
