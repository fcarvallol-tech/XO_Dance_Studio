# Base local para probar migraciones

Escrita la noche del 05/11/2026, cuando estaba prohibido tocar staging y en el computador no había
Docker ni Postgres.

```bash
npm install --no-save @electric-sql/pglite@0.2.17
node scripts/base-local/base.mjs                    # aplica todas las migraciones: "ok"
node scripts/base-local/escenario-<lo-que-sea>.mjs  # un escenario, con ✔ / ✘ por paso
```

- `base.mjs` crea una base vacía en memoria, con los roles `anon`, `authenticated` y
  `service_role`, un `auth.users` y un `auth.uid()` mínimos. Después aplica **en orden todas** las
  migraciones de `supabase/migrations/`. Tarda unos 3 segundos y no deja nada en disco.
- `util.mjs` trae dos formas de ejecutar:
  - `como(db, persona, fn)` corre **con la sesión de esa persona**: `set local role
    authenticated` más sus claims, igual que pide CLAUDE.md para preguntarle al RLS.
  - `servidor(db, fn)` corre como `service_role`.
- Se salta `20261103210000_clase_pau_3_nov_no_dictada.sql`, que busca una clase real que una base
  vacía no tiene.

**No reemplaza a staging.** No hay PostgREST, ni Auth, ni Storage, ni Resend. Sirve para probar
lo que hacen las funciones y las políticas. No sirve para probar el flujo de punta a punta: eso se
sigue probando en staging, desde la página.
