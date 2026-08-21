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
| Auth | Supabase Auth — **Google OAuth** | a implementar |
| Emails | Transaccional (Resend o similar) — **a decidir** | a implementar |
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
| `NEXT_PUBLIC_SITE_URL` | `https://xo-dance-studio.vercel.app` — actualizar al registrar dominio propio | No |

`NEXT_PUBLIC_WHATSAPP` es opcional: `lib/contacto.ts` cae al número correcto si falta.

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

### 5.2 Catálogo

**`sedes`** — `nombre, direccion, comuna, activa`
> **Dos sedes reales:** Los Leones y Los Dominicos. El sistema es multi-sede desde el día uno;
> ya no es una previsión, es un hecho.

**`salas`** — `sede_id, nombre, capacidad, costo_hora_clp`
> Los Leones: $17.000. Los Dominicos: $0. La capacidad máxima es **45**: tope duro de reservas
> por clase. El costo por sala es lo que permite calcular margen por clase dictada.

**`cursos`** — `slug, nombre, estilo, descripcion, edad_min, edad_max, activo`
**`profesoras`** — `nombre, alias, bio, foto_url, instagram, perfil_publico, porcentaje_comision, activa`
**`cursos_profesoras`** — relación muchos a muchos.

> **Requisito explícito:** cursos y profesoras se crean y editan **desde la página**, por un
> admin. No son datos de código. Los cinco cursos y las cinco profesoras de `lib/cursos.ts` y
> `lib/profesoras.ts` se cargan como **seed inicial editable**, no como valores fijos: la oferta
> ya cambió una vez y va a volver a cambiar. Ver PRD-0009.

### 5.3 Clases y calendario

**`clases`** — la unidad reservable. Una ocurrencia concreta en el calendario.
`curso_id, profesora_id, sala_id, fecha, hora_inicio, hora_fin, cupo_maximo (default 45),
estado (programada|realizada|cancelada), motivo_cancelacion`

> **Cambio importante de modelo.** Antes existía `secciones` (curso + horario fijo) y las
> alumnas se inscribían a la sección. Ahora la alumna reserva **clases individuales**, así que
> `clases` deja de ser un detalle operacional y pasa a ser el corazón del sistema.
> Sigue habiendo necesidad de generar clases recurrentes: ver `horarios_recurrentes`.

**`horarios_recurrentes`** — plantilla que genera clases.
`curso_id, profesora_id, sala_id, dia_semana, hora_inicio, hora_fin, vigente_desde,
vigente_hasta, activo`
Un proceso genera las `clases` de las próximas N semanas desde estas plantillas.

**`solicitudes_horario`** — una profesora pide un bloque nuevo.
`profesora_id, dia_semana, hora_inicio, hora_fin, curso_propuesto, mensaje,
estado (pendiente|aprobada|rechazada), resuelta_por, resuelta_at, respuesta`

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
`nombre, cantidad_clases, precio_clp, segmento (general|universitario), vigencia_dias, activo, orden`

Ocho filas iniciales: clase suelta, 2, 4 y 8 clases, cada una en sus dos segmentos.

| Plan | General | Universitario |
|---|---|---|
| Clase suelta | $9.000 | $8.000 |
| 2 clases | $16.000 | $14.000 |
| 4 clases | $30.000 | $26.000 |
| 8 clases | $52.000 | $48.000 |

**`vigencia_dias` = 60** en todos los planes: los créditos vencen a los **2 meses**.

> El precio vive en la tabla, no en el código: los precios cambian y no puede hacer falta un
> deploy para subirlos. El nombre propio de cada plan viene después; la estructura ya lo soporta.

**Tarifa universitaria.** `perfiles` necesita `es_universitaria`, `universitaria_verificada_at`,
`universitaria_verificada_por` y `certificado_url`.

Mecanismo definido: la alumna sube su **certificado de alumno regular** y un admin lo aprueba o
rechaza. Los planes universitarios solo se muestran y solo se pueden comprar con la verificación
aprobada.

⚠️ El certificado es un documento personal: va a un **bucket privado** de Storage, con URL
firmada y acceso solo para admin. Nunca público. Y tiene fecha: un certificado de alumno regular
vale por semestre, así que conviene guardar `verificacion_vence_at` y volver a pedirlo.

**`compras`** — una transacción.
`perfil_id, plan_id, cantidad_clases, monto_clp, estado (pendiente|pagada|fallida|reembolsada),
medio_pago, referencia_pasarela, pagada_at`

**`creditos`** — el saldo. **No es un contador simple.**
`perfil_id, compra_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento, estado`

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
2. No se puede reservar si `reservas confirmadas >= cupo_maximo` (45).
3. No se puede reservar sin crédito disponible y vigente.
4. La reserva y el descuento del crédito ocurren en **una sola transacción**. Si falla el email,
   la reserva vale igual; si falla el descuento, no hay reserva.
5. No se puede reservar una clase que ya pasó ni una cancelada.
6. Cancelar una reserva devuelve el crédito hasta **30 minutos antes** del inicio de la clase.
   Después de ese momento, la cancelación libera el cupo pero **no devuelve el crédito**.
7. Si XO cancela la clase, el crédito se devuelve siempre, sin importar la ventana.

⚠️ **Concurrencia.** Con 45 cupos y campañas de Instagram, dos personas pueden reservar el
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
| Política RLS de `select`/`update` para `admin` y `owner` | Hoy nadie puede leer la tabla |

⚠️ **No relajar la seguridad actual por comodidad.** El camino es una política RLS por rol, no
devolver grants a `anon`.

---

## 7. ⚠️ Decisiones abiertas que bloquean el esquema

Estas no se resuelven programando. Ver `CONTEXT.md` §13.

1. ✅ **Resuelto: modelo híbrido.** Teens con suscripción mensual; Girly y K-Pop con packs. El
   esquema tiene las dos ramas (§5.3.b y §5.4).
2. **¿Los créditos vencen?** Sin vencimiento, la caja cobrada hoy es un pasivo eterno. Con
   vencimiento, hay que definir el plazo y comunicarlo.
3. **Ventana de cancelación.** ¿Hasta cuántas horas antes se devuelve el crédito? Sin regla, una
   clase con 45 reservas puede quedar con 6 personas.
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
- Ocupación por clase (reservas / 45) y por horario
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
| Fallback de `metadataBase` | `app/layout.tsx` cae a `localhost:3000` si falta la variable. Ya causó un incidente. **Arreglo:** encadenar `NEXT_PUBLIC_SITE_URL` → `VERCEL_PROJECT_PRODUCTION_URL` → localhost |
| Sin alerta de caída | Nadie se entera si el formulario deja de guardar leads. Con Supabase pausándose solo en plan gratuito, es un agujero real |
| Plan gratuito de Supabase | Se pausa tras ~1 semana sin actividad. Con cobros online esto pasa de molestia a inaceptable: subir a Pro antes de cobrar |
| Catálogo en `/lib` | `cursos.ts` y `profesoras.ts` deben migrar a base de datos |
| Sin tests | `lib/lead.ts` es lógica pura, candidato obvio. La lógica de créditos **sí o sí** necesita tests |
| `README.md` | Sigue siendo el de `create-next-app` |
| Dominio | Sin registrar |
