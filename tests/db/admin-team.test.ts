/**
 * Equipo: siempre queda un dueño y cada usuario solo puede marcar su propio cambio de contraseña.
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
const OWNER = "11111111-1111-1111-1111-111111111111";
const STAFF = "22222222-2222-2222-2222-222222222222";
const dir = join(__dirname, "..", "..", "supabase", "migrations");
let db: PGlite;
const as = (uid: string) => db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid]);

beforeAll(async () => {
  db = new PGlite();
  await db.exec(STUB);
  for (const f of readdirSync(dir).sort()) await db.exec(readFileSync(join(dir, f), "utf8"));
  await db.exec(`
    insert into auth.users values ('${OWNER}'), ('${STAFF}');
    insert into admin_users (user_id, full_name, role) values ('${OWNER}', 'Dueño', 'owner');
    insert into admin_users (user_id, full_name, role, must_change_password) values ('${STAFF}', 'Personal', 'staff', true);
  `);
});

describe("equipo administrativo", () => {
  it("no permite quitar ni degradar al último dueño", async () => {
    await expect(db.query(`update admin_users set role = 'staff' where user_id = $1`, [OWNER])).rejects.toThrow(/al menos un dueño/);
    await expect(db.query(`delete from admin_users where user_id = $1`, [OWNER])).rejects.toThrow(/al menos un dueño/);
  });

  it("con dos dueños, uno sí puede pasar a personal", async () => {
    await db.query(`update admin_users set role = 'owner' where user_id = $1`, [STAFF]);
    await db.query(`update admin_users set role = 'staff' where user_id = $1`, [OWNER]);
    const roles = (await db.query<{ role: string }>("select role from admin_users order by full_name")).rows.map((r) => r.role);
    expect(roles.sort()).toEqual(["owner", "staff"]);
    await db.query(`update admin_users set role = 'owner' where user_id = $1`, [OWNER]);
    await db.query(`update admin_users set role = 'staff' where user_id = $1`, [STAFF]);
  });

  it("cada usuario solo limpia su propia marca de contraseña temporal", async () => {
    await db.query(`update admin_users set must_change_password = true`);
    await as(STAFF);
    await db.query("select admin_password_changed()");
    const rows = (await db.query<{ user_id: string; must_change_password: boolean }>("select user_id, must_change_password from admin_users")).rows;
    expect(rows.find((r) => r.user_id === STAFF)?.must_change_password).toBe(false);
    expect(rows.find((r) => r.user_id === OWNER)?.must_change_password).toBe(true);
  });
});
