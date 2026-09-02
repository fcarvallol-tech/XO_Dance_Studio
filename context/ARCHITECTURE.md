# ARCHITECTURE.md — Sistema XO Dance Studio

> Stack real, código existente y modelo de dominio objetivo.
> Última actualización: 21 de agosto de 2026.
> ⚠️ Este documento cambió sustancialmente: el negocio pasó de **mensualidad** a
> **paquetes de clases con reserva por horario**. Ver `decisions/0002-modelo-creditos.md`.

---

## 1. Stack real

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js App Router | **16.2.12** |
| UI | React | 19.2.4 |
| Lenguaje | TypeScript | 5 |
| Estilos | **Tailwind CSS v4** vía `@tailwindcss/postcss` | 4 |
| Base de datos | Supabase (Postgres) | `@supabase/supabase-js` 2.111 |
| Auth | Supabase Auth — **Google + magic link**, vía `@supabase/ssr` 0.12 | implementado |
| Emails | **Resend**, con plantillas `react-email` en el repo — ADR-0007 | a implementar |
| Pagos | **Flow** (incluye Webpay, tarjetas y transferencia) — ADR-0003 | a implementar |
| Deploy | Vercel, proyecto `xo-dance-studio`, equipo `Unicornio` (Hobby) | en línea |

⚠️ **Dos supuestos que rompen a cualquier IA entrenada antes:**

1. **Tailwind v4 no usa `tailwind.config.ts`.** Los tokens viven con `@theme` en
   `app/globals.css`.
2. **Next.js 16 cambia convenciones anteriores.** Leer `node_modules/next/dist/docs/` antes de
   asumir APIs.

---

## 2. Variables de entorno de producción

| Variable | Valor | Sensitive |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL base del proyecto Supabase, **sin** `/rest/v1/` | No |
| `SUPABASE_SERVICE_ROLE_KEY` | Llave secreta, formato nuevo `sb_secret_...` | **Sí** |
| `NEXT_PUBLIC_SITE_URL` | `https://xodancestudio.cl` | No |

| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Llave publishable `sb_publishable_...`. **Falta cargarla**: sin ella no entra nadie | No |
| `REVALIDAR_SECRETO` | Secreto compartido con el Database Webhook que refresca el catálogo. Sin él `/api/revalidar` responde 503 y los cambios tardan hasta una hora | **Sí** |
| `RESEND_API_KEY` | Correo transaccional (ADR-0007). Sin ella no sale el aviso de transferencia declarada | **Sí** |
| `CORREO_DESDE` | Remitente, ej. `XO Dance Studio <hola@xodancestudio.cl>`. Opcional: cae a ese valor | No |
| `CRON_SECRETO` | Secreto del cron que genera las clases. Sin él `/api/generar-clases` responde 503 | **Sí** |

`NEXT_PUBLIC_WHATSAPP` es opcional: `lib/contacto.ts` cae al número correcto si falta.
`VERCEL_PROJECT_PRODUCTION_URL` es variable de sistema y no hay que cargarla: la usa
`lib/sitio.ts` como respaldo de `NEXT_PUBLIC_SITE_URL`.

⚠️ Las `NEXT_PUBLIC_*` se incrustan en el bundle **durante el build**. Cambiarlas exige redeploy
sin caché; guardarlas no surte efecto por sí solo. Ver `CONTEXT.md` §10.

Vendrán además: credenciales de la pasarela de pago, API key del servicio de email, y las claves
de Google OAuth.

---

## 3. Estructura actual del repo

```
.claude/rules/estilo.md     reglas visuales, se cargan al editar .tsx
AGENTS.md                   aviso de Next 16
CLAUDE.md                   instrucciones del proyecto
context/                    este repositorio de contexto
app/
  layout.tsx                metadata, fuentes, metadataBase
  page.tsx                  landing pública
  globals.css               tokens @theme
  opengraph-image.tsx       OG generada con satori
  api/lead/route.ts         captación de leads
components/                 Barra · Hero · QueEsXo · Lineup · Cursos ·
                            ClaseDePrueba · Formulario · Seleccion ·
                            BotonInscripcion · Reveal · Placeholder · Footer
lib/
  tipos.ts · cursos.ts · profesoras.ts · lead.ts · contacto.ts
supabase/migrations/        20260801000000_leads.sql
Assets/ · public/ · fuentes/
```

### Estructura objetivo

```
app/
  (publico)/                landing, perfiles públicos de profesoras
  (cuenta)/                 requiere sesión
    mi-perfil/
    mis-reservas/
    comprar/
    reservar/               calendario de reserva
  (profesora)/
    mis-clases/
    mis-alumnas/
    solicitar-horario/
  (admin)/
    profesoras/ cursos/ clases/ alumnas/ reservas/ solicitudes/
  (owner)/
    metricas/ finanzas/
  api/
lib/
  dominio/                  lógica pura: créditos, cupos, cancelación
  supabase/                 clientes server/browser/admin
```

**Regla:** la lógica de negocio (descontar crédito, validar cupo, decidir si una cancelación
devuelve el crédito) vive en `lib/dominio` como funciones puras y testeables. Los componentes no
calculan reglas.

---

## 4. Decisiones ya tomadas en el código

- **Landing de una sola página con scroll**, sin rutas adicionales salvo `/api/lead`.
- **Toda escritura sensible pasa por el servidor.** La service role key salta RLS y nunca sale
  del servidor. Esto se vuelve más importante ahora: **el descuento de créditos y la creación de
  reservas jamás se hacen desde el cliente.**
- **Validación compartida cliente/servidor** (`lib/lead.ts`). El servidor manda.
- **Catálogo hardcodeado en `/lib`.** Debe migrar a base de datos.

---

## 5. Modelo de dominio

Todas las tablas: `id uuid`, `created_at`, `updated_at`, `deleted_at` (borrado lógico).

### 5.1 Identidad y roles

**`perfiles`** — extiende `auth.users` de Supabase.
`user_id, rol (alumna|profesora|admin|owner), nombre, email, telefono, avatar_url,
profesora_id?, fecha_nacimiento?, apoderado_nombre?, apoderado_telefono?`

Cuatro roles, jerárquicos en facultades:

| Rol | Puede |
|---|---|
| `alumna` | Su perfil, sus créditos, su calendario, reservar y cancelar |
| `profesora` | Sus cursos y clases, lista de inscritas, su calendario, solicitar horario. **No ve plata** |
| `admin` | Todo lo operacional: crear profesoras y cursos, calendario general, alumnas, reservas, resolver solicitudes |
| `owner` | Todo lo de admin **más** métricas y finanzas |

⚠️ `owner` es superconjunto de `admin`. Implementar como jerarquía, no como listas paralelas de
permisos que se van a desincronizar.

**Construido el 25/08/2026 (PRD-0004),** en
`supabase/migrations/20260825120000_perfiles_roles_y_rls.sql`:

- `perfiles` existe con `rol`, `nombre`, `email`, `telefono`, `avatar_url`, `profesora_id`,
  `fecha_nacimiento`, `autoriza_uso_imagen` y `perfil_completo_at`. **Sin los campos de
  apoderado:** esa parte está recortada hasta que se defina el rango etario de XO Mini. Ver
  PRD-0004 §9.
- La jerarquía es aritmética: `nivel_rol()`, `mi_rol()` y `tiene_nivel()`. Una política que dice
  `tiene_nivel('admin')` incluye a `owner` sin nombrarlo, así que no hay dos listas que
  desincronizar. `mi_rol()` es `security definer` para no entrar en recursión al consultar
  `perfiles` desde una política sobre `perfiles`.
- El perfil lo crea un trigger sobre `auth.users`, con `rol` en `alumna` por defecto. Nadie elige
  su rol al insertarlo.
- **Portal de profesora (PRD-0008):** `mi_profesora_id()` resuelve el salto de tipo entre
  `perfiles.profesora_id` (slug) y `clases.profesora_id` (uuid); `dicta_la_clase()` y
  `inscritas_de_clase()` gobiernan qué ve de sus alumnas. **`inscritas_de_clase` devuelve solo
  `reserva_id, nombre, estado`**, y esa firma es el contrato: RLS filtra filas, no columnas, así
  que a la profesora no se le da ningún acceso a `perfiles`.
- **`saldo_creditos` ya no está concedida a `authenticated`** (02/09/2026): era `security definer`
  y dejaba consultar el saldo de cualquier perfil conocido. Solo `service_role`.
- **`cambios_rol`** — libro de cambios de rol: `perfil_id, rol_anterior, rol_nuevo, cambiado_por,
  motivo`. Solo se agrega, y el `revoke update, delete ... from service_role` lo garantiza: la
  service role key salta RLS pero no salta los grants. Sin `deleted_at`, excepción deliberada a la
  convención de arriba. La columna `rol` solo se toca por `public.cambiar_rol`, vía
  `POST /api/roles`. Ver PRD-0004 §8.

### 5.2 Catálogo

> **Dos sedes reales**, con nombre y dirección desde el 30/08/2026: Seducción Latina Experience
> (Providencia) y Centro Comunitario Diaguitas (Las Condes). El sistema es multi-sede desde el
> día uno; ya no es una previsión, es un hecho.
>
> **`salas`** sigue pendiente para PRD-0006: ahí van `capacidad` y `costo_hora_clp`, que son lo
> que permite calcular el margen por clase dictada. Mientras haya una sala por sede no aporta.
>
> **Capacidad: 22 personas en las dos sedes** (confirmado el 30/08/2026). El cupo es atributo
> de la sala —y por herencia de la clase—, **nunca del curso**: depende del espacio físico, no
> de qué se baila adentro. Mientras `salas` no exista, el default de `clases.cupo_maximo` lo
> sostiene.

**✅ Construido el 28/08/2026 (PRD-0015) y ampliado el 30/08/2026 (PRD-0016):**

**`cursos`** — `slug, nombre, publico, estilo, descripcion, cupos, dificultad, orden, activo`
**`profesoras`** — `slug, nombre, estilo, bio, instagram, foto_url, video_url, orden, activa`
**`sedes`** — `slug, nombre, direccion, comuna, referencia, orden, activa`
**`horarios`** — `curso_id, profesora_id, sede_id, dia_semana, hora, activo`

- El **slug** es la identidad pública y es **inmutable por trigger** en las tres tablas que lo
  tienen: lo guardan `leads`, `perfiles` y las URLs `/profesoras/<slug>`.
- **`cursos_profesoras` se eliminó en PRD-0016.** `horarios` dice quién dicta qué, dónde y cuándo:
  no había ningún hecho en la tabla de unión que no estuviera ahí, y dos fuentes para el mismo
  dato se desincronizan. La relación se deriva.
- `dia_semana` es ISO 8601 (1 = lunes … 7 = domingo), para ordenar la semana sin un `case`.
- **Dos índices únicos parciales** en `horarios`: no hay dos clases a la misma hora en la misma
  sede, ni una profesora en dos lugares a la vez. El primero **asume una sala por sede**; si
  alguna llega a tener dos, se revisa junto con el modelado de `salas` de PRD-0006.
- `cursos.horario` quedó **sin uso** —un curso tiene varios— y está marcada con un `comment`.
- **RLS:** `anon` y `authenticated` leen solo lo activo; `admin`+ lee todo y escribe.
- `perfiles.profesora_id`, `leads.curso_id` y `leads.profesora_id` son **llaves foráneas** contra
  esos slugs, con `on update cascade`.
- Sin `edad_min`/`edad_max` ni `porcentaje_comision`: no los usa nada todavía.
- **`salas` sigue sin existir.** Con una sala por sede no aporta; entra con PRD-0006.
- **`cursos.formato` se eliminó el 30/08/2026.** Existía para el intensivo mensual por artista de
  los Girly viejos, que murió con el catálogo nuevo y que los créditos universales contradicen de
  raíz. Estaba en `null` en las siete filas.

### 5.3 Clases y calendario

**`clases`** — la unidad reservable. Una ocurrencia concreta en el calendario.
`curso_id, profesora_id, sala_id, fecha, hora_inicio, hora_fin, cupo_maximo (default 22),
estado (programada|realizada|cancelada), motivo_cancelacion`

> **Cambio importante de modelo.** Antes existía `secciones` (curso + horario fijo) y las
> alumnas se inscribían a la sección. Ahora la alumna reserva **clases individuales**, así que
> `clases` deja de ser un detalle operacional y pasa a ser el corazón del sistema.
> Sigue habiendo necesidad de generar clases recurrentes: ver `horarios_recurrentes`.

**`horarios_recurrentes`** — plantilla que genera clases.
`curso_id, profesora_id, sala_id, dia_semana, hora_inicio, hora_fin, vigente_desde,
vigente_hasta, activo`
Un proceso genera las `clases` de las próximas N semanas desde estas plantillas.

**`solicitudes_horario`** — ✅ construida el 02/09/2026 (PRD-0008).
`profesora_id, dia_semana, hora, curso_id?, curso_propuesto?, sede_id?, mensaje,
estado (pendiente|aprobada|rechazada), resuelta_por, resuelta_at, respuesta`

- `profesora_id` apunta a **`profesoras`** y `resuelta_por` a **`perfiles`**, a tablas distintas
  a propósito: dos FK a la misma tabla vuelven ambiguo el embed de PostgREST. Ver PRD-0017 §17.
- Puede pedir un curso del catálogo **o** proponer uno nuevo; un check exige al menos uno.
- Resolver pasa por `resolver_solicitud`, con respuesta obligatoria. Aprobar **no crea el
  horario**: eso queda en el portal de administración, porque toca cupos y calendario.

### 5.3.b Suscripciones (rama Teens)

El modelo es híbrido: Teens se vende como **suscripción mensual**, no como packs.

**`suscripciones`** — `perfil_id, alumna_id, curso_id, horario_recurrente_id, precio_mensual_clp,
fecha_inicio, fecha_termino, estado (activa|pausada|terminada), motivo_termino`

> **Precio:** el mismo de los packs. Una suscripción de 4 clases al mes cuesta $30.000, igual que
> el pack de 4. Teens deja de pagar $45.000.

**`cargos_mensuales`** — `suscripcion_id, periodo (YYYY-MM), monto_clp, fecha_vencimiento,
estado (pendiente|pagado|vencido|condonado)`

Diferencias con la rama de packs, que importan al diseñar:

- La alumna de Teens **no reserva**: su asistencia está implícita en la suscripción y el horario
  fijo. No consume créditos.
- El cargo se genera por proceso mensual, no por compra.
- La retención se mide como permanencia, no como recompra.
- Los pagos pueden compartir la tabla `pagos`, pero el objeto cobrado es distinto: un cargo
  mensual, no una compra de plan.

⚠️ **Decisión pendiente:** si el cobro de la suscripción es automático y recurrente (mucho más
complejo: la pasarela tiene que soportar suscripciones) o manual con recordatorio de pago. Para
la v1, manual es defendible: son pocas alumnas y la complejidad no se justifica.

### 5.4 Créditos, planes y compras

**`planes`** — lo que se vende.
`nombre, cantidad_clases, precio_clp, vigencia_dias, activo, orden`

Cuatro filas iniciales: clase suelta, 2, 4 y 8 clases. **Un solo nivel de precio**, sin segmento.

| Plan | Precio |
|---|---|
| Clase suelta | $8.500 |
| 2 clases | $16.000 |
| 4 clases | $28.000 |
| 8 clases | $48.000 |

**`vigencia_dias` = 60** en todos los planes: los créditos vencen a los **2 meses**.

> El precio vive en la tabla, no en el código: los precios cambian y no puede hacer falta un
> deploy para subirlos. El nombre propio de cada plan viene después; la estructura ya lo soporta.

> **La tarifa universitaria salió del esquema (25/08/2026).** No hay `segmento` en `planes` ni
> `es_universitaria`, `universitaria_verificada_at` o `certificado_url` en `perfiles`, y no hay
> bucket de certificados. El descuento a universitarias se resuelve con un código de descuento
> (PRD-0013): un mecanismo que ya hay que construir, contra tres columnas, un flujo de aprobación
> y la custodia de un documento personal que ya no hacen falta.

**`compras`** — una transacción.
`perfil_id, plan_id, cantidad_clases, monto_clp, estado (pendiente|pagada|fallida|reembolsada),
medio_pago, referencia_pasarela, pagada_at`

**`creditos`** — el saldo. **No es un contador simple.**
`perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento, estado`

> ⚠️ **No hay `curso_id` acá, y no es un olvido.** Los créditos son **universales** desde el
> 30/08/2026: un pack de N clases sirve para cualquier clase de la parrilla, con cualquier
> profesora y en cualquier sede. Agregarle un `curso_id` a `creditos` —o a `compras`, o a
> `planes`— rompería el producto, no lo precisaría.
>
> Lo que se reserva es un **horario**, no un curso: `reservas` apunta a una clase concreta de
> la parrilla y el crédito que la paga no pregunta de qué curso es. **Teens es la excepción**
> y no usa créditos: va por la rama de suscripción de §5.3.b.

⚠️ **No modelar los créditos como un número en la tabla del perfil.** Un `saldo int` parece más
simple y es una trampa: no permite vencimientos por lote, ni auditar de dónde salió cada clase,
ni reembolsar una compra específica. Se modela como lotes, y el saldo se calcula sumando.
Toda mutación queda en `movimientos_credito`.

**`movimientos_credito`** — libro mayor. Nunca se edita, solo se agrega.
`perfil_id, credito_id, reserva_id?, tipo (compra|reserva|cancelacion|expiracion|ajuste|regalo),
cantidad (+/-), saldo_resultante, motivo, creado_por`

> **Créditos otorgados por admin u owner.** Requisito explícito: admin y owner pueden regalar
> créditos a una alumna (promoción, compensación por una clase cancelada, cortesía). Se
> implementa como un lote de `creditos` sin `compra_id` asociada, con su propio vencimiento, y un
> movimiento tipo `regalo` con **motivo obligatorio y autor registrado**. Nunca como una edición
> del saldo: si un crédito aparece sin quedar en el libro, se pierde la trazabilidad, que es la
> razón de ser de todo el módulo.

### 5.5 Reservas

**`reservas`**
`clase_id, perfil_id, estado (confirmada|cancelada|asistio|no_show), credito_id,
reservada_at, cancelada_at, comprobante_enviado_at`

**Reglas duras:**

1. Una alumna no puede tener dos reservas confirmadas para la misma clase.
2. No se puede reservar si `reservas confirmadas >= cupo_maximo` (22).
3. No se puede reservar sin crédito disponible y vigente.
4. La reserva y el descuento del crédito ocurren en **una sola transacción**. Si falla el email,
   la reserva vale igual; si falla el descuento, no hay reserva.
5. No se puede reservar una clase que ya pasó ni una cancelada.
6. Cancelar una reserva devuelve el crédito hasta **30 minutos antes** del inicio de la clase.
   Después de ese momento, la cancelación libera el cupo pero **no devuelve el crédito**.
7. Si XO cancela la clase, el crédito se devuelve siempre, sin importar la ventana.

⚠️ **Concurrencia.** Con 22 cupos y campañas de Instagram, dos personas pueden reservar el
último lugar al mismo tiempo. El chequeo de cupo debe hacerse en base de datos —constraint o
transacción con bloqueo—, no leyendo el conteo y escribiendo después.

### 5.6 Finanzas

**`egresos`** — `fecha, categoria, descripcion, monto_clp, sede_id, comprobante_url`
**`liquidaciones_profesoras`** — `profesora_id, periodo, clases_dictadas, monto_bruto_clp,
comision_clp, monto_neto_clp, estado`

### 5.7 Captación

**`leads`** — ya existe. Ver §6.

---

## 6. La tabla `leads` y los cambios que necesita

Hoy: `nombre, whatsapp, para_quien, edad_alumna, curso_id (NOT NULL), profesora_id, origen`.
RLS activo, sin políticas, `revoke all` a `anon`/`authenticated`, solo `INSERT` a `service_role`.

**Cambios requeridos por el nuevo formulario** ("¿Con quién quieres tomar clases?"):

| Cambio | Motivo |
|---|---|
| `curso_id` pasa a nullable | Ahora la pregunta es por profesora, no por curso |
| `profesora_id` pasa a obligatorio | Es el nuevo eje de la captación |
| `estado`, `notas`, `motivo_perdida` | Seguimiento del lead |
| `updated_at` | Saber hace cuánto está sin contactar |
| `perfil_id` | Vincular el lead con la cuenta cuando la persona se registra |
| ✅ Política RLS de `select`/`update` para `admin` y `owner` | Hecho el 25/08/2026 (PRD-0004): `leads_admin_lee` y `leads_admin_edita`, con `grant select, update ... to authenticated`. El grant habilita y la política restringe; se necesitan los dos. A `anon` no se le devolvió nada |

⚠️ **No relajar la seguridad actual por comodidad.** El camino es una política RLS por rol, no
devolver grants a `anon`.

---

## 7. ⚠️ Decisiones abiertas que bloquean el esquema

Estas no se resuelven programando. Ver `CONTEXT.md` §12.

1. ✅ **Resuelto: modelo híbrido.** Teens con suscripción mensual; Girly y K-Pop con packs. El
   esquema tiene las dos ramas (§5.3.b y §5.4).
2. **¿Los créditos vencen?** Sin vencimiento, la caja cobrada hoy es un pasivo eterno. Con
   vencimiento, hay que definir el plazo y comunicarlo.
3. **Ventana de cancelación.** ¿Hasta cuántas horas antes se devuelve el crédito? Sin regla, una
   clase con 22 reservas puede quedar con 6 personas.
4. **¿Sobrevive la clase de prueba gratis?** El CTA cambia a "Reservar clase", lo que sugiere que
   no. Es la principal herramienta de conversión que existe hoy.
5. **Pasarela de pago** y si se puede cobrar antes del Inicio de Actividades en el SII.
6. ⚠️ **Menores y login con Google.** Se decidió que las alumnas menores manejen su propia
   cuenta y resolver los problemas cuando aparezcan. Hay una traba concreta: **Google exige 13
   años como edad mínima** para tener cuenta propia. Teens parte en 11, así que las alumnas de
   11 y 12 **no pueden** iniciar sesión con Google legalmente.

   Atenuante importante: como Teens va por suscripción y horario fijo, **la alumna no necesita
   reservar**. La cuenta la puede tener la mamá, que es además quien paga. Recomendación: la
   suscripción de Teens se asocia al perfil del apoderado, con la alumna como dato del registro,
   y no se le crea cuenta a la menor en la v1.

---

## 8. Métricas del dashboard de owner

Propuesta. En un modelo de paquetes, las métricas clásicas de academia no alcanzan.

**Caja y venta**
- Ingresos del mes por venta de paquetes
- Ticket promedio y plan más vendido
- Caja neta: ingresos − arriendo de sala − pago a profesoras

**El indicador propio de este modelo: créditos**
- **Clases vendidas vs. clases consumidas.** La diferencia es plata cobrada por un servicio que
  todavía debes. Es un pasivo, no utilidad.
- **Tasa de utilización de créditos.** Si es baja, la gente compra y no viene: se ve bien en caja
  y anticipa abandono.
- **Créditos por vencer en los próximos 30 días.**

**Demanda y ocupación**
- Ocupación por clase (reservas / 22) y por horario
- Horarios saturados vs. horarios muertos → decisiones de programación
- Ranking de profesoras por reservas y por ingreso atribuido

**Alumnas**
- Alumnas activas (con crédito vigente o reserva en los últimos 30 días)
- **Tasa de recompra:** % que compra un segundo paquete. Es la métrica de retención real acá,
  no el churn mensual.
- Alumnas sin reservar hace más de 30 días con créditos disponibles → en riesgo
- Embudo: visita → cuenta creada → primera compra → primera reserva → segunda compra

**Operación**
- Cancelaciones y no-shows, por alumna y por clase
- Margen por clase dictada: ingreso atribuido − costo de sala − comisión

---

## 9. Convenciones

Dominio en español, infraestructura en inglés, sin tildes ni ñ en identificadores ·
`snake_case` y plural en base de datos · dinero en enteros CLP, nunca float · `timestamptz` en
UTC, renderizado en `America/Santiago` · RLS con políticas explícitas por rol · migraciones
versionadas · colores solo desde tokens.

**Específico de este modelo:** ninguna operación que toque créditos o cupos se ejecuta desde el
cliente. Todo pasa por Route Handler o función de base de datos, en transacción.

---

## 10. Deuda técnica

| Item | Detalle |
|---|---|
| `reservas` sin prueba con datos | Su política de profesora se verificó por la expresión que la gobierna, no con filas: al auditar había 0 reservas. Repetir la prueba con la primera reserva real |
| Build acoplado a Supabase | Desde PRD-0015 el catálogo se lee en `next build`. Si el proyecto está pausado o la migración no se aplicó, **el deploy falla**. Es deliberado —un sitio sin catálogo no debe publicarse— y el error dice qué hacer, pero sube la apuesta de la fila sobre el plan gratuito |
| Sin alerta de caída | Nadie se entera si el formulario deja de guardar leads. Con Supabase pausándose solo en plan gratuito, es un agujero real |
| Plan gratuito de Supabase | Se pausa tras ~1 semana sin actividad. Con cobros online esto pasa de molestia a inaceptable: subir a Pro antes de cobrar |
| `CursoId` y `ProfesoraId` son `string` | **Consecuencia consciente de PRD-0015, no un olvido.** Eran uniones cerradas y el compilador verificaba cada slug del sitio. Con el catálogo en la base ese conjunto deja de conocerse en compilación. Se cambió chequeo estático por llaves foráneas contra `cursos(slug)` y `profesoras(slug)`, que cubren además lo que el compilador nunca cubrió: los datos que ya están en la base. Si alguna vez se generan tipos desde el esquema (`supabase gen types`), se recupera parte de ese chequeo |
| Sin tests | `lib/lead.ts` es lógica pura, candidato obvio. La lógica de créditos **sí o sí** necesita tests |
| `README.md` | Sigue siendo el de `create-next-app` |
| Dominio | Sin registrar |

> ✅ **Saldada el 25/08/2026:** el fallback de `metadataBase`. `app/layout.tsx` encadena
> `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → `localhost`, descartando cadenas
> vacías, que era el escenario real del incidente. El peor caso pasa de "URL inválida en
> producción" a "el dominio de Vercel en vez del propio".
