# PRD-0018 — Clases especiales

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 10/09/2026.** Fase 1 lista para partir. Precio por defecto ($12.000) y sin sueldo base confirmados en PRD-0009 §8. Bucket privado y embed tras un clic decididos el mismo día (§7.6, §8.7) |
| **Autor** | Propuesto por Claude a pedido de Felipe Carvalho. Decisiones de §8: Felipe |
| **Fecha** | 8 de septiembre de 2026 · decisiones cerradas el 9 · Reel y alcance de fase 0 resueltos el 10 |
| **Hito** | Hito 3 — Reservas (extiende el calendario) · Hito 4 — Portales (formulario en admin) |
| **PRDs relacionados** | PRD-0006 (calendario y reservas) · PRD-0009 (portal de administración: parámetros y pago de la profesora, §8) · PRD-0010 (métricas: atribución y ocupación; liquidación, parte 3) · PRD-0014 (sección Planes) · PRD-0016 (horarios y sedes) · PRD-0017 (compras, créditos, `clases`) · ADR-0002 (créditos universales) |

> **Nombre público: "Clases especiales"** (decidido el 09/09/2026). Felipe las llamó al principio
> "clases sueltas", y ese nombre ya está tomado por el plan de 1 clase de la tabla `planes`, que
> se publica así en la landing a $8.500. En el código, `tipo = 'especial'`. La entrada de la
> sección Planes dice **"Ver clases especiales"**.

---

## 1. Problema

La parrilla fija es semanal y de nivel principiante en los cuatro cursos. Cuando una coreografía
gusta —se ve en las historias, la piden por Instagram, la alumna quiere repetirla o traer a una
amiga— no hay dónde ponerla: el horario de Pau del jueves es el horario de Pau del jueves, y la
semana siguiente toca otra cosa.

Hoy eso se resuelve mal o no se resuelve: la profesora improvisa una repetición dentro de su
horario fijo (y la alumna que fue la semana pasada la ve de nuevo), o se organiza algo por
WhatsApp que no queda en el sistema: no se reserva por la web, no se cobra por la plataforma, no
aparece en las métricas ni en la liquidación de la profesora.

Lo que se quiere es poder **agendar una clase puntual, con una coreografía específica, fuera de
la parrilla, con precio propio**, y que la visitante la vea con video antes de decidir. El precio
propio va en las dos direcciones: proyectos premium más caros que la parrilla, y clases más
económicas para llenar un horario o probar una idea. Es además la primera pieza del negocio que
trata a la profesora como producto (visión de plataforma de talentos, `CONTEXT.md` §7): la
coreografía es de ella, el Reel es de ella, y la mitad de lo que deja la clase también.

## 2. Usuario y contexto de uso

| Quién | Desde dónde | Cuándo | Qué necesita |
|---|---|---|---|
| **Visitante** que llegó por Instagram | Teléfono, sin cuenta | Viendo el Reel de una coreo que le gustó | Ver cuándo es, cuánto cuesta, quién la dicta y dónde, y reservar en menos de dos minutos |
| **Alumna** con cuenta | Teléfono | Mirando el calendario o el link que le mandaron | Entender que se paga aparte de sus clases del pack, y reservar |
| **Owner** (Felipe o Carla) | Computador | Después de acordar con la profesora fecha, sala y coreo | Crear la clase en cinco minutos, fijar el precio, publicarla, compartir el link |
| **Admin** | Computador | Lo mismo que owner, sin tocar el precio | Crear y editar la clase con el precio por defecto |
| **Profesora** | Teléfono | Antes de la clase | Verla en su grilla e inscritas igual que una clase normal. En v1 la propone por WhatsApp |

## 3. Alcance

1. Una **clase especial** es una fila más de `clases`, con `tipo = 'especial'`, sin `horario_id`,
   creada una a una desde el portal de administración. Tiene título de coreografía, descripción,
   Reel de Instagram, portada propia, estilo (curso), dificultad propia, precio propio, fecha y
   hora, duración, sede, profesora y cupo.
2. **Formulario de creación y edición** en `app/(admin)/admin/especiales/`, para admin y owner.
   El precio solo lo edita **owner**; admin ve el valor por defecto y no lo cambia.
3. **Video incrustado desde Instagram, sin el script de Instagram**: se guarda el código del Reel
   y se incrusta como iframe a `instagram.com/reel/<código>/embed/` detrás de una fachada que lo
   monta solo cuando la persona lo toca (§8.7). Sin Reel no se publica. **No se suben videos**:
   la licencia de la música la pone Instagram, un `.mp4` alojado acá no la tiene.
4. **Portada propia**, una foto subida en el formulario. Es lo que se ve antes de tocar el Reel y
   lo que sale al compartir el link. **Es obligatoria y no es opcional por gusto**: Open Graph no
   puede leer nada de un iframe (§8.7), así que sin portada el link en WhatsApp sale sin imagen.
   Sin portada no se publica.
5. **Estados** `borrador` → `publicada` → (`cancelada` | realizada por el paso del tiempo). Solo
   las publicadas son visibles fuera del admin.
6. **Página pública** `/clases-especiales`: las publicadas que aún no pasaron, en orden de fecha.
   Se ve sin cuenta.
7. **Página pública por clase** `/clases-especiales/[slug]`, compartible por Instagram: Reel
   grande, ficha, cupos libres, botón de reservar. Open Graph con la portada propia.
8. **Entrada en la sección Planes** de la landing: una fila más, después de los cuatro packs, con
   "Clases especiales", el texto "desde $X" calculado sobre las publicadas y el enlace **"Ver
   clases especiales"**. Si no hay ninguna publicada, la fila no aparece.
9. **Compra aparte** (§8.1): reservar una especial crea una compra por su precio, pagada por
   transferencia declarada como un pack. La reserva nace **pendiente de pago y ocupa cupo** hasta
   que admin aprueba o hasta que expira (§8.2).
10. **Cancelación** por la alumna y por la academia, con las reglas de §8.3.
11. **Lo que este PRD deja registrado para la liquidación**: cada compra de especial queda con
    su monto, su clase y su sede, y las reservas confirmadas quedan amarradas a esa compra. La
    **regla de pago** de la profesora la define PRD-0009 §8 y el **cálculo** lo hace PRD-0010
    parte 3. Acá no se calcula nada.
12. Las especiales **aparecen en la grilla de la profesora** y en `inscritas_de_clase` sin trabajo
    extra, porque viven en `clases`.
13. **Métricas**: cuentan en ocupación por clase, cancelaciones y atribución a profesora, con el
    precio completo de la compra. No cuentan en "por horario", porque no tienen uno.

## 4. Fuera de alcance

- **Pago en línea.** Sigue siendo transferencia declarada hasta que exista Flow (ADR-0003). Cuando
  llegue, la reserva pendiente pasa a confirmada en el webhook y la retención de cupo de §8.2 deja
  de importar.
- **Que la profesora cree la clase desde su portal.** En v1 la propone por WhatsApp y la crea
  admin. Cuando se haga, extendiendo `solicitudes_horario` con un tipo `especial`.
- **Talleres de varias sesiones.** Una especial es una fecha. Si hace falta, se crean varias.
- **Lista de espera** cuando se llena.
- **Correo de marketing** al publicar. El correo transaccional de reserva, aprobación y
  cancelación sale igual que hoy.
- **Teens.** Las especiales son para 15+.
- **Precio distinto por sede.** El precio es por clase; la sede solo entra en la liquidación.
- **Cancelación automática por pocas alumnas.** El campo `minimo_alumnas` es informativo.
- **Devolución automática de dinero.** Toda devolución la registra un admin a mano (§8.3).
- **Pagar una especial con créditos del pack.** Descartado en §8.1.
- **El valor del precio por defecto, el variable y el sueldo base de la profesora.** Separados a
  PRD-0009 §8 el 10/09/2026: no tocan la migración y no tienen por qué bloquearla.
- **Sacar la portada desde Instagram automáticamente.** El oEmbed de Meta exige una app con
  revisión y devuelve URLs que vencen (§8.7). La portada se sube a mano.

## 5. Flujo principal

### 5.1 Owner crea la clase

1. Entra a `/admin/especiales` → "Nueva clase especial".
2. Llena: título de la coreografía, canción y artista, descripción corta, estilo (uno de los
   cursos activos, Teens excluido), dificultad, profesora, sede, fecha, hora, duración, cupo,
   precio (si es owner; admin ve el valor por defecto bloqueado), **pega el link del Reel** y
   **sube la portada**.
3. Guarda como **borrador**. Ve la vista previa tal como la vería la visitante, incluida la
   fachada del Reel: si el link está mal o el Reel es privado, se nota acá.
4. Aprieta **Publicar**. La página pública y la fila en Planes se actualizan (webhook de
   revalidación, el mismo de PRD-0015). Copia el link y lo comparte.

### 5.2 La visitante reserva

1. Abre el link desde Instagram en el teléfono. Ve la portada, el título, la profesora, la fecha,
   la sede con dirección, el precio y cuántos cupos quedan. Toca la portada y se carga el Reel.
2. Aprieta **Reservar por $X**. Si no tiene cuenta, pasa por `/entrar` y vuelve a la misma clase.
3. Ve la pantalla de transferencia con los datos de la cuenta y el monto, igual que al comprar un
   pack, y **declara la transferencia**. En ese momento nace, en una sola transacción, la compra
   `pendiente` y la reserva `pendiente_pago`, **y el cupo queda tomado**. La pantalla dice hasta
   cuándo lo tiene tomado (§8.2).
4. Admin ve la compra en la bandeja de transferencias, con la clase al lado, y la aprueba. La
   compra pasa a `pagada`, la reserva a `confirmada`, y le llega el comprobante por correo.
5. La ve en "Mis clases" con la misma tarjeta que una clase normal, marcada como especial y con
   su precio.

### 5.3 La profesora la dicta

Aparece en su grilla semanal como un bloque más, con el título de la coreografía en vez del
nombre del curso. Las inscritas se ven con `inscritas_de_clase`, sin cambios. Después de la
clase, la liquidación del período la incluye con la regla de PRD-0009 §8.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Se publica sin Reel o sin portada | No se puede: Publicar exige las dos. Un borrador puede no tenerlas |
| El link no es de un Reel de Instagram | Se rechaza al guardar. Se acepta `instagram.com/reel/<código>` y `instagram.com/p/<código>`; de ahí se extrae el código y se normaliza |
| El Reel se borra o la cuenta pasa a privada después de publicar | El iframe muestra el error de Instagram. La ficha sigue en pie con la portada. Felipe lo considera **marginal** (10/09/2026): la cuenta es de negocios y va a seguir pública. No se construye detección |
| Portada pesada o en formato raro | Se rechaza al subir: hasta 1 MB, `jpg` o `webp`, se recomienda vertical 4:5. La portada del propio Reel sirve |
| La sede o la profesora tienen otra clase a esa hora | Se rechaza al guardar: la validación de solape mira `clases` publicadas y de parrilla en la ventana de duración. Es una función de base de datos |
| Se llena mientras la visitante mira el Reel | `reservar_especial()` rechaza con "La clase está llena": la fila de la clase se bloquea con `for update`. Las pendientes de pago no vencidas **cuentan** como tomadas |
| La alumna declara y nadie aprueba | La reserva pendiente expira sola según §8.2, libera el cupo y la compra pasa a `expirada`. Si transfirió de verdad y admin lo ve después, admin la puede reactivar si hay cupo, o devolver la plata |
| La alumna cancela | Libera el cupo. No se le devuelve plata automáticamente: si la pide, admin la resuelve a mano (§8.3) |
| La academia cancela | Las reservas pasan a canceladas y liberan cupo. Las compras pagadas quedan marcadas **por reembolsar** y admin las resuelve a mano. Nada de plata se mueve solo |
| Admin crea y no hay precio por defecto cargado | `crear_especial()` falla con "Falta el precio por defecto: lo carga owner en parámetros". Owner sí puede crear, pasando el precio. Así la migración no necesita inventar un número |
| Owner cambia el precio con reservas ya hechas | Las compras hechas no cambian: el monto quedó congelado. Solo afecta a las siguientes |
| Se edita fecha u hora con reservas hechas | Se permite, con aviso de cuántas reservas hay. No manda correo (fuera de alcance): hay que avisar por WhatsApp |
| Se intenta borrar una especial publicada | No se borra: se cancela. Un borrador sin reservas sí se puede borrar |
| En el Reel aparece alguien más que la profesora | El formulario pide confirmar que solo aparece ella, o que hay autorización firmada de quien más aparezca. Menores identificables: regla de `CLAUDE.md` |

## 7. Modelo de datos

**Decisión de diseño: extender `clases`, no crear una tabla nueva.** Todo lo que cuesta plata y
ya está probado —`reservar()`, el trigger de devolución, el bloqueo de cupo, `inscritas_de_clase`,
la grilla de la profesora, las métricas de ocupación— trabaja sobre `clases`. Una especial es una
clase que no vino de un horario y que se paga con una compra propia.

### 7.1 `clases`

```sql
alter table public.clases
  -- Las especiales no vienen de un horario. El unique (horario_id, fecha) sigue
  -- funcionando: los null no chocan entre sí. generar_clases() no se toca.
  alter column horario_id drop not null,

  add column if not exists tipo text not null default 'parrilla'
    check (tipo in ('parrilla', 'especial')),

  -- Ficha de la especial. Todo null en las de parrilla.
  add column if not exists slug text,
  add column if not exists titulo text,
  add column if not exists cancion text,
  add column if not exists descripcion text,
  -- Solo el código del Reel, no la URL entera: la URL se arma al mostrar y
  -- así no se guardan parámetros de tracking ni variantes.
  add column if not exists reel_codigo text,
  add column if not exists portada_path text,
  add column if not exists dificultad text
    check (dificultad in ('principiante', 'intermedio', 'avanzado')),
  add column if not exists fin timestamptz,
  add column if not exists precio_clp int check (precio_clp >= 0),
  add column if not exists publicada_at timestamptz,
  add column if not exists creada_por uuid references public.perfiles (id),
  add column if not exists minimo_alumnas smallint;

alter table public.clases add constraint clases_tipo_coherente check (
  (tipo = 'parrilla' and horario_id is not null and titulo is null and precio_clp is null)
  or
  (tipo = 'especial' and horario_id is null and titulo is not null and slug is not null
   and precio_clp is not null)
);

-- Publicar exige Reel y portada.
alter table public.clases add constraint clases_publicada_completa check (
  publicada_at is null or tipo = 'parrilla'
  or (reel_codigo is not null and portada_path is not null)
);

create unique index if not exists clases_slug_unico on public.clases (slug) where slug is not null;
```

**`curso_id` se mantiene obligatorio** y es lo que el formulario llama "estilo". Así ninguna
consulta que hace `join cursos` se rompe.

### 7.2 `compras` — una compra puede ser de una clase

```sql
alter table public.compras
  alter column plan_id drop not null,
  add column if not exists clase_id uuid references public.clases (id) on delete restrict,
  -- Devoluciones, siempre manuales (§8.3).
  add column if not exists reembolso_monto_clp int check (reembolso_monto_clp >= 0),
  add column if not exists reembolsada_por uuid references public.perfiles (id),
  add column if not exists reembolsada_at timestamptz,
  add column if not exists reembolso_nota text;

-- O es de un plan o es de una clase, nunca las dos ni ninguna.
alter table public.compras add constraint compras_plan_o_clase check (
  (plan_id is not null and clase_id is null) or (plan_id is null and clase_id is not null)
);

-- Estados nuevos: `expirada` (nadie aprobó a tiempo) y `por_reembolsar` (la
-- academia canceló una clase pagada). Se agregan al check existente.
```

`cantidad_clases` queda en 1 y `monto_clp` en el precio de la especial al momento de declarar,
congelado como siempre. Una compra de clase **no acredita créditos**: `acreditar_compra` la
reconoce por `clase_id` y en vez de crear un lote confirma la reserva.

### 7.3 `reservas` — pendiente de pago y sin crédito

```sql
alter table public.reservas
  alter column credito_id drop not null,
  add column if not exists compra_id uuid references public.compras (id) on delete restrict,
  -- Hasta cuándo una pendiente ocupa cupo (§8.2).
  add column if not exists expira_at timestamptz;

-- Estado nuevo `pendiente_pago` y `expirada` en el check existente.

-- Una reserva se paga con un crédito o con una compra, nunca las dos.
alter table public.reservas add constraint reservas_credito_o_compra check (
  (credito_id is not null and compra_id is null) or (credito_id is null and compra_id is not null)
);
```

**Cupo:** todo lo que cuenta cupo —`reservar()`, `reservar_especial()`, `lugaresLibres`,
`reservas_de_mis_clases`, las métricas— pasa a contar `estado in ('confirmada', 'asistio')`
**más** `(estado = 'pendiente_pago' and expira_at > now())`. Es un cambio en cinco lugares y hay
que hacerlo en todos: una pendiente que cuenta en un lado y no en otro es un cupo vendido dos veces.

### 7.4 `parametros`

```sql
-- La retención es el mecanismo de §8.2; el número es editable por owner.
-- 24 h es una propuesta, no un dato del negocio: se puede cambiar sin desplegar.
insert into public.parametros (clave, valor, descripcion) values
  ('especial_retencion_horas', '24',
   'Horas que una reserva pendiente de pago de una clase especial retiene el cupo.')
on conflict (clave) do nothing;

-- El precio por defecto NO lo inserta la migración: no se inventa un precio.
-- Lo carga owner (PRD-0009 §8). Mientras no exista la fila, admin no puede crear
-- especiales y owner tiene que pasar el precio a mano.
-- clave: especial_precio_default_clp
```

### 7.5 Funciones

| Función | Qué hace |
|---|---|
| `crear_especial(...)` / `editar_especial(...)` | Validan rol (admin+), solape, coherencia. **Solo owner puede pasar `precio_clp`**: si lo manda un admin, se ignora y se usa `especial_precio_default_clp`. Si esa fila no existe y quien crea es admin, falla con mensaje claro |
| `publicar_especial(id)` | Exige Reel, portada, fecha futura, profesora y sede |
| `reservar_especial(clase_id, actor, titular, nota)` | En una transacción: bloquea la clase, cuenta cupo con pendientes vigentes, crea la compra `pendiente` con `clase_id` y la reserva `pendiente_pago` con `expira_at`. Es `reservar()` con otro medio de pago, no otra función suelta: comparte el bloqueo y el conteo |
| `acreditar_compra` (extendida) | Si la compra tiene `clase_id`: reserva → `confirmada`, compra → `pagada`. Si la reserva ya expiró y hay cupo, la reactiva; si no hay cupo, deja la compra `pagada` sin reserva y avisa a admin para devolver |
| `expirar_reservas_pendientes()` | Marca `expirada` la reserva y la compra cuando `expira_at < now()`. La llama el cron diario **y** `reservar_especial()` antes de contar cupo, para no depender del cron |
| `cancelar_reserva` (extendida) | Si la reserva tiene `compra_id`: libera el cupo, no toca plata. La compra queda `pagada` con la reserva cancelada, visible en admin por si la alumna pide devolución |
| `devolver_creditos_de_clase` (extendida) | Para reservas con `compra_id` pagada: compra → `por_reembolsar`. Las pendientes → `expirada` |
| `registrar_reembolso(compra_id, monto, nota)` | Admin+. Compra → `reembolsada`, con monto, autor y fecha. Nunca automático |

### 7.6 Storage — bucket privado, URL firmada

Un solo bucket, **`portadas-especiales`**, **privado** (decidido por Felipe el 10/09/2026: cuesta
lo mismo que público y evita que las portadas queden enumerables). Sin política de lectura para
`anon` ni `authenticated`; escritura y lectura solo desde el servidor con la service role. Un
archivo por clase nombrado por su `id`. La columna es **`portada_path`**, la ruta dentro del
bucket, nunca una URL.

Cómo se sirve:

- La página pública genera la **URL firmada al renderizar**, con vigencia de 30 días: más que lo
  que una especial pasa publicada. Las páginas se revalidan por webhook al publicar y por tiempo
  (la lista suelta las que ya pasaron), así que una URL firmada no alcanza a vencer dentro de una
  página cacheada. El token no se guarda en ninguna parte.
- La imagen de Open Graph **no usa URL**: `opengraph-image.tsx` descarga el objeto con la
  service role y lo compone con satori.
- El formulario de admin y la vista previa firman igual, en el servidor.

**No hay bucket de videos**: el video es el Reel.

### 7.7 Lo que cambia en consultas existentes

| Dónde | Cambio |
|---|---|
| `getCalendario` | Traer `tipo, titulo, precio_clp, portada_path` y firmar la portada en el servidor; incluir `publicada_at is not null or tipo = 'parrilla'`; contar pendientes vigentes en `tomados` |
| `clases_lectura_publica` (RLS) | Hoy `using (true)`. Pasa a `tipo = 'parrilla' or publicada_at is not null`. **Mirar las otras políticas de `clases` antes**: se suman con OR |
| `metricas_*` → `atribucion` | Rama nueva: reserva con `compra_id` atribuye `compras.monto_clp` entero |
| `metricas_*` → `por_horario` | El `join horarios` deja fuera a las especiales, que es lo correcto. Se documenta |
| `GrillaSemanal` | `titulo` en vez de `cursos.nombre` cuando `tipo = 'especial'` |
| Bandeja de compras (admin) | Mostrar la clase cuando `clase_id` no es null, y el botón de reembolso |
| `/privacidad` §5 | ✅ **Hecho el 10/09/2026.** Fila nueva en la tabla de proveedores: **Meta (Instagram)** · "Reproducir los videos de Instagram incrustados en las clases especiales, solo si tú los activas" |
| `/privacidad` §9 | ✅ **Hecho el 10/09/2026.** Párrafo nuevo: los videos no se cargan solos; se ve una portada nuestra y el video carga solo al tocar "Ver el Reel en Instagram"; al reproducirlo Meta puede recoger datos y dejar sus cookies bajo su política; si no se activa, no se envía nada a Meta. Fecha de actualización de la política: 10/09/2026 |

## 8. Decisiones — cerradas por Felipe el 09/09/2026; Reel y alcance el 10/09

### 8.1 Se compran aparte, no con créditos

Las especiales tienen precios distintos entre sí y distintos del crédito de pack. Un crédito
universal vale lo mismo para cualquier clase de la parrilla; una especial no es de la parrilla.
Consecuencia para el copy: "un pack sirve para cualquier clase" pasa a "cualquier clase **de la
parrilla**" en `CONTEXT.md` §5.b (ya dice eso) y en la sección Planes.

La alternativa A (N créditos por especial) se descartó porque convertía el precio en un rango
—un crédito vale entre $6.000 y $8.500 según el pack— y solo permitía saltos enteros.

### 8.2 El cupo se bloquea al declarar la transferencia

Una reserva `pendiente_pago` **ocupa cupo**, y no se puede reservar más allá del cupo de la clase
contando las pendientes vigentes. Esto invierte para las especiales la regla de PRD-0017 §7.1
(una compra pendiente no retiene cupo), y tiene sentido: allá se compraba un pack sin fecha, acá
se compra un asiento en una clase con fecha.

**Mecanismo de expiración**, para que un cupo no quede tomado por alguien que nunca transfirió.
Felipe decidió el bloqueo; los números de abajo son propuesta de este PRD y viven en `parametros`
para cambiarlos sin desplegar:

- `expira_at = min(declarada_at + retención, inicio de la clase − 2 horas)`.
- La **retención** es `especial_retencion_horas`, que nace en **24 horas**. Es tiempo de sobra
  para una transferencia y corto para bloquear a otras. Si la clase es en menos de 26 horas, la
  ventana se acorta sola.
- La expiración es **perezosa más barrido**: `reservar_especial()` expira las vencidas de esa
  clase antes de contar cupo, así que el cupo se libera en el momento en que alguien lo necesita,
  sin depender de nadie. El cron diario además barre todas, para que la bandeja de admin y las
  métricas no muestren pendientes muertas.
- La alumna ve en pantalla "tu cupo queda tomado hasta el jueves a las 18:00". Si expira y ella
  sí transfirió, admin lo ve al aprobar: `acreditar_compra` la reactiva si hay cupo, y si no,
  deja la compra pagada sin reserva marcada para devolver.

### 8.3 Cancelación: la plata no se mueve sola

- **Cancela la alumna:** libera el cupo. **No se devuelve dinero automáticamente.** Si lo pide
  explícitamente, un admin lo resuelve a mano con `registrar_reembolso`, que deja monto, autor y
  fecha. La ventana de 30 minutos no aplica al dinero: aplica solo a si libera cupo con o sin
  aviso, que en la práctica es siempre.
- **Cancela la academia:** las compras pagadas de esa clase quedan `por_reembolsar` y aparecen en
  la bandeja de admin. Alguien transfiere y registra el reembolso. Esto **no lo dijo Felipe**
  explícitamente; es la lectura coherente de "nada automático": cuando la academia falla, la
  deuda queda registrada aunque el pago sea manual.
- Las reservas `pendiente_pago` de una clase cancelada pasan a `expirada`: no hay plata que
  devolver porque no se aprobó ninguna.

### 8.4 Precio: lo define owner en cada clase, con un default en `parametros`

No hay un precio fijo. Owner lo escribe al crear cada especial: puede ser premium o más barato que
la parrilla. Admin no lo toca: crea con el valor por defecto, `especial_precio_default_clp`.

**El valor del default no lo decide este PRD ni lo inserta la migración.** Vive en PRD-0009 §8,
con la propuesta de $12.000 y sus razones, esperando confirmación. Mientras no esté cargado,
admin no puede crear especiales (§6). Es un default, no un precio: cada clase lleva el suyo, y ese
número se congela en la compra.

### 8.5 Variable de la profesora → PRD-0009 §8

Felipe lo decidió el 09/09/2026: **50 % de lo recaudado después de descontar la sala**, $0 si el
neto es negativo. La tabla con los números, el porqué del neto y el supuesto pendiente de "sin
sueldo base" se movieron a **PRD-0009 §8** el 10/09/2026, porque no tocan esta migración: el
cálculo lo hace la liquidación de PRD-0010 parte 3 y lo que este PRD necesita garantizar es que la
compra quede registrada con monto, clase y sede (§3.11).

### 8.6 Quién crea

Admin y owner crean y editan. **Solo owner define el precio.** Se valida en la función de base de
datos, no en el formulario.

### 8.7 El Reel: sin script de Instagram, y con portada propia (resuelto el 10/09/2026)

Felipe pidió resolver dos cosas: si el embed necesita el script de Instagram y qué implica para
las cookies, y si el embed sirve para Open Graph o hace falta una imagen propia. Se verificó
contra Instagram el 10/09/2026, no de memoria.

**1. No hace falta `embed.js`.** El código oficial de Instagram es un `<blockquote>` más
`<script src="//www.instagram.com/embed.js">`. Se leyó ese script: lo único que hace es
reemplazar el blockquote por un `<iframe>` a `<permalink>embed/?cr=1&v=14&wp=<ancho>` y escuchar
un `postMessage` de tipo `MEASURE` con la altura para ajustar el iframe. Nada más. Así que el
sitio arma ese iframe solo, sin cargar un byte de JavaScript de Meta en nuestra página:

- `GET https://www.instagram.com/reel/<código>/embed/` responde **200 sin `X-Frame-Options`**,
  o sea, está hecho para ir en un iframe. La URL normal del Reel no se puede enmarcar; la de
  `/embed/` sí.
- La altura se resuelve con un contenedor de proporción fija (un Reel embebido es 9:16 más la
  cabecera de Instagram). Opcional: escuchar el mismo `MEASURE` que escucha `embed.js`, desde el
  origen `https://www.instagram.com`, en diez líneas. Si Instagram cambia ese mensaje, queda la
  proporción fija, que es el fallback.
- Consecuencia de no tener el script: ningún JavaScript de Meta corre en nuestro origen. Lo que
  Meta ve es lo que pasa **dentro** de su iframe, y solo cuando existe.

**2. Cookies: se ponen al primer request, por eso la fachada.** En esa misma prueba, la primera
respuesta de `/embed/` trae `Set-Cookie: mid=…; domain=.instagram.com; Max-Age=34560000` (400
días), incluso para un código que no existe. Es decir: **en el momento en que el iframe se monta,
Instagram deja una cookie de terceros**, sin que la persona haya apretado play. Safari la bloquea
y Firefox la aísla por sitio; Chrome la deja tal cual.

Lo que eso implica para nosotros:

- La fachada (§9.11) no es un detalle de rendimiento: es lo que hace que **nada de Instagram
  exista hasta que la persona toca**. Antes del toque se ve nuestra portada y un botón. Es el
  patrón "carga al hacer clic" que las autoridades de protección de datos europeas aceptan para
  embeds sin banner previo, y es más de lo que la práctica chilena pide.
- Ni la Ley 19.628 ni la 21.719 traen un régimen de cookies como el europeo; lo que exigen es
  informar el tratamiento. `/privacidad` hoy afirma que **no hay cookies de seguimiento entre
  sitios**, y con el Reel eso deja de ser cierto después del toque. Se corrige en §5 (Meta como
  proveedor) y §9 (la línea del toque), como dice §7.7. **No hace falta un banner de cookies.**
- El botón dice lo que va a pasar: **"Ver el Reel en Instagram"**, con una línea chica debajo:
  "Se carga desde Instagram". Eso es el consentimiento: una acción explícita e informada.

**Decidido por Felipe el 10/09/2026: embed tras un clic.** La portada se ve de entrada y el Reel
carga solo si la persona lo pide. Así no hace falta banner y la página carga más rápido. La
política de privacidad ya lo dice (§7.7): al reproducir un video incrustado de Instagram, Meta
puede recoger datos, y eso ocurre solo si la persona lo activa.

**3. Open Graph no lee iframes: la portada propia es obligatoria.** WhatsApp, Instagram y
cualquier otro que arma la vista previa de un link lee el HTML de **nuestra** página y toma
`og:image`, `og:title` y `og:description`. No ejecuta JavaScript ni mira dentro de un iframe,
así que el embed no aporta nada a la vista previa. Sacar la imagen desde Instagram tampoco es
opción razonable:

- El oEmbed de Meta (`graph.facebook.com/instagram_oembed`) exige una app de Facebook con la
  función "oEmbed Read" aprobada en revisión, y devuelve una `thumbnail_url` firmada que vence.
  Habría que descargarla y alojarla nosotros: copiar un asset de Meta para una academia de cinco
  profesoras no vale la revisión ni la zona gris.
- Los atajos viejos (`/media/?size=l`, `?__a=1`) están cerrados hace años.

**Resolución:** una **portada subida aparte**, que Felipe aceptó porque es una foto y no tiene el
problema de la música. Una sola imagen cumple dos funciones: es el póster de la fachada antes del
toque y la fuente de `og:image`. La portada del propio Reel sirve. Especificación: `jpg` o `webp`,
hasta 1 MB, vertical 4:5 recomendado. Para Open Graph, `app/clases-especiales/[slug]/opengraph-image.tsx`
compone 1200×630 con la portada, el título, la profesora y la fecha, igual que hace
`app/opengraph-image.tsx` con satori, descargando el objeto con la service role. Bucket
`portadas-especiales`, **privado con URL firmada** (§7.6, decidido por Felipe el 10/09/2026).

**Riesgo que Felipe da por marginal (10/09/2026):** que un Reel deje de estar disponible. La
cuenta es de negocios y va a seguir pública. Si pasa igual, la ficha sobrevive con la portada.

## 9. Reglas de negocio

1. Solo `admin` o superior crea y edita especiales. Solo `owner` fija `precio_clp`.
2. No se publica sin Reel, sin portada, sin profesora, sin sede, sin fecha futura.
3. No se guarda una especial que se solape, en sede o en profesora, con otra clase publicada o
   con una de parrilla. La duración manda: 19:30 choca con 20:00.
4. Una especial publicada no se borra; se cancela con motivo.
5. Reservar crea compra y reserva **en una sola transacción**, con la clase bloqueada y el cupo
   contado incluyendo pendientes vigentes. Ninguna operación desde el cliente.
6. Una reserva pendiente ocupa cupo hasta `expira_at`. Después no cuenta, aunque siga en la tabla
   hasta que el barrido la marque.
7. El dinero no se devuelve solo. Toda devolución la registra un admin con monto, autor y fecha.
8. El cupo por defecto es 22. Owner puede bajarlo; no subirlo.
9. Las especiales son para 15+. El formulario no ofrece Teens como estilo.
10. `precio_clp` de compras ya hechas no se recalcula nunca.
11. Nada de `instagram.com` se carga hasta que la persona toca "Ver el Reel en Instagram". Ni el
    iframe, ni `embed.js` (que no se usa nunca), ni una imagen.

## 10. Criterios de aceptación

Se prueban **con el artefacto que toca la persona**, en staging, antes del `db push` a producción.

- [ ] Owner crea una especial con un Reel real de @XO.dancestudioo y una portada, la guarda como
      borrador y **no aparece** en `/clases-especiales` ni en la landing.
- [ ] Owner la publica: aparece en `/clases-especiales`, en su página propia y en la fila de
      Planes con "desde $X" correcto y el texto "Ver clases especiales".
- [ ] Sin sesión, desde un **teléfono**: la pestaña de red no muestra ninguna petición a
      `instagram.com` hasta tocar "Ver el Reel en Instagram"; al tocar, el Reel se reproduce.
- [ ] El link de la página propia, pegado en WhatsApp, muestra **nuestra portada** y el título.
- [ ] Una visitante sin cuenta aprieta "Reservar por $X", entra por magic link **abriendo el enlace
      del correo**, vuelve a la misma clase, declara la transferencia. Hay una compra `pendiente`
      con `clase_id` y una reserva `pendiente_pago` con `expira_at`; el cupo libre bajó en 1.
- [ ] Con el cupo en 1 y una pendiente vigente, otra alumna recibe "La clase está llena".
- [ ] Se adelanta `expira_at` a mano; la siguiente `reservar_especial()` de otra alumna libera esa
      pendiente y entra.
- [ ] Admin aprueba la compra: reserva `confirmada`, compra `pagada`, comprobante por correo
      **abierto**. No se creó ningún lote de créditos ni movimiento en el libro.
- [ ] La alumna cancela desde "Mis clases": cupo liberado, compra sigue `pagada`, ningún
      movimiento de dinero. Admin registra un reembolso a mano y la compra queda `reembolsada`.
- [ ] La academia cancela desde admin: las pagadas quedan `por_reembolsar` en la bandeja.
- [ ] Sin `especial_precio_default_clp` cargado, admin no puede crear y owner sí. Con la fila
      cargada, admin crea con ese valor aunque mande otro; owner fija el suyo.
- [ ] Guardar una especial en Diaguitas el jueves a las 20:00 se rechaza por solape con Reggaeton
      Femme 19:30.
- [ ] La especial aparece en la grilla de la profesora con su título e `inscritas_de_clase` la
      lista sin las pendientes.
- [ ] El tablero de owner suma su compra en ingresos y atribución sin romper la conciliación de
      créditos (que no la toca).
- [x] `/privacidad` §5 lista a Meta y §9 dice lo del toque. Hecho el 10/09/2026, antes que el
      resto, porque no depende de la migración.
- [ ] La portada en la página pública se sirve con URL firmada. La misma ruta del bucket sin
      token responde error; el bucket no lista objetos para `anon`.
- [ ] `npm run build` y `npm test` en verde. `anon` no ve borradores por la API REST.

## 11. Métrica de éxito

**Porcentaje de especiales dictadas cuyo recaudado cubrió la sala y dejó margen** en los primeros
30 días, con la regla de PRD-0009 §8. Si la mitad se dicta con la profesora en $0, el precio o el
formato están mal.

## 12. Riesgos y supuestos

- **Precio por defecto ($12.000) y sin sueldo base: confirmados por Felipe el 10/09/2026** en
  PRD-0009 §8. La migración igual no inserta el precio: lo carga owner en la fase 7.
- **Dependencia de Instagram.** Felipe la da por marginal: cuenta de negocios, pública. Si un Reel
  se borra o Instagram cambia `/embed/`, la ficha pierde el video y sobrevive con la portada.
- **El `/embed/` como iframe no es API documentada.** Es exactamente lo que `embed.js` genera y
  lleva años estable, pero puede cambiar sin aviso. La fachada aísla el daño a un recuadro.
- **Cookies de Meta.** Se ponen al montar el iframe, no al apretar play. Por eso nada se monta
  antes del toque y `/privacidad` lo dice (§8.7).
- **El gancho es más débil que un video propio.** El Reel no se reproduce solo ni sin sonido. Se
  compensa con una buena portada.
- **Reservas pendientes fantasma** si el barrido y la expiración perezosa se desincronizan del
  conteo en la interfaz. Por eso §7.3 exige tocar los cinco lugares a la vez.
- **Canibalización.** Especiales más baratas que la parrilla pueden vaciarla. Se mira en la
  ocupación por horario del tablero.
- **Consentimiento de imagen.** El Reel es de la profesora. Si aparece una alumna, autorización
  firmada. El formulario lo pregunta.
- **Duración.** Una hora salvo que se diga otra cosa; con 90 minutos hay que revisar la grilla.

## 13. Notas de implementación

Se llena al terminar.

## 14. Para retomar — estado al 10/09/2026

**Migración de Pau (`20260908150000_horarios_pau_martes_y_jueves.sql`)**

- [x] Aplicada y verificada en **staging** y en **producción** el 09/09/2026, con aprobación en cada
      caso. Antes y después en producción: horarios activos de Pau de lunes 20:00 y miércoles
      20:00 a **martes 20:00 y jueves 19:30**; 19 clases viejas borradas (sin reservas); 21 nuevas,
      con la Girly del 08/09; las del 31/08 y 02/09 intactas; total de clases de 73 a 80 (las 5
      extra son de otras profesoras, que `generar_clases()` alcanzó hasta el 17/11). Reservas,
      créditos y movimientos: 0 antes y después. La rama que cancela con reserva y devuelve el
      crédito **no se ejercitó** en ninguna base.
- [x] La CLI estuvo enlazada a producción desde el push de Pau. **Re-enlazada a staging
      (`ybopuahlzbjkkwumkllk`) el 10/09/2026** para la fase 2. Verificar igual antes de cada
      `db push`: un `link` para otra cosa la cambia sin avisar.
- [ ] La rama `horario-pau-y-prd-0018` tiene la migración que ya corre en producción. Mergear a
      `main` pronto.

**Cron de generación de clases**

- [x] Arreglado el 09/09/2026: `CRON_SECRET` en Vercel con el mismo valor que `CRON_SECRETO`. Una
      invocación disparada por Vercel respondió **200**. Creó 0 porque la migración ya había
      materializado hasta el 17/11. **La primera corrida que debería agregar algo es la del 10/09
      a las 06:00 UTC**, con la Reggaeton Femme del jueves 19/11. Deuda menor: unificar los dos
      nombres.

**Este PRD**

- [x] §8 cerrado el 09/09/2026: compra aparte, cupo bloqueado al declarar con expiración,
      devoluciones manuales, variable 50 % del neto de sala, precio por owner con default, admin y
      owner crean. Nombre: "Clases especiales".
- [x] 10/09/2026: Reel resuelto (§8.7): iframe a `/embed/` sin `embed.js`; cookies solo al
      tocar; Open Graph con portada propia obligatoria. "Miniatura" pasó a llamarse **portada**
      en todo el PRD y el plan.
- [x] 10/09/2026: fase 0 del plan recortada a lo que necesita la migración. Precio por defecto,
      variable y sueldo base separados a **PRD-0009 §8**.
- [x] 10/09/2026: Felipe aprobó el PRD, confirmó $12.000 y sin sueldo base (PRD-0009 §8), decidió
      bucket privado con URL firmada y embed tras un clic. `/privacidad` actualizada y desplegable.
- [ ] Fase 1 del plan: funciones puras y tests.
- [ ] Despliegues Preview en Error en Vercel de los últimos días, sin revisar.
