# PRD-0015 — Catálogo en base de datos

| Campo | Valor |
|---|---|
| **Estado** | **Implementado** (28/08/2026). Migración escrita, **sin aplicar** |
| **Autor** | Felipe Carvalho |
| **Fecha** | 28 de agosto de 2026 |
| **Hito** | Hito 1 — entregable 1.2 |
| **PRDs relacionados** | PRD-0003 (captación por profesora) · PRD-0004 (roles y RLS) · PRD-0006 (clases y horarios) · PRD-0009 (portal de administración) |

---

## 1. Problema

Los cinco cursos y las cinco profesoras viven en `lib/cursos.ts` y `lib/profesoras.ts`, en el
código. Cambiar una bio, activar un curso o corregir un horario **requiere que alguien edite
TypeScript, haga commit y despliegue**. Hoy ese alguien es Felipe, y es el único.

No es hipotético: la oferta ya cambió dos veces en agosto. XO Kids salió del catálogo, K-Pop pasó
a ser de 11 años para arriba, y llegaron tres bios reales. Cada uno de esos cambios fue un
commit. Vienen más —XO Mini, las bios de Carli y Maida, horarios, cupos— y Carla, que es quien
tiene el contenido, no puede tocar nada.

Además el catálogo es cimiento: PRD-0006 (clases y horarios) necesita apuntar a un curso que
exista como fila, no como constante. Mientras el catálogo esté en `/lib`, nada del ERP puede
referenciarlo con una llave foránea.

## 2. Usuario y contexto de uso

Dos usuarios distintos, y esta pasada solo atiende bien al segundo:

- **Carla, desde el Table Editor de Supabase**, cuando llega una bio o se define un horario. En
  esta pasada edita ahí, sin interfaz propia. Es incómodo pero es autoservicio, y es lo que
  desbloquea que no dependa de Felipe.
- **La visitante, desde el teléfono, llegando de Instagram.** Ella no sabe que esto cambió, y ese
  es exactamente el criterio de éxito: la landing tiene que seguir cargando igual de rápido.

## 3. Alcance

1. Tablas `profesoras`, `cursos` y `cursos_profesoras` en Supabase, con los datos actuales de
   `lib/cursos.ts` y `lib/profesoras.ts` como **carga inicial editable**, no como valores fijos.
2. Relación curso ↔ profesora **muchos a muchos**, en tabla propia.
3. RLS: **lectura pública de lo activo**, lectura completa para `admin` o superior, escritura solo
   `admin` o superior.
4. El sitio público lee de la base **sin dejar de ser estático**. Ver §5.
5. `app/profesoras/[slug]` deja de responder 404 a una profesora nueva. Ver §6.
6. `perfiles.profesora_id` pasa a **llave foránea real**, y la validación de slug de
   `POST /api/roles` se cae porque la reemplaza la base. Salda la deuda de `ARCHITECTURE.md` §10.
7. La validación de leads pasa a validar contra la base, **sin agregar latencia al envío**. Ver §6.
8. `lib/cursos.ts` y `lib/profesoras.ts` **se borran**. Lo que queda se explica en §7.5.
9. **Llaves foráneas sobre `leads`**: `curso_id` y `profesora_id` pasan a apuntar a los slugs del
   catálogo. Entran al alcance porque Felipe verificó el 28/08 que la tabla está vacía y no hay
   valores históricos que puedan hacer fallar la migración.

## 4. Fuera de alcance

- **La interfaz de administración para editar el catálogo → PRD-0009.** En esta pasada se edita
  desde el Table Editor de Supabase. Es deliberado: separar "los datos salen del código" de
  "existe una pantalla para editarlos" hace que el primer cambio se pueda entregar y verificar
  solo.
- **`sedes` y `salas`**, que `ARCHITECTURE.md` §5.2 lista en el mismo bloque. No las necesita nada
  todavía y no tienen datos confirmados: la dirección exacta de las dos sedes sigue sin publicarse
  y el costo de sala vive en `CONTEXT.md`. Entran con PRD-0006, que es quien las va a usar.
- **Precios.** Siguen en `lib/planes.ts` y no se tocan. El precio dejó de ser por curso.
- Migrar `lib/planes.ts` a base de datos. Es otro PRD (PRD-0005 lo necesita para su tabla
  `planes`).

## 5. Flujo principal

### Lectura: cómo el sitio sigue siendo estático

Este es el punto que más se puede hacer mal, así que va explícito.

Hoy `/` es `○ (Static)` y `/profesoras/[slug]` es `● (SSG)`. Leer de la base **no** los convierte
en dinámicos si no se usa ninguna API por petición. La regla concreta:

> Las páginas públicas leen con un cliente Supabase **sin cookies**. `clienteServidor()` llama a
> `cookies()`, y eso saca la ruta del prerender — es exactamente lo que nos obligó a marcar
> `force-dynamic` en los portales de PRD-0004. Para el catálogo público se usa un cliente anónimo
> nuevo, `lib/supabase/publico.ts`, que no toca cookies y por lo tanto entra como rol `anon`. RLS
> le entrega solo lo activo, que es justo lo que la landing muestra.

Con eso las páginas se siguen prerenderizando. La frescura se resuelve con **ISR en dos capas**:

| Capa | Qué hace | Cuánto demora en verse |
|---|---|---|
| **Webhook** (camino normal) | Un Database Webhook de Supabase sobre `cursos`, `profesoras` y `cursos_profesoras` llama a `POST /api/revalidar`, que ejecuta `revalidatePath` | **Segundos.** El cambio se guarda en el Table Editor y la siguiente visita ya ve el sitio regenerado |
| **`export const revalidate = 3600`** (red de seguridad) | Las páginas se regeneran solas al menos una vez por hora | **Hasta 1 hora**, si el webhook falla o nadie lo configuró |

`/api/revalidar` va protegida por un secreto compartido en cabecera (`x-revalidar-secreto`), no
por sesión: quien la llama es Supabase, no una persona. Sin el secreto correcto responde 401.

**Lo que hay que saber del comportamiento:** `revalidatePath` invalida, pero la regeneración
ocurre **en la siguiente petición** — la documentación de Next lo dice explícitamente. No hay
regeneración ansiosa en App Router. En la práctica: Carla guarda, entra al sitio, y lo ve nuevo.

### Escritura

Carla entra al Table Editor de Supabase con su cuenta, edita una fila, guarda. El webhook
dispara. Fin. No hay deploy, no hay commit, no hay Felipe.

## 6. Casos borde y errores

### El slug `kids` tiene que sobrevivir

Hay leads históricos con `curso_id = 'kids'`, y la tabla `leads` los tiene que seguir mostrando
legibles en `/admin/leads`. Reglas:

- `kids` se **siembra como fila** con `activo = false`. No se borra nunca.
- Lo mismo vale hacia adelante para cualquier curso o profesora que salga: **se desactiva, no se
  borra**. `deleted_at` existe por convención de `ARCHITECTURE.md` §5, pero la baja operativa es
  `activo = false`.
- La lectura pública filtra por activo; la de admin no. Así `/admin/leads` sigue resolviendo
  "XO Kids" y la landing no lo muestra.

### Los slugs no se editan

Riesgo nuevo que no existía con el catálogo en código: **si alguien renombra un slug desde el
Table Editor, los leads históricos que lo referencian quedan huérfanos**, porque `leads` guarda
texto sin llave foránea. También rompe la URL pública `/profesoras/<slug>`, que puede estar
compartida por Instagram.

Se impone con un **trigger que rechaza el `update` de `slug`**. Si de verdad hay que renombrar,
se hace con una migración que arregle también los datos que apuntan ahí. Un `raise exception` con
mensaje claro es mejor que descubrirlo tres meses después.

### Una profesora nueva no puede dar 404

`app/profesoras/[slug]` tiene hoy `dynamicParams = false`: cualquier slug fuera de
`generateStaticParams` responde 404. Con el catálogo en base de datos eso significa que una
profesora creada en el Table Editor daría 404 **hasta el próximo deploy**, que es justo lo que
este PRD viene a eliminar.

Pasa a `dynamicParams = true`:

- `generateStaticParams` sigue existiendo y sigue leyendo de la base: las que existen al momento
  del build salen prerenderizadas, igual que hoy.
- Una que no estaba se **renderiza en la primera petición** y queda cacheada. Sin deploy.
- Un slug que de verdad no existe, o que existe pero está inactiva, sigue respondiendo 404 con
  `notFound()`. Eso no cambia.

⚠️ La documentación de Next advierte que `dynamicParams` **no está disponible con Cache Components
habilitado**. Hoy el proyecto no lo usa; si algún día se activa, este punto hay que rehacerlo.

### La validación de leads no puede volver lento el formulario

Hoy `lib/lead.ts` valida `esCursoActivo` y `esProfesoraActiva` contra arreglos en memoria: cuesta
cero. Contra la base, la forma ingenua sería un `select` de validación antes del `insert`, o sea
**duplicar los viajes a Supabase** en el momento más sensible del sitio.

**La validación en dos capas no se pierde.** `lib/lead.ts` sigue validando **la forma** —nombre
con al menos dos letras, ocho dígitos de teléfono, edad en rango— en cliente y servidor: el
cliente avisa antes de enviar y el servidor manda. Si todo se mudara a la base, la persona se
enteraría del error *después* de enviar en vez de antes, que es peor experiencia por nada.

Lo que sube a la base es solo **lo que solo la base puede saber**: que el curso y la profesora
existan y estén activos. Y sube sin agregar ningún viaje:

- **La lista de opciones del formulario ya viene gratis.** El selector de profesoras se dibuja en
  la página, que es estática y ya trae el catálogo. No hay consulta al enviar.
- **La comprobación de vigencia se hace dentro del mismo `insert`,** con una función
  `public.crear_lead(...)` en Postgres que valida contra `cursos` y `profesoras` e inserta en una
  sola llamada. Un viaje, igual que hoy. Y la regla queda en la base, que es donde
  `CLAUDE.md` pide que vivan las validaciones que importan.
- Si el curso o la profesora no existen o están inactivos, la función levanta una excepción y la
  Route Handler responde el mismo 400 que hoy.

Efecto neto sobre la visitante: **ninguno**. Mismo número de viajes, misma latencia.

### Otros

- **Sin conexión a Supabase durante el build.** El build fallaría al no poder leer el catálogo.
  Es aceptable y hasta deseable —un sitio sin catálogo no debe publicarse— pero hay que saberlo:
  si Supabase está pausado por inactividad (riesgo real, `CONTEXT.md` §11), el deploy falla con
  un error de red y no con uno obvio.
- **Curso sin profesoras asignadas.** La tarjeta se dibuja con la lista vacía; no es un error.
- **Profesora activa sin cursos activos.** Aparece en el lineup con "Hace clases en" vacío. Es el
  caso que ya cubrimos filtrando por curso activo.
- **Dos filas con el mismo slug.** Lo impide un `unique`.

## 7. Modelo de datos

### 7.1 Tablas nuevas

```sql
create table public.profesoras (
  id uuid primary key default gen_random_uuid(),
  -- Identidad pública y estable. Es lo que guardan leads.profesora_id,
  -- perfiles.profesora_id y la URL /profesoras/<slug>. No se edita: ver el
  -- trigger de 7.3.
  slug text not null unique,
  nombre text not null,
  -- Eyebrow del lineup: el estilo que enseña, corto y en minúsculas.
  estilo text not null,
  bio text,
  instagram text,
  -- Rutas dentro de /public, o null mientras no exista el material.
  foto_url text,
  video_url text,
  -- El lineup tiene un orden pensado, no alfabético.
  orden int not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.cursos (
  id uuid primary key default gen_random_uuid(),
  -- Lo que guardan los leads históricos. 'kids' vive acá para siempre.
  slug text not null unique,
  nombre text not null,
  -- Eyebrow: a quién está dirigido, en una línea.
  publico text not null,
  estilo text not null,
  descripcion text not null,
  -- Solo Girly: el formato intensivo mensual por artista.
  formato text,
  -- Pendientes de Carla. null se muestra como "Por confirmar".
  horario text,
  cupos int,
  orden int not null default 0,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Muchos a muchos. Sin columnas propias todavía: si más adelante hace falta
-- decir quién es titular y quién reemplazo, se agrega acá.
create table public.cursos_profesoras (
  curso_id uuid not null references public.cursos (id) on delete cascade,
  profesora_id uuid not null references public.profesoras (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (curso_id, profesora_id)
);
```

**Nota de nombres:** `cursos.activo` en masculino y `profesoras.activa` en femenino. Hoy
`lib/cursos.ts` usa `activa` para un curso, que es un error de concordancia que se arrastra desde
el principio. Se corrige al migrar, no después.

**Precio:** no hay columna. Dejó de ser por curso el 25/08 y vive en `lib/planes.ts`.

### 7.2 La deuda de `perfiles.profesora_id`

```sql
alter table public.perfiles
  add constraint perfiles_profesora_fk
  foreign key (profesora_id) references public.profesoras (slug)
  on update cascade on delete restrict;
```

La FK apunta a **`slug` y no a `id`**, a propósito: `perfiles.profesora_id` y `leads.profesora_id`
ya guardan slugs, están en producción, y `/profesoras/<slug>` es una URL pública que puede estar
compartida. Convertir todo a `uuid` obligaría a reescribir filas históricas y a cambiar las URLs
para no ganar nada. El `on update cascade` cubre el renombre, aunque el trigger de 7.3 lo prohíba
igual.

**Consecuencia directa:** la validación de slug de `POST /api/roles` —que existe *solo* porque no
había FK, y así está anotada en el código y en PRD-0004 §8— **se borra**. La reemplaza la llave
foránea. Lo que **no** reemplaza es el chequeo de que la profesora esté **activa**, que una FK no
puede expresar: esa regla se mueve dentro de `public.cambiar_rol`, que es donde ya viven las
demás reglas de cambio de rol.

Se saca la fila correspondiente de la deuda técnica de `ARCHITECTURE.md` §10.

**`leads` también.** `curso_id` y `profesora_id` pasan a apuntar a los mismos slugs:

```sql
alter table public.leads
  add constraint leads_curso_fk foreign key (curso_id)
  references public.cursos (slug) on update cascade on delete restrict;

alter table public.leads
  add constraint leads_profesora_fk foreign key (profesora_id)
  references public.profesoras (slug) on update cascade on delete restrict;
```

Con esto un lead **no puede** apuntar a un curso o una profesora que no existen, ni siquiera
escrito a mano en la base. La FK cubre la existencia; que además estén **activos** lo comprueba
`crear_lead`, porque eso una llave foránea no lo puede expresar.

### 7.3 Los slugs son inmutables

```sql
create or replace function public.slug_inmutable()
returns trigger language plpgsql as $$
begin
  if new.slug is distinct from old.slug then
    raise exception 'El slug no se edita: hay leads y URLs públicas que apuntan a "%"', old.slug
      using errcode = '23514';
  end if;
  return new;
end $$;
```
Con un trigger `before update` en `cursos` y en `profesoras`.

### 7.4 RLS

| Tabla | Quién | Qué |
|---|---|---|
| `cursos`, `profesoras` | `anon` y `authenticated` | `select` de las filas **activas y no borradas** |
| `cursos`, `profesoras` | `admin`+ | `select` de todas, e `insert` / `update` |
| `cursos_profesoras` | `anon` y `authenticated` | `select` |
| `cursos_profesoras` | `admin`+ | `insert` / `delete` |
| todas | nadie | `delete` sobre `cursos` y `profesoras`: la baja es `activo = false` |

`tiene_nivel('admin')` incluye a `owner` por aritmética, igual que en PRD-0004. Los grants van
explícitos a `anon` y `authenticated`: es la primera tabla del proyecto que `anon` puede leer, y
por eso la política de lectura pública tiene que decir `activo` de forma literal, no confiar en
que la aplicación filtre.

### 7.5 Qué pasa con `lib/cursos.ts` y `lib/profesoras.ts`

**Se borran los dos.** Los datos se van a la migración como carga inicial; los tipos y las
consultas se van a `lib/catalogo.ts`.

Hay una consecuencia de tipos que conviene mirar antes de aprobar:

> `CursoId` y `ProfesoraId` eran **uniones cerradas** (`"kids" | "teens" | …`), y el compilador
> las usaba para verificar todo el sitio. Con el catálogo en la base ese conjunto deja de
> conocerse en tiempo de compilación: **pasan a ser `string`**. Se pierde ese chequeo estático y a
> cambio lo hacen las llaves foráneas, que además cubren lo que el compilador nunca cubrió: los
> datos que ya están en la base.
>
> **Queda anotado en `ARCHITECTURE.md` §10 como consecuencia consciente**, no como algo que se
> olvidó. Es el intercambio propio de mover datos de código a base y conviene poder releerlo.

Y una consecuencia de arquitectura:

> Cuatro **componentes cliente** importan el catálogo hoy: `Lineup`, `Formulario`,
> `PreseleccionPorUrl` y `CambiarRol`. Un componente cliente no puede consultar la base con la
> service role key ni debe hacerlo con la anon. Pasan a **recibir el catálogo por props** desde su
> página servidor. Es el refactor más ancho de este PRD, y no es opcional.

`lib/tipos.ts` conserva `Origen` y `POR_CONFIRMAR`.

## 8. Reglas de negocio

1. Un curso o profesora que sale del catálogo **se desactiva, nunca se borra**. Hay leads que
   apuntan a su slug.
2. **El slug no se edita.** Lo impone un trigger, no la buena memoria.
3. La lectura pública muestra **solo lo activo**, y lo garantiza RLS, no la aplicación.
4. Solo `admin` o superior escribe en el catálogo.
5. Un lead nuevo solo se acepta si su curso y su profesora existen y están **activos**. Se valida
   en la base, en la misma transacción del `insert`.
6. Nadie queda con rol `profesora` apuntando a una profesora que no existe. Ahora lo garantiza una
   llave foránea, no una validación en TypeScript.

## 9. Criterios de aceptación

- [ ] Cambiar una bio en el Table Editor se ve en el sitio **sin deploy**, en menos de un minuto.
- [ ] `npm run build` sigue reportando `/` como `○ (Static)` y `/profesoras/[slug]` como `● (SSG)`.
- [ ] Una profesora creada en el Table Editor tiene perfil público **sin deploy**, y no da 404.
- [ ] Desactivar una profesora la saca del lineup, del selector y de su perfil público (404), y
      los leads que la nombran **siguen legibles** en `/admin/leads`.
- [ ] `kids` sigue existiendo como fila inactiva y `/admin/leads` sigue mostrando "XO Kids".
- [ ] Intentar cambiar un slug desde el Table Editor falla con un mensaje que explica por qué.
- [ ] `anon` puede leer los cursos activos y **no** puede leer los inactivos, verificado con la
      llave publishable contra la API.
- [ ] `anon` no puede escribir en `cursos` ni en `profesoras`.
- [ ] Enviar el formulario de leads hace **el mismo número de viajes a Supabase** que hoy.
- [ ] Un lead con un `profesora_id` inexistente o inactivo se rechaza con 400.
- [ ] `perfiles.profesora_id` tiene llave foránea, y `POST /api/roles` ya no valida el slug en
      TypeScript.
- [ ] `lib/cursos.ts` y `lib/profesoras.ts` no existen.

## 10. Métrica de éxito

**Cuántos cambios de catálogo hace Carla sin pedirle nada a Felipe, en los primeros 30 días.**
Si son cero, el Table Editor resultó demasiado hostil y hay que adelantar PRD-0009. Si son
varios, el entregable hizo su trabajo aunque no tenga interfaz propia.

## 11. Riesgos y supuestos

- ✅ **Resuelto antes de implementar.** Felipe corrió
  `select distinct curso_id, profesora_id from public.leads` el 28/08/2026: **no devuelve filas**,
  la tabla está vacía. Sin datos históricos que puedan no calzar, las llaves foráneas sobre
  `leads` entraron al alcance. Si en el futuro hubiera que rehacerlas con datos dentro, este es el
  chequeo que hay que repetir primero.
- **Supabase pausado rompe el build.** En plan gratuito el proyecto se suspende tras ~1 semana sin
  actividad (`CONTEXT.md` §11). Con el catálogo en base de datos, eso pasa de "el formulario no
  guarda" a "el deploy falla". Es un argumento más para subir a Pro antes del lanzamiento.
- **El webhook es configuración de panel, no código.** Si nadie lo crea, todo sigue funcionando
  pero los cambios tardan hasta una hora. Conviene que quede escrito en `ARCHITECTURE.md` §2 junto
  con las variables de entorno, porque es del mismo tipo: algo que el repo no puede garantizar.
- **Supone que Carla se maneja en el Table Editor.** Si no, la métrica de §10 lo va a mostrar
  rápido.
- **`revalidate = 3600` es un número puesto a ojo.** Con tráfico de campaña puede convenir menos.
  Se ajusta con datos, no antes.

## 12. Notas de implementación

| Pieza | Dónde |
|---|---|
| Esquema, carga inicial, triggers, FK y RLS | `supabase/migrations/20260828120000_catalogo_en_base_de_datos.sql` |
| Tipos y helpers puros (cliente y servidor) | `lib/catalogo.ts` |
| Consultas (solo servidor) | `lib/catalogo-consultas.ts` |
| Cliente anónimo sin cookies | `lib/supabase/publico.ts` |
| Revalidación bajo demanda | `app/api/revalidar/route.ts` |

Decisiones y hallazgos al implementar:

- **`lib/catalogo.ts` se partió en dos.** La primera versión tenía tipos y consultas juntos, y el
  build falló: `Lineup`, `Formulario` y `CambiarRol` son componentes cliente e importan helpers
  del catálogo, así que Turbopack arrastraba `next/headers` al bundle del navegador. Los tipos y
  los helpers puros quedaron en `catalogo.ts` y las consultas en `catalogo-consultas.ts`. El
  archivo dice por qué, para que nadie las vuelva a juntar.
- **La carga inicial se generó desde los archivos originales, no a mano.** Un script extrajo los
  literales de `lib/cursos.ts` y `lib/profesoras.ts` y emitió el SQL: las bios traen emojis y
  transcribirlas a mano era pedir un error silencioso.
- **Los pares `kids ↔ drimy` y `kids ↔ lina` se conservan.** `lib/cursos.ts` las seguía listando
  en Kids aunque `lib/profesoras.ts` ya no. Es cierto —dictaron ese curso— y no se ve en ninguna
  parte, porque `kids` está inactivo.
- **El error de "no existe el catálogo" se hizo accionable.** El build falla diciendo qué
  migración falta aplicar, o sugiriendo revisar si Supabase está pausado. Con el catálogo en la
  base, un proyecto suspendido pasa de "el formulario no guarda" a "el deploy falla", y un
  mensaje de PostgREST sobre el *schema cache* no le dice eso a nadie.
- **`crear_lead` distingue el 400 del 500.** Si la profesora dejó de estar activa entre que la
  página se generó y la visitante envió el formulario —posible, justamente porque la página es
  estática— responde 400 pidiendo recargar, no un 500 genérico.

⚠️ **La migración está escrita y sin aplicar**, como se pidió. Hasta que corra `supabase db push`:

- `npm run build` **falla a propósito** al recolectar datos, con el mensaje que nombra el archivo.
  Compilación y TypeScript sí pasan.
- Es el comportamiento diseñado en §11: un sitio sin catálogo no debe publicarse.

⚠️ **Falta configuración que no está en el código:**

1. `REVALIDAR_SECRETO` en Vercel, y el mismo valor en el Database Webhook.
2. El Database Webhook en Supabase sobre `cursos`, `profesoras` y `cursos_profesoras`, apuntando a
   `POST /api/revalidar` con la cabecera `x-revalidar-secreto`.

Sin lo segundo el sitio igual se actualiza solo, pero tarda hasta una hora en vez de segundos.
