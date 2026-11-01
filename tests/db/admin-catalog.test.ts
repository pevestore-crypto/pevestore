/**
 * admin_save_product: guardado atómico de producto + rangos + variantes + recargos.
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
`;

const ADMIN = "11111111-1111-1111-1111-111111111111";
const STRANGER = "22222222-2222-2222-2222-222222222222";
const dir = join(__dirname, "..", "..", "supabase", "migrations");
let db: PGlite;

const as = (uid: string) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);

const base = {
  name: "Taza personalizada",
  slug: "taza-personalizada",
  categoryId: "",
  shortDescription: "Taza de cerámica 11 oz",
  description: "",
  basePriceCents: 35000,
  minQty: 1,
  maxQty: 500,
  productionDays: "",
  allowsOwnDesign: true,
  allowsGallery: true,
  allowsIdea: true,
  availability: "available",
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  seoTitle: "",
  seoDescription: "",
  tiers: [
    { minQty: 1, maxQty: 5, unitPriceCents: 35000 },
    { minQty: 6, maxQty: 11, unitPriceCents: 30000 },
    { minQty: 12, maxQty: null, unitPriceCents: 27500 },
  ],
  variants: [{ id: "", name: "Blanca", sku: "", priceDeltaCents: 0, isActive: true, sortOrder: 0 }],
  surcharges: [{ label: "Impresión a dos caras", amountCents: 5000, per: "unit", customizationMode: "", isActive: true }],
};

async function save(payload: unknown) {
  const { rows } = await db.query<{ id: string }>("select admin_save_product($1::jsonb) as id", [JSON.stringify(payload)]);
  return rows[0].id;
}
const countFor = async (table: string, pid: string) =>
  Number((await db.query<{ n: number }>(`select count(*)::int as n from ${table} where product_id = $1`, [pid])).rows[0].n);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(`
    insert into auth.users values ('${ADMIN}'), ('${STRANGER}');
    insert into admin_users (user_id, full_name, role) values ('${ADMIN}', 'Admin', 'owner');
  `);
});

describe("admin_save_product", () => {
  it("rechaza a quien no es administrador", async () => {
    await as(STRANGER);
    await expect(save(base)).rejects.toThrow(/No autorizado/);
    await as("");
    await expect(save(base)).rejects.toThrow(/No autorizado/);
  });

  it("crea producto con rangos, variantes y recargos", async () => {
    await as(ADMIN);
    const id = await save(base);
    expect(await countFor("price_tiers", id)).toBe(3);
    expect(await countFor("product_variants", id)).toBe(1);
    expect(await countFor("product_surcharges", id)).toBe(1);
  });

  it("al editar conserva el id de las variantes existentes y borra las quitadas", async () => {
    await as(ADMIN);
    const id = await save({ ...base, slug: "taza-2" });
    const [blanca] = (await db.query<{ id: string }>("select id from product_variants where product_id = $1", [id])).rows;

    await save({
      ...base,
      id,
      slug: "taza-2",
      basePriceCents: 36000,
      tiers: [{ minQty: 1, maxQty: null, unitPriceCents: 36000 }],
      variants: [
        { id: blanca.id, name: "Blanca brillante", sku: "TZ-B", priceDeltaCents: 0, isActive: true, sortOrder: 0 },
        { id: "", name: "Mágica", sku: "", priceDeltaCents: 10000, isActive: true, sortOrder: 1 },
      ],
      surcharges: [],
    });

    const variants = (await db.query<{ id: string; name: string }>("select id, name from product_variants where product_id = $1 order by sort_order", [id])).rows;
    expect(variants.map((v) => v.name)).toEqual(["Blanca brillante", "Mágica"]);
    expect(variants[0].id).toBe(blanca.id);
    expect(await countFor("price_tiers", id)).toBe(1);
    expect(await countFor("product_surcharges", id)).toBe(0);

    await save({
      ...base,
      id,
      slug: "taza-2",
      variants: [{ id: variants[1].id, name: "Mágica", sku: "", priceDeltaCents: 10000, isActive: true, sortOrder: 0 }],
    });
    expect(await countFor("product_variants", id)).toBe(1);
  });

  it("si algo falla no guarda nada a medias", async () => {
    await as(ADMIN);
    const id = await save({ ...base, slug: "taza-3" });
    // Rango inválido (máx < mín) en la segunda posición: toda la operación se revierte.
    await expect(
      save({ ...base, id, slug: "taza-3", name: "Nombre nuevo", tiers: [{ minQty: 1, maxQty: 5, unitPriceCents: 1 }, { minQty: 9, maxQty: 2, unitPriceCents: 1 }] }),
    ).rejects.toThrow();
    const { rows } = await db.query<{ name: string }>("select name from products where id = $1", [id]);
    expect(rows[0].name).toBe("Taza personalizada");
    expect(await countFor("price_tiers", id)).toBe(3);
  });

  it("slug repetido da error de unicidad", async () => {
    await as(ADMIN);
    await expect(save({ ...base, slug: "taza-personalizada" })).rejects.toThrow(/duplicate key|unique/i);
  });

  it("no permite tocar variantes de otro producto", async () => {
    await as(ADMIN);
    const a = await save({ ...base, slug: "prod-a" });
    const b = await save({ ...base, slug: "prod-b" });
    const [va] = (await db.query<{ id: string }>("select id from product_variants where product_id = $1", [a])).rows;
    await expect(save({ ...base, id: b, slug: "prod-b", variants: [{ ...base.variants[0], id: va.id }] })).rejects.toThrow(/Variante no encontrada/);
  });
});
