# Migraciones

Cómo se cambia el esquema de la base. Antes esto era copiar el `.sql` al SQL Editor a mano; desde
el 04/09/2026 va por la CLI de Supabase, instalada como dependencia del proyecto.

## La regla que manda

> **Nadie corre `supabase db push` sin que Felipe lo apruebe en ese mismo mensaje.**

Está en `CLAUDE.md` y no es burocracia: `db push` escribe en la base de producción, donde viven
los créditos que las alumnas pagaron. Escribir la migración es una cosa; decidir cuándo se aplica
es otra, y es de quien responde por la plata.

Una aprobación no se hereda del mensaje anterior. Lo mismo vale para `db reset`, `db pull`,
`migration repair` y cualquier SQL suelto contra producción.

## Preparar la máquina (una vez)

Hacen falta dos credenciales. **No van al repo**: van a `.env.local`, que está en `.gitignore`.

| Qué | Dónde se saca |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens → *Generate new token* |
| `SUPABASE_DB_PASSWORD` | Project Settings → Database → *Database password* (se puede resetear ahí) |

Después:

```bash
npx supabase link --project-ref wpjiwqeirdsspdfwwumv
```

El `project-ref` sale de `NEXT_PUBLIC_SUPABASE_URL`: es el subdominio.

## ⚠️ El primer `db push` necesita un paso previo

Las doce migraciones que existían al instalar la CLI **ya estaban aplicadas a mano**, y la base no
lo sabe: la CLI lleva su propio registro en `supabase_migrations.schema_migrations`, que está
vacío. Sin avisarle, el primer `db push` intentaría **re-ejecutarlas todas**.

La mayoría son idempotentes —`create table if not exists`, `drop policy if exists`,
`on conflict do nothing`— así que probablemente no romperían nada. Pero "probablemente" no es la
palabra que uno quiere sobre la tabla de créditos.

Antes del primer push hay que marcarlas como aplicadas:

```bash
npx supabase migration repair --status applied \
  20260801000000 20260821120000 20260825120000 20260828120000 \
  20260830120000 20260830130000 20260831120000 20260831130000 \
  20260902120000 20260903120000 20260903140000 20260904120000
```

Esas doce se verificaron una por una contra la base el 04/09/2026, buscando un artefacto propio de
cada una —una tabla, una columna, un `comment`— y las doce estaban aplicadas.

Después, `npx supabase migration list` debería mostrar local y remoto alineados.

## El día a día

```bash
npx supabase migration list      # qué falta aplicar
npx supabase db push --dry-run   # qué haría, sin hacerlo
npx supabase db push             # ← solo con aprobación explícita
```

`--dry-run` no escribe nada y sirve para revisar antes de pedir la aprobación.

## Convenciones

- El nombre es `YYYYMMDDHHMMSS_descripcion.sql`. La CLI ordena por ese timestamp, así que **no se
  renombra** una migración ya aplicada.
- Una migración aplicada **no se edita**. Si algo quedó mal, se escribe otra que lo corrija. Ya
  pasó dos veces en este proyecto y las dos veces la corrección fue un archivo nuevo.
- Idempotente siempre que se pueda: `if not exists`, `drop ... if exists` antes de crear,
  `on conflict do nothing`. No por la CLI, sino porque una migración que se puede repetir sin
  daño es una que se puede reaplicar cuando algo sale a medias.
- El archivo lleva arriba **qué problema resuelve**, no solo qué hace. Las migraciones de este
  repo se leen meses después para entender por qué el esquema es como es.
