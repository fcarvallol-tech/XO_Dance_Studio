# PRD-0018 — Clases especiales

| Campo | Valor |
|---|---|
| **Estado** | ✅ **Aprobado por Felipe el 10/09/2026.** Fases 1 a 6 hechas y verificadas en **staging**: escenario por SQL 20/20 y recorrido con clics 25/25 (§13). Falta la **fase 7** (producción), y antes va **PRD-0019**, que es bloqueante. Precio por defecto ($12.000) y sin sueldo base confirmados en PRD-0009 §8. Bucket privado y embed tras un clic decididos el mismo día (§7.6, §8.7). Soltar el cupo tiene estado propio desde el 10/09 (§8.3.b) |
| **Autor** | Propuesto por Claude a pedido de Felipe Carvalho. Decisiones de §8: Felipe |
| **Fecha** | 8 de septiembre de 2026 · decisiones cerradas el 9 · Reel y alcance de fase 0 resueltos el 10 |
| **Hito** | Hito 3 — Reservas (extiende el calendario) · Hito 4 — Portales (formulario en admin) |
| **PRDs relacionados** | PRD-0006 (calendario y reservas) · PRD-0009 (portal de administración: parámetros y pago de la profesora, §8) · PRD-0010 (métricas: atribución y ocupación; liquidación, parte 3) · PRD-0014 (sección Planes) · PRD-0016 (horarios y sedes) · PRD-0017 (compras, créditos, `clases`) · **PRD-0019 (correo con registro y reintento: bloquea publicar la primera especial)** · ADR-0002 (créditos universales) |

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
| **Admin** | Computador | Lo mismo que owner, sin tocar el precio | Crear y editar la clase con el precio de arranque, que no puede cambiar |
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
- **Cancelación automática por pocas alumnas.** El campo `minimo_alumnas` es informativo, pero es
  **la palanca** contra el riesgo de que la profesora gane menos que en una clase normal (§12,
  PRD-0009 §8.3): el formulario muestra desde cuántas alumnas iguala el base con ese precio y esa
  sala, owner fija el mínimo con eso a la vista, y cancelar sigue siendo decisión de una persona.
- **Devolución automática de dinero.** Toda devolución la registra un admin a mano (§8.3).
- **Pagar una especial con créditos del pack.** Descartado en §8.1.
- **El variable y el sueldo base de la profesora.** Viven en PRD-0009 §8 desde el 10/09/2026: no
  tocan esta migración. El valor de arranque del precio sí quedó acá, en §8.4, porque la
  migración lo carga.
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
| La alumna suelta una reserva que todavía no aprueban | La reserva queda `liberada` y la compra `expirada`. El cupo se libera al instante. No hay plata que devolver porque nadie aprobó nada (§8.3.b) |
| La alumna cancela una reserva ya confirmada | Queda `cancelada` y libera el cupo. No se le devuelve plata automáticamente: si la pide, admin la resuelve a mano (§8.3) |
| Soltó el cupo y la transferencia igual llegó | `acreditar_compra` **no la reactiva**: la compra queda `por_reembolsar` y admin devuelve la plata. Reactivar una reserva que ella soltó sería meterla a una clase a la que dijo que no iba (§8.3.b) |
| La academia cancela | Las reservas pasan a canceladas y liberan cupo. Las compras pagadas quedan marcadas **por reembolsar** y admin las resuelve a mano. Nada de plata se mueve solo |
| Una especial a $0 (Felipe, 10/09/2026: anotado, hoy no aplica) | Se puede publicar: `puedePublicar` acepta $0. Reservarla no puede pasar por "declarar transferencia" de $0: cuando se use, `reservar_especial()` crea la compra ya `pagada` con monto 0 y la reserva `confirmada`, sin expiración. **Mientras no se necesite, `reservar_especial()` la rechaza con un mensaje claro**, para que el camino no exista a medias. El variable de la profesora en esa clase es $0 (PRD-0009 §8.3) |
| Admin crea y alguien borró el valor de arranque | `crear_especial()` falla con "Falta el precio por defecto: lo carga owner en parámetros". Owner sí puede crear, pasando el precio. La migración lo deja cargado en $12.000, así que esto solo pasa si se borra a mano (§8.4) |
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
  -- Informativo, sin automatismo. Es la palanca de PRD-0009 §8.3: con pocas
  -- alumnas la profesora gana menos que en una clase normal.
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

-- Estados nuevos en el check existente: `pendiente_pago`, `expirada` y
-- `liberada` (§8.3.b).

-- Una reserva se paga con un crédito o con una compra, nunca las dos.
alter table public.reservas add constraint reservas_credito_o_compra check (
  (credito_id is not null and compra_id is null) or (credito_id is null and compra_id is not null)
);
```

**Los tres finales de una pendiente** (§8.3.b): `liberada` cuando la alumna suelta el cupo,
`expirada` cuando se vence el plazo o cae la clase, `cancelada` cuando se cae una reserva que ya
estaba en pie. Ninguna de las tres toma cupo; la diferencia es para saber **por qué** se cayó.

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

-- El valor con el que nace el formulario. No es el precio de las especiales:
-- cada clase guarda el suyo y owner lo cambia al crearla (§8.4).
insert into public.parametros (clave, valor, descripcion) values
  ('especial_precio_default_clp', '12000',
   'Precio con el que nace el formulario de una clase especial. Editable por owner en cada clase.')
on conflict (clave) do nothing;
```

### 7.5 Funciones

| Función | Qué hace |
|---|---|
| `crear_especial(...)` / `editar_especial(...)` | Validan rol (admin+), solape, coherencia. **Solo owner puede pasar `precio_clp`**: si lo manda un admin, se ignora y se usa `especial_precio_default_clp`. Si esa fila no existe y quien crea es admin, falla con mensaje claro |
| `publicar_especial(id)` | Exige Reel, portada, fecha futura, profesora y sede |
| `reservar_especial(clase_id, actor, titular, nota)` | En una transacción: bloquea la clase, cuenta cupo con pendientes vigentes, crea la compra `pendiente` con `clase_id` y la reserva `pendiente_pago` con `expira_at`. Es `reservar()` con otro medio de pago, no otra función suelta: comparte el bloqueo y el conteo |
| `acreditar_compra` (extendida) | Si la compra tiene `clase_id`: reserva → `confirmada`, compra → `pagada`, cero lotes. Si la reserva ya expiró y hay cupo, la reactiva; si no hay cupo, la compra queda **`por_reembolsar`** (plata recibida sin cupo que dar) y aparece en la bandeja. Acepta compras `pendiente` y `expirada` |
| `expirar_reservas_pendientes()` | Marca `expirada` la reserva y la compra cuando `expira_at < now()`. La llama el cron diario **y** `reservar_especial()` antes de contar cupo, para no depender del cron |
| `cancelar_reserva` (extendida) | Si la reserva tiene `compra_id`: libera el cupo, no toca plata. La compra queda `pagada` con la reserva cancelada, visible en admin por si la alumna pide devolución |
| `devolver_creditos_de_clase` (extendida) | Para reservas con `compra_id` pagada: compra → `por_reembolsar`. Las pendientes → `expirada` |
| `registrar_reembolso(compra_id, monto, nota)` | Admin+. Compra → `reembolsada`, con monto, autor y fecha. Nunca automático. Solo compras de clase: devolver un pack implica retirar créditos y no es este camino |
| `borrar_borrador_especial(id)` | Admin+. Borra de verdad un borrador sin reservas (§6). Publicada, se cancela |
| `cupo_tomado(clase_id)` | El conteo de §7.3, una sola vez. Lo usan `reservar` y `reservar_especial`; el "quedan N cupos" de la página pública lo calcula el servidor con la service role, así que no se le concede a `anon` |
| `solape_de_especial`, `codigo_de_reel`, `slug_de` | Helpers. El solape mira parrilla programada y especiales publicadas; una de parrilla dura 60 min |

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

### 8.3.b Soltar el cupo es un estado propio (Felipe, 10/09/2026)

**Decidido por Felipe:** que la alumna suelte un cupo que todavía no le aprueban se registra con
un estado propio, `liberada`, distinto de la expiración por tiempo y de la cancelación normal.

| Estado | Cuándo | Quién lo escribe |
|---|---|---|
| `liberada` | La alumna soltó el cupo antes de que nadie aprobara | `cancelar_reserva` sobre una `pendiente_pago` |
| `expirada` | Se venció el plazo de §8.2, o la academia canceló la clase antes de aprobar | `expirar_reservas_pendientes` y `devolver_creditos_de_clase` |
| `cancelada` | Se cayó una reserva que ya estaba en pie (confirmada o con crédito) | `cancelar_reserva` y `devolver_creditos_de_clase` |

**Por qué importa y no es cosmética.** No es lo mismo que se arrepienta a que nadie le haya
aprobado a tiempo: la primera habla de la oferta —el precio, la coreo, la hora— y la segunda
habla de nosotros. Con un solo estado las dos serían la misma barra en el tablero y la conclusión
sería la equivocada. Por eso `metricas_demanda` devuelve `pendientes` con las soltadas y las
expiradas separadas, y con cuántas de esas expiraron porque cayó la clase.

**Consecuencia operativa, que es donde se paga el estado:** si la reserva quedó `liberada` y la
transferencia llega igual, `acreditar_compra` **no la reactiva**, haya cupo o no. La compra pasa a
`por_reembolsar` y se le devuelve la plata. Una `expirada`, en cambio, sí se reactiva si hay cupo,
porque ahí la alumna nunca dijo que no. Esa bifurcación no se puede escribir si los dos casos
comparten estado.

**Lo que no cambia:** una `liberada` no toma cupo, no atribuye ingresos a la profesora, y no
bloquea a la alumna para volver a reservar la misma clase —el índice único solo mira las que
están en pie—. Si la soltó por error, reserva de nuevo y listo.

**Lo que se decidió no hacer:** darle un estado propio también a la compra. La compra queda
`expirada` en los dos casos y el motivo lo lleva la reserva, que es una por compra. Dos columnas
diciendo lo mismo terminan diciendo cosas distintas.

### 8.4 Precio: lo define owner en cada clase, con un valor de arranque en `parametros`

No hay un precio fijo, y esto es lo primero que hay que entender de esta sección: **las clases
especiales no tienen precio**. Cada una tiene el suyo, porque una es un proyecto premium y otra
es una idea barata para llenar un horario.

**`especial_precio_default_clp` = $12.000 es el valor con el que nace el formulario**
(Felipe, 11/09/2026). No es una definición de precio: es lo que aparece escrito en el campo
cuando owner abre "Nueva clase especial", para no partir de una casilla vacía. Owner lo cambia
en cada clase, y el número que se congela en la compra es el de **la clase**, no el del
parámetro. Cambiar el parámetro no toca ninguna clase ya creada ni ninguna compra hecha.

Consecuencias de que sea un valor de arranque y no un precio:

- Vive en `parametros`, no en el código: se edita desde el Table Editor, sin desplegar.
- Lo inserta la migración. Antes no lo hacía —para no inventar un número— pero desde que Felipe
  lo confirmó, dejarlo vacío solo lograba que admin no pudiera crear nada el primer día.
- **Admin no lo edita**, ni en el formulario ni por la función: crea con el valor de arranque tal
  cual. Solo owner pasa un precio propio, y la validación está en la base (§8.6).
- Si alguien borra la fila, `crear_especial` le dice a admin qué falta en vez de adivinar un
  número (§6). Ese camino sigue existiendo y el escenario de la fase 3 lo prueba.
- El formulario muestra al lado desde cuántas alumnas la profesora iguala una clase normal con
  **ese** precio y esa sala (§12, PRD-0009 §8.3): el número de arranque no es una recomendación
  silenciosa.

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
- [ ] La alumna suelta una reserva que todavía no le aprueban: queda **`liberada`** (no
      `cancelada` ni `expirada`), la compra queda `expirada`, el cupo se libera al instante y
      puede volver a reservar la misma clase.
- [ ] Acreditar una compra cuya reserva quedó `liberada` **no** la reactiva aunque sobre cupo: la
      compra queda `por_reembolsar`.
- [ ] El tablero de owner muestra los cupos soltados por la alumna separados de los que
      expiraron, y de esos, cuántos fueron por una clase que canceló XO.
- [ ] La academia cancela desde admin: las pagadas quedan `por_reembolsar` en la bandeja.
- [ ] Con la fila cargada —que es como queda tras la migración—, admin crea con los $12.000
      aunque mande otro número, y owner fija el suyo. Cambiar el parámetro no toca ninguna clase
      ya creada. Si se borra la fila, admin no puede crear y owner sí.
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
- [ ] 🔴 **Bloqueante antes de publicar la primera especial: PRD-0019 implementado.** El correo
      de reserva pendiente lleva el plazo del cupo (§8.2) y hoy, si falla, no queda registro ni
      reintento. Publicar antes es prometer un plazo por un canal que puede fallar en silencio.

## 11. Métrica de éxito

**Porcentaje de especiales dictadas cuyo recaudado cubrió la sala y dejó margen** en los primeros
30 días, con la regla de PRD-0009 §8. Si la mitad se dicta con la profesora en $0, el precio o el
formato están mal.

## 12. Riesgos y supuestos

- **Precio de arranque ($12.000) y sin sueldo base: confirmados por Felipe** el 10/09/2026 en
  PRD-0009 §8, y el 11/09 quedó explícito que los $12.000 son **con lo que nace el formulario**,
  no una definición de precio: la migración los carga y owner los cambia en cada clase (§8.4).
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
- **La profesora puede ganar menos que en una clase normal** (Felipe, 10/09/2026). Sin sueldo
  base, con $12.000 iguala los $18.000 recién desde 5 alumnas en Los Leones y 3 en Diaguitas
  (PRD-0009 §8.3). La palanca es `minimo_alumnas`, con el número calculado a la vista en el
  formulario; cancelar sigue siendo decisión de una persona.
- **Canibalización.** Especiales más baratas que la parrilla pueden vaciarla. Se mira en la
  ocupación por horario del tablero.
- **Consentimiento de imagen.** El Reel es de la profesora. Si aparece una alumna, autorización
  firmada. El formulario lo pregunta.
- **Duración.** Una hora salvo que se diga otra cosa; con 90 minutos hay que revisar la grilla.

## 13. Notas de implementación

**Fase 2 — migración `20260910120000_clases_especiales.sql`, escrita el 10/09/2026, sin aplicar.**
Lo que decidió más fino que el texto de arriba, para que el texto no mienta:

- **Las políticas de insert/update de admin sobre `clases` quedan limitadas a la parrilla.** Si un
  admin pudiera insertar una especial por PostgREST, "solo owner fija el precio" y el solape
  vivirían en el formulario. Toda escritura sobre especiales pasa por las funciones de §7.5.
- **Teens se rechaza también en la base**, no solo en el formulario (`cursos.slug = 'teens'`).
- **Cupo entre 1 y 22, duración entre 30 y 180 minutos**, validados en `crear_especial`.
- **`fecha` de una especial** es la de `inicio` en `America/Santiago`, igual que `generar_clases`.
- **Slug** = título normalizado + fecha `YYYYMMDD`; si choca, se numera.
- **Editar con `null` significa "no cambiar"**: no se puede vaciar un campo desde la función. Una
  portada se reemplaza subiendo otra.
- **Reservar a menos de 2 horas de la clase se rechaza**: `expira_at` quedaría en el pasado.
- **Índice único `reservas_una_por_clase` incluye `pendiente_pago`**: una persona no puede tener
  dos pendientes en la misma clase. Consecuencia: si una reserva expiró, la alumna volvió a
  reservar y admin acredita la compra vieja, la reactivación choca con el índice y falla con
  error, no en silencio. Es un caso raro; se anota para la bandeja.
- **`metricas_demanda`** ya cuenta pendientes vigentes en el cupo y atribuye compras de clase
  netas de reembolso; una especial sale con su título en `por_clase` y con `tipo`.
- **`metricas_resumen` no cambia**: suma toda compra pagada, con o sin plan.
- **El barrido diario** (`expirar_reservas_pendientes()` desde el cron) es código y va después
  de que la migración corra en producción: si se despliega antes, el cron falla.

**Fase 3 — escenario escrito el 10/09/2026 y corrido el 11/09.** El día que se escribió estaba
bloqueado: la migración no estaba aplicada y la CLI apuntaba a **producción** (ver §14). Lo que
quedó listo ese día:

- `scripts/escenario-especiales.mjs`: 20 casos, cada uno en una transacción que se revierte,
  con el esperado escrito al lado y sacado del PRD, no de correr el código y copiar lo que dio.
  Imprime la tabla en markdown para pegarla acá cuando corra.
- `scripts/sembrar-escenario.mjs` siembra las dos especiales con `crear_especial()` y
  `publicar_especial()` —el camino real, no un insert—, las deja **sin reservas y en el futuro**
  para no mover los 22 valores de PRD-0010 §11.4, y **borra**
  `especial_precio_default_clp` a propósito, que es la condición del caso "admin no puede crear".
  Las identifica por título: el id lo genera la función.
- La migración incorpora `liberada` (§8.3.b) y el arreglo de bloqueo de **PRD-0017 §18**.
- El conteo de `expirar_reservas_pendientes()` devolvía el `row_count` del update de `compras` y
  no cuántas reservas expiró. Corregido en la misma migración, con su caso en el escenario.

**Fase 3 — corrida en staging el 11/09/2026, con la migración ya aplicada.** El `db push` a
staging lo aprobó Felipe ese día; `migration list` mostraba las 17 aplicadas y solo
`20260910120000` local. Aplicó sin error: es la primera vez que estas 1.500 líneas de SQL se
ejecutan contra un Postgres.

**20 de 20 casos dan lo que dice el PRD.** Esperado y real, uno al lado del otro:

| Caso | Esperado | Real | |
|---|---|---|---|
| reservar_especial() toma el cupo y deja la compra pendiente | compra pendiente con clase · $15000 · reserva pendiente_pago · expira en 24 h · cupo 0→1 | compra pendiente con clase · $15000 · reserva pendiente_pago · expira en 24 h · cupo 0→1 | ✓ |
| con el cupo lleno de pendientes vigentes, la siguiente no entra | 23514 · La clase está llena | 23514 · La clase está llena | ✓ |
| una pendiente vencida suelta el cupo sola, sin esperar al cron | la de Ana expirada · Cata entra · cupo 2 | la de Ana expirada · Cata entra · cupo 2 | ✓ |
| acreditar una compra de clase confirma la reserva y no crea ni un crédito | reserva confirmada · compra pagada · lotes 0 · movimientos 0 | reserva confirmada · compra pagada · lotes 0 · movimientos 0 | ✓ |
| si transfirió y nadie aprobó a tiempo, admin la reactiva cuando hay cupo | reserva confirmada · compra pagada | reserva confirmada · compra pagada | ✓ |
| expirada y sin cupo: la plata queda registrada para devolver, no se inventa un lugar | reserva expirada · compra por_reembolsar | reserva expirada · compra por_reembolsar | ✓ |
| la alumna suelta el cupo: queda `liberada`, no `cancelada` ni `expirada` | reserva liberada · compra expirada · cupo 1→0 | reserva liberada · compra expirada · cupo 1→0 | ✓ |
| una liberada no se reactiva aunque sobre cupo: si transfirió, se le devuelve | reserva liberada · compra por_reembolsar · cupo 0 | reserva liberada · compra por_reembolsar · cupo 0 | ✓ |
| soltar no la deja afuera: puede volver a reservar la misma clase | segunda reserva pendiente_pago · cupo 1 | segunda reserva pendiente_pago · cupo 1 | ✓ |
| cancelar una confirmada es `cancelada`, y la plata no se mueve sola | reserva cancelada · compra pagada · sin reembolso · cupo 0 | reserva cancelada · compra pagada · sin reembolso · cupo 0 | ✓ |
| el reembolso lo registra admin a mano, y la alumna no puede | compra reembolsada $15000 con autor y fecha · alumna: 42501 · Se necesita rol admin o superior | compra reembolsada $15000 con autor y fecha · alumna: 42501 · Se necesita rol admin o superior | ✓ |
| cuando cancela la academia: la pagada queda por reembolsar y la pendiente expira, no liberada | pagada → reserva cancelada + compra por_reembolsar · pendiente → reserva expirada + compra expirada | pagada → reserva cancelada + compra por_reembolsar · pendiente → reserva expirada + compra expirada | ✓ |
| sin sesión se ve la publicada y no el borrador | anon ve 1 de 2 | anon ve 1 de 2 | ✓ |
| una especial que se pisa con la parrilla no se guarda (§9.3: la duración manda) | 23514 · Se pisa con otra clase en esa sede o de esa profesora a esa hora | 23514 · Se pisa con otra clase en esa sede o de esa profesora a esa hora | ✓ |
| sin precio por defecto cargado, admin no puede crear y owner sí | admin: 23514 · Falta el precio por defecto · owner: $15000 | admin: 23514 · Falta el precio por defecto · owner: $15000 | ✓ |
| con el default cargado, el precio que manda admin se ignora y el de owner no | admin $12000 · owner $99000 | admin $12000 · owner $99000 | ✓ |
| expirar_reservas_pendientes() cuenta reservas, no compras | expiró 1 | expiró 1 | ✓ |
| cancelar una reserva de la parrilla sigue devolviendo el crédito a su lote | crédito +1 · 1 movimiento de cancelacion | crédito +1 · 1 movimiento de cancelacion | ✓ |
| el tablero separa lo que la alumna soltó de lo que dejamos vencer | soltadas 1 · expiradas 1 · por clase cancelada 0 | soltadas 1 · expiradas 1 · por clase cancelada 0 | ✓ |
| una compra de especial entra en los ingresos y no descuadra la conciliación de créditos | ingresos +15000 · conciliación cuadra | ingresos +15000 · conciliación cuadra | ✓ |

Dos casos fallaron en la primera corrida y **los dos eran defectos del escenario, no de la
migración**. Vale anotarlos porque uno de ellos es del tipo que se cuela:

- `expirar_reservas_pendientes() cuenta reservas, no compras` se caía en la **preparación**, no en
  la función: ponía la compra en `rechazada` sin motivo y chocaba con
  `compras_rechazo_con_motivo` (PRD-0017). O sea que ese caso **nunca llegó a llamar a la
  función que decía probar**. Un caso que se cae antes de ejercitar lo que prueba se ve igual que
  uno que encontró un bug, y es la misma trampa de siempre: el ✗ hay que leerlo, no contarlo.
- El otro era el texto esperado: decía "un movimiento" y la función escribe "1 movimiento". El
  comportamiento estaba bien desde el principio.

**Y `verificar-metricas` destapó una deriva del escenario de PRD-0010.** "Ocupación promedio
dictadas" daba 5 de 110 en vez de 5 de 66, sin que nadie tocara una métrica: staging tiene las
clases de parrilla **reales** que generó la migración de Pau, y cada día que pasa una más queda en
el pasado y entra en "las dictadas del mes". El numerador no se movió —las dos clases nuevas
tienen cero reservas—, así que no era una regresión de esta migración. Se ancló la medición a las
cinco clases del escenario, que es sobre lo que se calculó el número a mano. **25 de 25.**

**Fases 4 y 6 — construidas y verificadas con clics el 11/09/2026.** La fase 4 no existía —eso se
aclaró mirando el repo, no la memoria— y sin ella la 6 no se podía recorrer, así que se
construyeron juntas: formulario de admin, subida de portada por Route Handler con la service role,
publicar, la pantalla de reserva de la alumna, la bandeja con la clase al lado y el correo propio
de las especiales.

**La verificación es el punto.** `scripts/verificar-fase6.mjs` maneja un Chromium de verdad contra
el sitio levantado apuntando a staging: abre **el enlace que llegaría por correo** (`token_hash`,
la forma que viaja entre dispositivos), llena los campos y aprieta los botones. No llama a una sola
función de la base para avanzar; el SQL solo mira el resultado. **25 de 25:**

| Caso | Esperado | Obtenido | |
|---|---|---|---|
| admin abre el enlace del correo y cae en el formulario | http://localhost:3000/admin/especiales/nueva | http://localhost:3000/admin/especiales/nueva | ✓ |
| a admin el precio le aparece bloqueado | true | true | ✓ |
| sin el valor de arranque cargado, admin no puede crear | true | true | ✓ |
| la clase se creó con el título del formulario | Coreo de la fase 6 45943 | Coreo de la fase 6 45943 | ✓ |
| la hora quedó donde se escribió, en hora de Santiago | 2026-10-15 09:30 | 2026-10-15 09:30 | ✓ |
| admin no fija precio: queda el valor de arranque | 12000 | 12000 | ✓ |
| nace como borrador | sin publicar | sin publicar | ✓ |
| la portada queda en el bucket privado, nombrada por la clase | c45388a3-b8a8-42e8-973b-0ea299a119de.jpg | c45388a3-b8a8-42e8-973b-0ea299a119de.jpg | ✓ |
| publicar la deja publicada | publicada | publicada | ✓ |
| la ficha pública muestra el título | true | true | ✓ |
| y cuántos lugares quedan | true | true | ✓ |
| antes de tocar: cero peticiones a instagram.com | 0 | 0 | ✓ |
| al tocar, recién ahí se habla con Instagram | true | true | ✓ |
| el botón de reservar lleva a la pantalla de transferencia | http://localhost:3000/reservar-especial/coreo-de-la-fase-6-45943-20261015 | http://localhost:3000/reservar-especial/coreo-de-la-fase-6-45943-20261015 | ✓ |
| la reserva nace pendiente de pago | pendiente_pago | pendiente_pago | ✓ |
| con compra pendiente, de clase y por el precio de la clase | pendiente/true/12000 | pendiente/true/12000 | ✓ |
| EL CUPO QUEDA TOMADO con la compra todavía sin aprobar | 1 | 1 | ✓ |
| en Mis clases ve hasta cuándo le guardan el cupo | true | true | ✓ |
| y el botón dice soltar el cupo, no cancelar | true | true | ✓ |
| la segunda alumna se topa con la clase llena | true | true | ✓ |
| la bandeja dice de qué clase es la transferencia | true | true | ✓ |
| aprobar confirma la reserva y paga la compra | confirmada/pagada | confirmada/pagada | ✓ |
| una compra de clase no acredita ni un crédito | 0 | 0 | ✓ |
| el cupo sigue tomado, ahora confirmado | 1 | 1 | ✓ |
| la ficha pública ya dice Llena | true | true | ✓ |

Lo que apareció al recorrerlo, y que ninguna lectura de código iba a dar:

- **El caso "admin no puede crear sin el valor de arranque" se vio por el formulario**, no por SQL:
  apareció solo, porque la siembra borraba esa fila. Quedó como paso verificado.
- **El escenario de la fase 3 dependía de un efecto secundario de la siembra.** Ese caso daba por
  hecho que la fila estaba borrada; al restituirla —que es como queda producción tras la
  migración— habría fallado sin que nadie tocara la migración. Ahora el caso borra la fila dentro
  de su propia transacción revertida, y la siembra deja $12.000 como producción.
- **La pantalla de reserva se niega a pedir plata sin datos de transferencia cargados**, que es lo
  correcto y lo que PRD-0017 dejó a propósito. Cortó el recorrido hasta cargarlos en staging con
  datos evidentemente falsos.
- **`quePaso()` de MisReservas decía "Asististe"** para cualquier estado que no fuera `cancelada`:
  una pendiente, una soltada y una vencida mentían en pantalla. Estaba anotado como riesgo en el
  plan de la fase 6 y acá se arregló con sus cuatro frases.
- **La hora del formulario no puede llevar un `-03:00` fijo.** Chile cambia de hora dos veces al
  año. Se resolvió con `instanteEnSantiago()` en `lib/dominio/periodo.ts`, con tests, y el paso
  "la hora quedó donde se escribió" lo comprueba contra la base.

**Lo que esta verificación no prueba: que el correo llegue.** Las cuentas del escenario usan
`@ejemplo.invalid` y el código, con razón, no les escribe. Que ese correo salga y se pueda
reintentar es **PRD-0019**, bloqueante antes de publicar la primera especial de verdad.

**Fase 5 — lo público, escrito el 11/09/2026 fuera de orden** (antes que la fase 4, que es el
formulario de admin). Lo que quedó y lo que eso implica:

- `/clases-especiales` y `/clases-especiales/[slug]`, estáticas con revalidación y con el webhook
  de `/api/revalidar` agregado para las dos rutas nuevas. `ReelFachada` monta el iframe recién al
  tocar; la fila "Clases especiales · desde $X · Ver clases especiales" aparece en Planes solo si
  `desdePrecio` devuelve un número.
- **Dos clientes de Supabase, a propósito** (`lib/especiales-consultas.ts`): la ficha con el
  cliente público, para que las páginas sigan prerenderizándose y RLS filtre; la portada firmada y
  el conteo de cupo con la service role, porque el bucket es privado y `cupo_tomado` no se le
  concede a `anon`. La consulta filtra igual que la política: publicada, programada y futura.
- **La imagen de Open Graph no usa URL**: descarga el objeto con la service role y lo incrusta
  como data URI. Una URL firmada dentro de una imagen cacheada vencería sin que nadie se entere.
- `/entrar` ahora respeta `?volver=` **también con sesión iniciada**. Antes mandaba a la persona a
  su inicio, así que una alumna con sesión que apretaba "Reservar por $X" terminaba en
  "Mis clases" buscando de nuevo la clase que ya había elegido. Nadie pasaba `volver` en un link
  hasta ahora.
- ⚠️ **`npm run build` falla**, y es la misma situación que PRD-0017 dejó anotada: compila y pasa
  TypeScript, pero el prerender se cae con `column clases.slug does not exist` y el mensaje que
  nombra la migración. Es deliberado —una lectura que se cae y se ve como "no hay clases
  especiales" no se distingue del caso normal (§17 de PRD-0017)—, pero significa que **estas
  páginas no se renderizaron nunca**: están verificadas por el compilador, no por un navegador.
- El texto del botón, "Ver el Reel en Instagram", es palabra por palabra el que ya dice
  `/privacidad` §9. Verificado.

## 14. Para retomar — estado al 10/09/2026

**Migración de Pau (`20260908150000_horarios_pau_martes_y_jueves.sql`)**

- [x] Aplicada y verificada en **staging** y en **producción** el 09/09/2026, con aprobación en cada
      caso. Antes y después en producción: horarios activos de Pau de lunes 20:00 y miércoles
      20:00 a **martes 20:00 y jueves 19:30**; 19 clases viejas borradas (sin reservas); 21 nuevas,
      con la Girly del 08/09; las del 31/08 y 02/09 intactas; total de clases de 73 a 80 (las 5
      extra son de otras profesoras, que `generar_clases()` alcanzó hasta el 17/11). Reservas,
      créditos y movimientos: 0 antes y después. La rama que cancela con reserva y devuelve el
      crédito **no se ejercitó** en ninguna base.
- [x] La CLI estuvo enlazada a producción desde el push de Pau. Re-enlazada a staging
      (`ybopuahlzbjkkwumkllk`) el 10/09/2026 para la fase 2. **Y el 10/09, más tarde, estaba de
      vuelta en producción (`wpjiwqeirdsspdfwwumv`)**: `cat supabase/.temp/project-ref` lo dijo al
      empezar la fase 3. Que la advertencia de verificar antes de cada comando exista **no** es
      teórico: pasó dos veces en dos días. Nada se corrió contra ninguna base con la CLI así.
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
- [x] 10/09/2026: Felipe dio la razón de "sin sueldo base" y anotó el riesgo de quedar bajo los
      $18.000; `minimo_alumnas` queda escrito como la palanca (PRD-0009 §8.3, §12 de este PRD).
- [x] Fase 1 del plan hecha el 10/09/2026: `lib/dominio/especiales.ts` con 35 tests.
- [x] Fase 2: migración escrita el 10/09/2026 (`20260910120000_clases_especiales.sql`), sin
      aplicar. Ver §13.
- [x] 10/09/2026: Felipe eligió la **opción B** para soltar el cupo — estado propio `liberada`,
      distinguible de la expiración por tiempo y de la cancelación normal (§8.3.b). En la
      migración, en el tablero y en el escenario.
- [x] 10/09/2026: defecto de concurrencia de PRD-0017 anotado en **PRD-0017 §18** y arreglado en
      esta migración: el `for update` estaba donde se descuenta y no donde se devuelve.
- [x] 11/09/2026: los $12.000 quedaron escritos como **valor de arranque del formulario**, no
      como definición de precio (§8.4), y la migración los carga.
- [x] 11/09/2026: fase 5 escrita —lista, página propia, Open Graph, fachada del Reel y fila en
      Planes—, **sin renderizar nunca**. Ver §13.
- [x] 11/09/2026: **migración aplicada a staging** con aprobación de Felipe. Escenario 20/20 y
      `verificar-metricas` 25/25. `npm run build` sigue fallando contra producción, que es donde
      apunta `.env.local` y donde la migración **no** está aplicada.
- [x] 11/09/2026: **fases 4 y 6 construidas y verificadas con clics** (25/25). El formulario de
      admin, la subida de portada, publicar, la pantalla de reserva, la bandeja con la clase y los
      correos propios de las especiales. Ver §13.
- [ ] 🔴 **PRD-0019 (correo que no se pierde) es bloqueante** para publicar la primera especial.
      Escrito el 11/09/2026, sin aprobar.
- [x] 11/09/2026: CLI re-enlazada a **staging** (`ybopuahlzbjkkwumkllk`) y verificada antes de
      cada comando. Ojo al volver: para `npm run build` y para producción hay que re-enlazar.
- [ ] Push a **producción**: fase 7, y con PRD-0019 antes (§10).
- [ ] Despliegues Preview en Error en Vercel de los últimos días, sin revisar.
