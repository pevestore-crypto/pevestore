/**
 * create_order, submit_receipt y rate_limit_hit sobre Postgres real (PGlite).
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";

const STUB = `
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid);
  alter table storage.objects enable row level security;
  create role anon;
  create role authenticated;
  create role service_role;
`;

const dir = join(__dirname, "..", "..", "supabase", "migrations");
let db: PGlite;
let productId: string;

function payload(over: Record<string, unknown> = {}) {
  return {
    customerName: "Cliente Prueba",
    customerWhatsapp: "18095551234",
    requiredDate: "2026-12-18",
    notes: "",
    paymentPlan: "deposit_50",
    bankAccountId: null,
    bankSnapshot: { bank: "Banreservas" },
    totalCents: 330000,
    dueNowCents: 165000,
    balanceCents: 165000,
    termsVersion: 1,
    trackingTokenHash: `hash-${Math.random()}`,
    items: [
      {
        productId,
        variantId: "",
        productName: "Taza personalizada",
        variantName: "",
        quantity: 12,
        unitCents: 27500,
        totalCents: 330000,
        customizationMode: "own_design",
        ideaText: "",
        pricingSnapshot: { unitCents: 27500 },
      },
    ],
    ...over,
  };
}

const createOrder = async (p: unknown) =>
  (await db.query<{ id: string; code: string }>("select * from create_order($1::jsonb)", [JSON.stringify(p)])).rows[0];

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(`insert into terms_versions (version, body, is_current) values (1, 'Condiciones', true);`);
  productId = (await db.query<{ id: string }>("insert into products (slug, name, base_price_cents) values ('taza', 'Taza', 35000) returning id")).rows[0].id;
});

describe("create_order", () => {
  it("crea cliente, pedido y líneas con código PEV", async () => {
    const o = await createOrder(payload());
    expect(o.code).toMatch(/^PEV-\d{6}$/);
    const items = await db.query("select quantity, total_cents from order_items where order_id = $1", [o.id]);
    expect(items.rows).toEqual([{ quantity: 12, total_cents: 330000 }]);
    const order = await db.query<{ status: string; customer_name: string }>("select status, customer_name from orders where id = $1", [o.id]);
    expect(order.rows[0]).toEqual({ status: "pending_payment", customer_name: "Cliente Prueba" });
  });

  it("guarda el diseño de la galería elegido", async () => {
    const design = (await db.query<{ id: string }>("insert into designs (title, storage_path) values ('Navidad 1', 'designs/x.webp') returning id")).rows[0];
    const o = await createOrder(payload({ items: [{ ...payload().items[0], customizationMode: "gallery", designId: design.id }] }));
    const row = (await db.query<{ design_id: string }>("select design_id from order_items where order_id = $1", [o.id])).rows[0];
    expect(row.design_id).toBe(design.id);
  });

  it("reutiliza el cliente por WhatsApp y actualiza su nombre", async () => {
    await createOrder(payload({ customerName: "Nombre Nuevo" }));
    const c = await db.query<{ n: number; full_name: string }>("select count(*)::int n, max(full_name) full_name from customers where whatsapp = '18095551234'");
    expect(c.rows[0]).toEqual({ n: 1, full_name: "Nombre Nuevo" });
  });

  it("es atómico: una línea inválida no deja pedido a medias", async () => {
    const before = Number((await db.query<{ n: number }>("select count(*)::int n from orders")).rows[0].n);
    await expect(createOrder(payload({ items: [{ ...payload().items[0], quantity: 0 }] }))).rejects.toThrow();
    const after = Number((await db.query<{ n: number }>("select count(*)::int n from orders")).rows[0].n);
    expect(after).toBe(before);
  });

  it("rechaza totales que no cuadran", async () => {
    await expect(createOrder(payload({ balanceCents: 1 }))).rejects.toThrow();
  });
});

describe("submit_receipt", () => {
  it("registra comprobante, pago sin verificar y pasa a Pago por verificar", async () => {
    const o = await createOrder(payload());
    const file = { path: `orders/${o.id}/recibo.jpg`, mime: "image/jpeg", size: 1234, name: "recibo.jpg" };
    await db.query("select submit_receipt($1, $2::jsonb, $3)", [o.id, JSON.stringify(file), 165000]);
    const row = (await db.query<{ status: string; paid_verified_cents: number }>("select status, paid_verified_cents from orders where id = $1", [o.id])).rows[0];
    expect(row.status).toBe("payment_review");
    expect(Number(row.paid_verified_cents)).toBe(0);
    const pay = await db.query<{ status: string; declared_cents: number }>("select status, declared_cents from payments where order_id = $1", [o.id]);
    expect(pay.rows.map((r) => [r.status, Number(r.declared_cents)])).toEqual([["pending", 165000]]);
    // Un segundo comprobante (p. ej. el saldo) se acepta mientras esté por verificar.
    await db.query("select submit_receipt($1, $2::jsonb, $3)", [o.id, JSON.stringify({ ...file, path: `orders/${o.id}/recibo2.jpg` }), 165000]);
    expect(Number((await db.query<{ n: number }>("select count(*)::int n from payments where order_id = $1", [o.id])).rows[0].n)).toBe(2);
  });

  it("no acepta comprobantes en pedidos cancelados", async () => {
    const o = await createOrder(payload());
    await db.query("update orders set status = 'cancelled' where id = $1", [o.id]);
    const file = { path: `orders/${o.id}/x.jpg`, mime: "image/jpeg", size: 10, name: "" };
    await expect(db.query("select submit_receipt($1, $2::jsonb, $3)", [o.id, JSON.stringify(file), 1])).rejects.toThrow(/ya no admite/);
  });
});

describe("lookup_order", () => {
  it("exige número de pedido Y WhatsApp, y no expone datos personales", async () => {
    const o = await createOrder(payload({ customerWhatsapp: "18295557777" }));
    const number = Number(o.code.slice(4));
    const hit = await db.query<Record<string, unknown>>("select * from lookup_order($1, $2)", [number, "18295557777"]);
    expect(hit.rows).toHaveLength(1);
    expect(Object.keys(hit.rows[0]).sort()).toEqual(["code", "created_at", "estimated_date", "paid_verified_cents", "required_date", "status", "total_cents"]);
    expect((await db.query("select * from lookup_order($1, $2)", [number, "18095550000"])).rows).toHaveLength(0);
    expect((await db.query("select * from lookup_order($1, $2)", [number + 999, "18295557777"])).rows).toHaveLength(0);
  });
});

describe("rate_limit_hit", () => {
  it("permite hasta el límite dentro de la ventana", async () => {
    const results: boolean[] = [];
    for (let i = 0; i < 4; i++) {
      results.push((await db.query<{ ok: boolean }>("select rate_limit_hit('order:1.2.3.4', 3, 3600) as ok")).rows[0].ok);
    }
    expect(results).toEqual([true, true, true, false]);
    expect((await db.query<{ ok: boolean }>("select rate_limit_hit('order:5.6.7.8', 3, 3600) as ok")).rows[0].ok).toBe(true);
  });
});
