// Base local en PGlite con todas las migraciones del repo. Nada remoto.
//
// PGlite es Postgres de verdad compilado a WebAssembly: corre dentro de Node,
// sin Docker y sin instalar Postgres. No está en package.json a propósito —es
// solo para probar—; se instala aparte:
//
//   npm install --no-save @electric-sql/pglite@0.2.17
//   node scripts/base-local/base.mjs
//
// Lo que NO reemplaza: PostgREST, Supabase Auth, Storage y la cola real de
// correos. `auth.users`, `auth.uid()` y los roles son de mentira, lo justo
// para que las migraciones y el RLS corran igual que en Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SHIM = `
create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
create role postgres_admin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb, raw_app_meta_data jsonb default '{}'::jsonb, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(nullif(current_setting('request.jwt.claims', true), '')::json->>'sub', '')::uuid $$;
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true),''),'{}')::jsonb $$;
create function auth.role() returns text language sql stable as $$ select current_setting('request.jwt.claims', true)::json->>'role' $$;
create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid(), auth.jwt(), auth.role() to anon, authenticated, service_role;
`;

// Migraciones de datos puntuales: buscan filas reales que una base vacía no tiene.
const SALTAR = ["20261103210000_clase_pau_3_nov_no_dictada.sql", "20261111120000_recuperativa_pau_27_11.sql"];

export async function base({ hasta, extra = [] } = {}) {
  const db = new PGlite();
  await db.exec(SHIM);
  const dir = join(REPO, "supabase/migrations");
  const archivos = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()
    .filter((f) => !hasta || f <= hasta).filter((f) => !SALTAR.includes(f));
  for (const f of [...archivos.map((a) => join(dir, a)), ...extra]) {
    try { await db.exec(readFileSync(f, "utf8")); }
    catch (e) { throw new Error(`Falla ${f}: ${e.message}`); }
  }
  return db;
}

if (process.argv[1]?.endsWith("base.mjs")) {
  const t = Date.now();
  const db = await base();
  const r = await db.query("select count(*) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'");
  console.log("ok, funciones public:", r.rows[0].count, "en", Date.now() - t, "ms");
}
