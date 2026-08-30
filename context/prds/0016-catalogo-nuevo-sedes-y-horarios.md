# PRD-0016 — Catálogo nuevo, sedes y horarios

| Campo | Valor |
|---|---|
| **Estado** | **Aprobado** el 30/08/2026 · en implementación |
| **Autor** | Felipe Carvalho |
| **Fecha** | 30 de agosto de 2026 |
| **Hito** | Hito 0 — Lanzamiento · Hito 1 — entregable 1.2 |
| **PRDs relacionados** | PRD-0015 (catálogo en base de datos) · PRD-0003 (captación por profesora) · PRD-0005 (compra en línea) · PRD-0006 (clases y horarios) · PRD-0009 (portal de administración) |

---

## 1. Problema

El catálogo que hay en la base es el de agosto y ya no es el de la academia. Cambió casi todo:

- **La oferta.** Girly Básico e Intermedio se funden en un solo **Girly**; aparecen **Reggaeton
  Femme** y **Slow Femme**; **K-Pop sale** y con él Maida; Teens baja su tramo a 11–14 y el resto
  sube a 15+.
- **Las sedes.** Ya no son "Los Leones" y "Los Dominicos" sino dos lugares con nombre y dirección
  real, y **ahora la dirección se publica**, al revés de la regla vigente.
- **Los horarios.** Existen: siete clases con día, hora, profesora y sede. Hasta hoy el sitio dice
  "Por confirmar" en cada tarjeta, y eso ya es información que estamos escondiendo sin motivo.

Y hay un cambio de producto que no viene del catálogo: **el formulario abre WhatsApp al enviar**,
y eso deja de tener sentido. El sitio no se lanza hasta que exista la compra en línea, así que
mandar a la visitante a una conversación de WhatsApp promete una coordinación que hoy nadie está
haciendo a escala.

## 2. Usuario y contexto de uso

La visitante que llega de Instagram, en el teléfono. Hasta ahora podía enterarse de qué cursos
hay y con quién, pero no de **cuándo ni dónde** — las dos preguntas que decide antes de
inscribirse. Este PRD las responde.

Carla y Felipe, desde el Table Editor, siguen siendo quienes editan: PRD-0015 ya les dio esa
puerta y PRD-0016 solo agrega tablas por las que entrar.

## 3. Alcance

1. **Catálogo nuevo** de cursos y profesoras, con los cursos viejos **desactivados, no borrados**.
2. Tabla **`sedes`** con nombre, dirección y comuna, y **la dirección publicada en el sitio**.
3. Tabla **`horarios`**: curso, profesora, sede, día y hora. Un curso puede tener varios.
   `cursos.horario` deja de usarse.
4. Campo **`dificultad`** en `cursos`: `principiante` · `intermedio` · `avanzado`.
5. Resolver la redundancia de **`cursos_profesoras`** frente a `horarios`. Ver §7.4.
6. **WhatsApp sale del flujo de conversión.** Ver §5.
7. El sitio dice **Providencia y Las Condes**, no solo Las Condes: hero, metadata, imagen de Open
   Graph y páginas legales.
8. Actualizar `context/CONTEXT.md` (catálogo, sedes, horarios y **razón social**),
   `context/BRAND.md` (la regla de la dirección) y `CLAUDE.md`.
9. **Mostrar los horarios y las sedes en el sitio.** Sin esto las tablas no tienen consumidor y el
   cambio no se ve.

## 4. Fuera de alcance

- **`salas`.** `ARCHITECTURE.md` §5.2 las contempla, pero con una sala por sede no aportan nada
  todavía. Entran cuando una sede tenga dos.
- **Compra y reserva en línea** → PRD-0005 y PRD-0006. Este PRD deja el sitio listo para
  informar, no para vender.
- **La interfaz de administración** para editar sedes y horarios → PRD-0009. Se edita desde el
  Table Editor, igual que el catálogo.
- **`edad_min` / `edad_max` como columnas.** Los tramos nuevos (11–14, 15+) viven en el texto de
  `publico`, que es el que se muestra. Estructurarlos no lo pide nada hoy: la edad mínima que el
  sistema valida es una sola para toda la academia y está en `lib/lead.ts`. Cuando PRD-0006 arme
  inscripciones por curso, probablemente los necesite; ahí se agregan con un consumidor real.
- **Cambiar qué pregunta el formulario.** Ver la pregunta abierta de §5.

## 5. WhatsApp sale del flujo de conversión

### Qué pasa hoy

Al enviar el formulario, `components/Formulario.tsx` abre una pestaña a `wa.me` con un mensaje
precargado. Eso arrastra tres cosas feas: una pestaña que se abre **antes** del `await` para que
el navegador no la bloquee, un estado `linkWa` que solo existe para eso, y el problema que
`CONTEXT.md` §10 ya registró — en escritorio sin sesión, `wa.me` manda a un código QR.

### La propuesta: el formulario se queda, el salto a WhatsApp se va

**Recomendación: mantener el formulario y quitarle el envío a WhatsApp.** Al enviar, el lead se
guarda igual y la visitante ve una confirmación en la misma página.

Por qué no retirarlo entero:

- Es **el único mecanismo de captación que existe**, y la campaña de Instagram está corriendo.
  Retirarlo deja la landing sin ninguna forma de saber quién se interesó.
- El costo de mantenerlo es cero: ya está construido, probado y con RLS resuelta.
- Cuando exista la compra (PRD-0005), el formulario no se bota: se convierte en el paso de
  "avísame cuando abra" para quien todavía no compra.

Lo que cambia en concreto:

| Antes | Después |
|---|---|
| Se abre una pestaña a `wa.me` con mensaje precargado | No se abre nada |
| La confirmación ofrece "Abrir WhatsApp" | La confirmación dice que le vamos a escribir |
| El copy promete "Te escribimos por WhatsApp para coordinar el día, el horario y los valores" | Los horarios y los valores **ya están publicados**: el copy deja de prometer que se informan después |

**WhatsApp no desaparece del sitio**, solo del flujo automático: sigue en el footer como forma de
contacto, y sigue en la tabla de leads de admin como enlace para escribirle a cada persona. Lo
que se retira es el salto automático al enviar.

### ⚠️ Pregunta abierta que este PRD no cierra

Con horarios y direcciones publicados, **la pregunta del formulario probablemente debería cambiar**:
hoy pregunta "¿con quién quieres tomar clases?" (PRD-0003), pero lo que la visitante ya puede
elegir mirando la página es un **horario** — que trae profesora, sede y día en un solo dato.
Cambiarlo toca la captación completa y la métrica de PRD-0003, así que **no entra acá**. Queda
anotado para decidirlo antes de PRD-0005.

## 6. Casos borde y errores

- **Los cursos viejos siguen existiendo.** `kpop`, `girly-basico` y `girly-intermedio` pasan a
  `activo = false`; `kids` ya lo está. Ninguno se borra: hay llaves foráneas desde `leads` y la
  regla de PRD-0015 es que un curso sale del catálogo desactivándose.
- **Maida también.** `activa = false`. Su perfil público pasa a responder 404 y desaparece del
  lineup y del selector, pero cualquier lead que la nombre se sigue leyendo en admin.
- **Girly Básico e Intermedio se funden, pero no se renombran.** El slug `girly` es **nuevo**: los
  slugs son inmutables por trigger (PRD-0015), y reutilizar `girly-basico` renombrándolo está
  prohibido justamente porque hay datos apuntando ahí.
- **Una profesora deja de dictar un curso.** Con la propuesta de §7.4, basta desactivar el
  horario: la relación deja de mostrarse sola.
- **Dos clases a la misma hora en la misma sede.** No puede pasar con una sala por sede, y se
  impide con un índice único. Lo mismo con una profesora en dos lugares a la vez.
- **Un curso activo sin horarios.** Se muestra sin horarios y, con §7.4, sin profesoras. Es feo a
  propósito: es la señal de que ese curso no debería estar publicado.

## 7. Modelo de datos

### 7.1 `sedes`

```sql
create table public.sedes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,          -- 'seduccion-latina', 'diaguitas'
  nombre text not null,
  -- Desde este PRD la dirección se publica. Ver §9.
  direccion text not null,
  comuna text not null,
  -- Cómo la ubica alguien de Santiago: "sector Los Leones".
  referencia text,
  orden int not null default 0,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

| slug | nombre | dirección | comuna | referencia |
|---|---|---|---|---|
| `seduccion-latina` | Seducción Latina Experience | Av. Nueva Providencia 2260 | Providencia | sector Los Leones |
| `diaguitas` | Centro Comunitario Diaguitas | Diaguitas 911 | Las Condes | — |

### 7.2 `horarios`

```sql
create table public.horarios (
  id uuid primary key default gen_random_uuid(),
  curso_id uuid not null references public.cursos (id) on delete restrict,
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  -- ISO 8601: 1 = lunes … 7 = domingo. Un número y no un texto para poder
  -- ordenar la semana sin un case.
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora time not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Una sala por sede: no puede haber dos clases a la misma hora en el mismo
-- lugar. Parciales, para que un horario desactivado no bloquee al que lo
-- reemplaza.
create unique index horarios_sede_unico
  on public.horarios (sede_id, dia_semana, hora)
  where activo and deleted_at is null;

-- Y nadie está en dos partes a la vez.
create unique index horarios_profesora_unico
  on public.horarios (profesora_id, dia_semana, hora)
  where activo and deleted_at is null;
```

Los siete horarios pasan las dos restricciones. Se verificó a mano antes de proponerlas.

| Curso | Profesora | Día | Hora | Sede |
|---|---|---|---|---|
| Reggaeton Femme | Drimy | lunes | 17:00 | Providencia |
| Teens | Carli | lunes | 18:00 | Las Condes |
| Girly | Pau | lunes | 20:00 | Las Condes |
| Reggaeton Femme | Pau | miércoles | 20:00 | Las Condes |
| Girly | Carli | viernes | 20:00 | Providencia |
| Slow Femme | Lina | sábado | 17:00 | Providencia |
| Girly | Carli | sábado | 18:00 | Providencia |

`cursos.horario` queda **sin uso**. No se borra la columna en esta migración: el dato es `null`
en todas las filas y borrarla es un cambio irreversible que no gana nada hoy. Se marca con un
`comment on column` que dice que la reemplazó `horarios`.

### 7.3 `dificultad`

```sql
alter table public.cursos
  add column dificultad text not null default 'principiante'
  check (dificultad in ('principiante', 'intermedio', 'avanzado'));
```

`text` con `check` y no un `enum` de Postgres, por consistencia con `perfiles.rol`: agregar un
valor a un check es un `alter`, y a un enum es una migración más incómoda.

Los cuatro cursos activos quedan en `principiante`. La columna existe igual porque el negocio ya
tuvo un Girly Intermedio y va a volver a tener niveles.

### 7.4 ⚠️ `cursos_profesoras` sobra: propongo eliminarla

**Evaluación.** `horarios` dice quién dicta qué, dónde y cuándo. `cursos_profesoras` dice quién
dicta qué. **No hay ningún hecho en la segunda que no esté en la primera.** Con el catálogo nuevo
la derivación no pierde nada:

| Curso | Desde `horarios` | Desde `cursos_profesoras` |
|---|---|---|
| Reggaeton Femme | Drimy, Pau | igual |
| Girly | Pau, Carli | igual |
| Teens | Carli | igual |
| Slow Femme | Lina | igual |

**Recomendación: eliminar `cursos_profesoras` y derivar la relación de `horarios`.** El motivo de
fondo no es ahorrar una tabla, es que **dos fuentes para el mismo hecho se desincronizan**, y con
PRD-0009 va a haber gente editando: alguien agrega un horario y se olvida de la otra tabla, o al
revés. Ya nos pasó una versión chica de esto — `lib/cursos.ts` decía que Drimy dictaba Kids y
`lib/profesoras.ts` decía que no.

**Lo que se pierde**, y hay que decirlo: la idea de "esta profesora *puede* dictar este curso
aunque este mes no lo tenga en el horario". Un curso sin horarios queda sin profesoras a la
vista. Sostengo que eso es correcto —un curso que nadie dicta no debería estar publicado— y que
además es un aviso útil, no un error.

Si prefieres conservar esa idea, la alternativa es dejar la tabla y que `horarios` sea la que
manda para lo que se muestra, pero entonces hay que asumir el costo de mantener las dos.

### 7.5 RLS

Las tres tablas siguen exactamente el patrón que PRD-0015 dejó para `cursos` y `profesoras`:

| Tabla | `anon` y `authenticated` | `admin`+ |
|---|---|---|
| `sedes` | `select` de las activas | `select` de todas, `insert`, `update` |
| `horarios` | `select` de los activos | `select` de todos, `insert`, `update` |

Sin `delete` para nadie: la baja es `activo = false`, igual que en el resto del catálogo.

⚠️ **Un horario activo puede apuntar a un curso o una sede inactivos**, y RLS no lo impide por sí
sola: la política de `horarios` mira `horarios.activo`, no el estado de lo que referencia. La
consulta pública hace el `join` y descarta esos casos, y la administración los ve. Lo dejo
anotado porque es el tipo de cosa que se descubre tarde.

## 8. Qué se ve en el sitio

Sin esto, las tablas nuevas no tienen consumidor:

1. **Tarjeta de curso:** el dato "Horario" pasa de "Por confirmar" a la lista real —día, hora,
   sede y profesora—. El dato "Profes" sale de los horarios.
2. **Sección o bloque de sedes**, con nombre, dirección y comuna de las dos. Es información nueva
   que hasta hoy se entregaba por WhatsApp.
3. **Perfil público de profesora:** sus horarios, con curso, día, hora y sede.
4. **Hero, metadata y footer:** "Providencia y Las Condes" en vez de "Las Condes".

## 9. Reglas de negocio

1. Un curso o profesora que sale se **desactiva**. Sigue vigente desde PRD-0015.
2. **Los slugs no se editan.** `girly` es un slug nuevo, no un `girly-basico` renombrado.
3. **La dirección exacta ahora se publica.** Cambia `BRAND.md` §7, que hoy dice lo contrario, y la
   regla equivalente de `CLAUDE.md`.
4. No hay dos clases a la misma hora en la misma sede, ni una profesora en dos lugares a la vez.
   Lo imponen índices únicos, no la buena voluntad.
5. El formulario **no abre WhatsApp**. Guarda el lead y confirma en la página.

## 10. Criterios de aceptación

- [ ] Los cuatro cursos nuevos aparecen en el sitio, y los cuatro viejos no.
- [ ] Maida no aparece en el lineup ni en el selector, y `/profesoras/maida` responde 404.
- [ ] Un lead que apunta a un curso o profesora desactivados **se sigue leyendo** en `/admin/leads`.
- [ ] Cada curso muestra sus horarios con día, hora, sede y profesora.
- [ ] Las dos direcciones aparecen publicadas en el sitio.
- [ ] El hero, la metadata y las páginas legales dicen Providencia y Las Condes.
- [ ] Enviar el formulario **no abre ninguna pestaña** y confirma en la misma página.
- [ ] Intentar dos horarios activos en la misma sede, día y hora falla en la base.
- [ ] `npm run build` sigue reportando `/` como `○` y `/profesoras/[slug]` como `●`.
- [ ] `CONTEXT.md` dice **XO Dance Studio SpA** y las sedes reales.

## 11. Métrica de éxito

**Cuántas personas dejan sus datos por semana, comparado con antes de publicar horarios y
direcciones.** Publicar el cuándo y el dónde puede subir la conversión —quita dos incógnitas— o
bajarla, si alguien descubre que ningún horario le sirve. Las dos respuestas son útiles; no
saberlo, no.

Ojo con la comparación: quitar el salto a WhatsApp cambia el flujo en el mismo momento, así que
la medición no aísla una cosa de la otra.

## 12. Riesgos y supuestos

- **Una sala por sede. ✅ Confirmado el 30/08/2026** para el Centro Comunitario Diaguitas, así
  que el índice único de `(sede_id, dia_semana, hora)` es correcto tal como está.
  ⚠️ **Si alguna sede llega a tener más de una sala, esa restricción hay que revisarla junto con
  el modelado de `salas` de PRD-0006**, no por separado: la restricción deja de ser "una clase por
  sede a la vez" y pasa a ser "una clase por sala a la vez", y el `unique` se mueve a
  `(sala_id, dia_semana, hora)`.
- **Las direcciones se publican y son de terceros.** Los dos lugares son arrendados. Publicar la
  dirección de un centro comunitario y de un estudio ajeno debería estar conversado con ellos.
  ⚠️ **No es una decisión técnica y no la puedo verificar.**
- **Estado transitorio conocido y aceptado (decisión de negocio, 30/08/2026).** Durante varias
  semanas el sitio va a **informar clases ya iniciadas sin compra en línea**. No es un descuido ni
  algo que este PRD deba resolver: se asume a sabiendas hasta que exista PRD-0005.

  Consecuencia operativa: **el formulario es el único mecanismo de captación** en todo ese
  período, y ahora además sin el salto a WhatsApp que lo empujaba a una conversación inmediata.
  Quien deja sus datos queda esperando que alguien de la academia le escriba a mano. Si esa
  respuesta manual no ocurre rápido, la publicación de horarios y direcciones —que baja la
  fricción para decidir— se desperdicia justo donde más importa.

  Lo que esto sí exige del copy: el formulario **no puede prometer** una coordinación automática
  que nadie está haciendo. Ver §5.
- **Teens baja de 11–15 a 11–14** y el resto sube de 16+ a 15+. `EDAD_MINIMA = 11` en
  `lib/lead.ts` sigue siendo correcta; `EDAD_MAXIMA = 17` también, porque es el tope de "para mi
  hija". No hay cambio de código ahí, pero conviene saber que se revisó.
- Se asume que **K-Pop no vuelve pronto**. Si vuelve, se reactiva la fila: por eso no se borra.

## 13. Notas de implementación

| Pieza | Dónde |
|---|---|
| Esquema, carga, índices y RLS | `supabase/migrations/20260830120000_catalogo_nuevo_sedes_horarios.sql` |
| Tipos y derivaciones | `lib/catalogo.ts` |
| Consultas | `lib/catalogo-consultas.ts` |
| Sección de sedes | `components/Sedes.tsx` |

Decisiones y hallazgos al implementar:

- **Las descripciones de los tres cursos nuevos las escribí yo.** `cursos.descripcion` es
  `not null` y no venían en el encargo. Están redactadas siguiendo la voz de `BRAND.md` §7 y sin
  inventar ningún dato de negocio —no prometen formato, duración ni cantidad de clases—, pero
  **son copy propuesto y necesitan la revisión de Carla**. Se editan desde el Table Editor sin
  tocar código, que es justo lo que PRD-0015 vino a habilitar.
- **`formato` quedó en `null` para los cursos nuevos.** El "intensivo mensual por artista" era del
  Girly viejo y no sé si el Girly nuevo lo hereda. Inventarlo habría sido inventar un dato de
  negocio.
- **Un horario que apunta a algo inactivo se descarta en la consulta.** Es el caso que §7.5 dejó
  anotado: RLS oculta el curso o la sede, el join devuelve `null` en esa punta, y mostrarlo a
  medias sería peor que no mostrarlo.
- **Se limpiaron dos textos que quedaron mintiendo.** El bloque previo al formulario y el copy del
  propio formulario prometían coordinar por WhatsApp "el día, el horario y los valores", tres
  cosas que ahora están publicadas en la misma página.
- **`getProfesoraPublica` desapareció.** Con horarios y sedes en juego, el perfil necesita el
  catálogo completo igual; una consulta que traía solo una profesora ya no ahorraba nada.

⚠️ **La migración está escrita y sin aplicar**, como se pidió. Hasta que corra `supabase db push`,
`npm run build` **falla a propósito** al recolectar datos, con el mensaje
`column cursos.dificultad does not exist` y la instrucción de aplicar las migraciones.
Compilación y TypeScript sí pasan.
