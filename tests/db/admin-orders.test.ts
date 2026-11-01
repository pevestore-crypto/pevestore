/**
 * admin_set_order_status y admin_review_payment: permisos, autor, nota y reglas.
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
  create role anon; create role authenticated; create role service_role;
`;
const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
const dir = join(__dirname, "..", "..", "supabase", "migrations");
let db: PGlite;

const as = (uid: string) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);

async function newOrderWithReceipt() {
  await as("");
  const o = (
    await db.query<{ id: string }>(
      `select id from create_order($1::jsonb)`,
      [JSON.stringify({
        customerName: "Cliente", customerWhatsapp: "18095550100", requiredDate: "2026-12-18", notes: "",
        paymentPlan: "deposit_50", bankAccountId: null, bankSnapshot: {}, totalCents: 100000, dueNowCents: 50000,
        balanceCents: 50000, termsVersion: 1, trackingTokenHash: `h${Math.random()}`, items: [],
      })],
    )
  ).rows[0];
  await db.query("select submit_receipt($1, $2::jsonb, 50000)", [o.id, JSON.stringify({ path: `orders/${o.id}/${Math.random()}.jpg`, mime: "image/jpeg", size: 10, name: "" })]);
  const p = (await db.query<{ id: string }>("select id from payments where order_id = $1", [o.id])).rows[0];
  return { orderId: o.id, paymentId: p.id };
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(`
    insert into terms_versions (version, body, is_current) values (1, 'C', true);
    insert into auth.users values ('${ADMIN}'), ('${STRANGER}');
    insert into admin_users (user_id, full_name, role) values ('${ADMIN}', 'Admin', 'owner');
  `);
});

describe("panel de pedidos", () => {
  it("solo administradores operan", async () => {
    const { orderId, paymentId } = await newOrderWithReceipt();
    await as(STRANGER);
    await expect(db.query("select admin_set_order_status($1, 'cancelled', null)", [orderId])).rejects.toThrow(/No autorizado/);
    await expect(db.query("select admin_review_payment($1, 50000, null)", [paymentId])).rejects.toThrow(/No autorizado/);
  });

  it("no confirma antes de verificar el pago; verificar registra autor y suma lo recibido", async () => {
    const { orderId, paymentId } = await newOrderWithReceipt();
    await as(ADMIN);
    await expect(db.query("select admin_set_order_status($1, 'confirmed', null)", [orderId])).rejects.toThrow(/pago verificado/);

    await db.query("select admin_review_payment($1, 50000, 'Llegó completo')", [paymentId]);
    const pay = (await db.query<{ status: string; verified_by: string; note: string }>("select status, verified_by, note from payments where id = $1", [paymentId])).rows[0];
    expect(pay).toEqual({ status: "verified", verified_by: ADMIN, note: "Llegó completo" });
    expect(Number((await db.query<{ v: number }>("select paid_verified_cents v from orders where id = $1", [orderId])).rows[0].v)).toBe(50000);

    await db.query("select admin_set_order_status($1, 'confirmed', 'Pago recibido en Banreservas')", [orderId]);
    const last = (await db.query<{ to_status: string; changed_by: string; note: string }>(
      "select to_status, changed_by, note from order_status_history where order_id = $1 order by id desc limit 1",
      [orderId],
    )).rows[0];
    expect(last).toEqual({ to_status: "confirmed", changed_by: ADMIN, note: "Pago recibido en Banreservas" });
  });

  it("un pago solo se revisa una vez y el monto debe ser positivo", async () => {
    const { paymentId } = await newOrderWithReceipt();
    await as(ADMIN);
    await expect(db.query("select admin_review_payment($1, 0, null)", [paymentId])).rejects.toThrow(/mayor que cero/);
    await db.query("select admin_review_payment($1, null, 'No llegó')", [paymentId]);
    await expect(db.query("select admin_review_payment($1, 50000, null)", [paymentId])).rejects.toThrow(/ya fue revisado/);
    const st = (await db.query<{ status: string }>("select status from payments where id = $1", [paymentId])).rows[0].status;
    expect(st).toBe("rejected");
  });

  it("la nota no se filtra a cambios de estado posteriores sin nota", async () => {
    const { orderId } = await newOrderWithReceipt();
    await as(ADMIN);
    await db.query("select admin_set_order_status($1, 'pending_payment', 'Comprobante ilegible')", [orderId]);
    await db.query("select admin_set_order_status($1, 'cancelled', null)", [orderId]);
    const notes = (await db.query<{ note: string | null }>("select note from order_status_history where order_id = $1 order by id", [orderId])).rows.map((r) => r.note);
    expect(notes.slice(-2)).toEqual(["Comprobante ilegible", null]);
  });
});
