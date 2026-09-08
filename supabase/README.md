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

## El registro de migraciones ya está al día

> **No hace falta correr `migration repair`.** Esta sección decía lo contrario hasta el
> 08/09/2026 y podía llevar a que alguien lo corriera sin necesidad.

Las doce migraciones que existían al instalar la CLI se habían aplicado a mano, y la CLI lleva su
propio registro en `supabase_migrations.schema_migrations`, que estaba vacío. Sin avisarle, el
primer `db push` habría intentado reejecutarlas todas.

Eso **ya se resolvió**: al 08/09/2026 `npx supabase migration list` muestra las dieciséis
migraciones con `local` y `remote` alineados. El primer `db push` real ocurrió ese día, con las
tres de PRD-0010, y aplicó solo esas tres.

Si alguna vez `migration list` muestra una migración aplicada a mano sin su fila en `remote`, ahí
sí corresponde marcarla:

```bash
npx supabase migration repair --status applied 20260101000000
```

Es un comando que escribe en la base remota, así que necesita la aprobación de Felipe como
cualquier otro.

## ⚠️ Verificar contra qué base se está trabajando

Desde el 08/09/2026 hay **dos** proyectos, y la CLI apunta a uno solo a la vez:

| Proyecto | `project_ref` | Para qué |
|---|---|---|
| Producción | `wpjiwqeirdsspdfwwumv` | La base real. Cada `db push` necesita aprobación |
| Staging | `ybopuahlzbjkkwumkllk` | Pruebas. Se siembra y se borra sin cuidado |

`cat supabase/.temp/project-ref` dice a cuál está enlazada ahora mismo. **Mirarlo antes de
cualquier comando que escriba**, porque `db push` no pregunta a qué base le está escribiendo.

Las credenciales de staging viven en `.env.staging`, fuera del repo. El escenario de prueba se
siembra con `node scripts/sembrar-escenario.mjs` y se verifica con
`node scripts/verificar-metricas.mjs`; los dos se niegan a correr si el `project_ref` no es el de
staging.

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
