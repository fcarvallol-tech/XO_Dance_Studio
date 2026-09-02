# PRD-0017 — Compras por transferencia, reservas e importación de alumnas

| Campo | Valor |
|---|---|
| **Estado** | **Aprobado** el 31/08/2026 · **partes 1 y 2 implementadas** |
| **Autor** | Felipe Carvalho |
| **Fecha** | 31 de agosto de 2026 |
| **Hito** | Hito 2 — Venta de clases · Hito 3 — Reservas |
| **PRDs relacionados** | PRD-0005 (planes y créditos) · PRD-0006 (calendario y reservas) · PRD-0009 (admin) · PRD-0016 (horarios y sedes) · ADR-0002 (créditos) · ADR-0003 (pasarela) · **ADR-0007 (correo)** |

---

## 1. Problema

Hay demanda entrando **ahora** y no hay forma de cobrarle. La pasarela depende del Inicio de
Actividades, que sigue en trámite, y mientras tanto todo se coordina a mano por WhatsApp: la
alumna transfiere, alguien mira la cuenta, alguien anota en una planilla, y el cupo se guarda de
palabra.

Eso ya está fallando en un caso concreto: **el horario Girly del viernes está por llenar sus 22
cupos con alumnas que ya pagaron**, y hoy nada impide que alguien nueva tome el último lugar y
desplace a quien pagó primero. El problema no es de comodidad, es que se puede vender dos veces
el mismo asiento.

ADR-0003 ya había previsto esta salida: *"aceptar transferencia bancaria con registro manual del
pago por admin. Permite operar desde el día uno sin depender del SII ni de la pasarela"*. Esto es
esa alternativa, construida.

## 2. Usuario y contexto de uso

- **La alumna**, desde el teléfono. Transfiere por su app del banco, vuelve al sitio y declara que
  pagó. Después entra a reservar. No quiere esperar a nadie para lo segundo.
- **El admin** (Carla o Felipe), desde el computador, una o dos veces al día: abre la cuenta
  bancaria, compara con las compras pendientes y aprueba o rechaza con un botón.

## 3. Alcance

1. **Declaración de transferencia**: la alumna elige plan, transfiere por fuera y declara el pago.
   La compra queda `pendiente`.
2. **Aviso por correo a la academia** cuando entra una declaración.
3. **Bandeja de aprobación** para admin: aprobar o rechazar con un botón, con motivo si rechaza.
4. **Acreditación al aprobar**: lote de créditos con vigencia de 60 días, en una sola transacción
   con el cambio de estado y el asiento en el libro.
5. **Tabla `clases`**: instancias fechadas generadas desde `horarios`, para los próximos 60 días.
6. **Calendario de 60 días** y **reserva instantánea**, sin aprobación, descontando un crédito.
7. **Cancelación** hasta 30 minutos antes con devolución del crédito.
8. **Importación de las alumnas que ya pagaron**, con sus créditos **y sus reservas**. Ver §9.

## 4. Fuera de alcance

- **La pasarela de pago.** Ver §5.4: no se descarta, se pospone.
- **Lista de espera** cuando una clase está llena → PRD-0006 ya la dejó fuera y sigue fuera.
- **Reserva recurrente** ("todos los lunes"). La importación las crea, pero la alumna no.
- **Tope de reservas simultáneas.** Ver §7.4.
- **La rama de suscripción de Teens.** Teens no usa créditos (ADR-0002). Sus alumnas entran por
  importación pero su cobro mensual no se construye acá.

## 5. Flujo de compra

### 5.1 Declarar

La alumna elige un plan, ve los **datos de transferencia** —cuenta, RUT, nombre, correo— y un
monto exacto. Transfiere en su banco. Vuelve y declara: confirma el plan y, opcionalmente, el
nombre de quien transfirió si no es ella.

Se crea una `compras` en estado **`pendiente`**. **No se reserva nada, no se toca ningún cupo.**

### 5.2 Avisar

Sale un correo a la academia: quién, qué plan, cuánto, cuándo. Con un enlace directo a la bandeja.

⚠️ El correo es **aviso, no mecanismo**: si falla el envío, la compra igual está en la bandeja.
Una compra nunca se pierde porque un correo no salió.

### 5.3 Aprobar o rechazar

El admin abre la cuenta bancaria, encuentra el abono y aprieta **Aprobar**. En una sola
transacción:

1. `compras.estado = 'pagada'`, con `aprobada_por` y `aprobada_at`.
2. Se crea un lote en `creditos` con `cantidad_inicial = plan.cantidad_clases` y
   `fecha_vencimiento = now() + 60 días`.
3. Se escribe el asiento en `movimientos_credito` (tipo `compra`).

Si rechaza: `estado = 'rechazada'` con motivo obligatorio, y correo a la alumna. **No se
acredita nada.**

### 5.4 Qué pasa con Flow

**Esto no reemplaza a ADR-0003, lo antecede.** Flow sigue siendo la pasarela elegida y entra
después como **segundo camino de acreditación**, no como reemplazo:

> La acreditación —crear el lote, escribir el asiento, devolver los créditos— vive en **una sola
> función de base de datos**, `acreditar_compra(compra_id, actor)`. La transferencia la llama
> desde la bandeja de admin; el webhook de Flow la llamará desde la Route Handler. Cambia **quién
> confirma el pago**, no qué pasa después.

Por eso `compras.medio_pago` existe desde ahora con valor `transferencia`, y por eso el estado
`pendiente` no es "esperando a un humano" sino "esperando confirmación de pago", venga de donde
venga. **Quien transfiera va a seguir pudiendo transferir** cuando Flow exista.

`PRD-0005` mantiene su alcance de planes, créditos y libro de movimientos; lo que sale de ahí
—por ahora— es solo el punto 3, la integración con Flow.

## 6. Flujo de reserva

La alumna entra al calendario, ve los **próximos 60 días** y reserva. **Al instante, sin
aprobación.** Se descuenta un crédito.

**60 días y no una semana, a propósito:** es exactamente la vigencia del crédito. Cualquier clase
que la alumna ve en el calendario la puede pagar con el crédito que acaba de comprar. Una ventana
semanal la obligaría a volver a mirar cinco veces para planificar algo que ya pagó, y escondería
justamente lo que hace valioso al crédito universal: que sirve para toda la parrilla.

## 7. Reglas de negocio

### 7.1 Los cupos no se retienen por una compra pendiente

Una compra `pendiente` **no ocupa nada**. El cupo se ocupa al reservar, y para reservar hace
falta crédito, y para tener crédito hace falta que la compra esté aprobada.

Es deliberado y tiene un costo que conviene mirar: alguien puede transferir y descubrir, cuando
le aprueban, que el horario que quería se llenó. **La alternativa es peor**: retener cupos por
compras que quizá nunca se pagan deja asientos muertos que nadie puede tomar, y con 22 lugares
eso se nota mucho más que con 45.

### 7.2 Reserva y crédito son una sola transacción

Sigue vigente y es la regla más importante del sistema: **el cupo se valida en la base**, no
leyendo un conteo y escribiendo después. Con 22 lugares y campañas de Instagram, dos personas
tomando el último asiento a la vez no es hipotético.

### 7.3 Cancelación

Hasta **30 minutos antes** del inicio, devolviendo el crédito **a su lote original** —para que no
se extienda su vencimiento por cancelar—. Después se puede cancelar igual, liberando el cupo,
pero sin devolución.

El plazo es **configurable en base de datos**, como exige PRD-0006 §8.

### 7.4 Sin tope de reservas simultáneas — anotado como palanca futura

Hoy nadie puede reservar más clases que créditos tenga, y eso ya es un tope natural: con 8
créditos se reservan 8 clases y se acabó.

⚠️ **Queda anotado como palanca**, no como pendiente: si aparece el patrón de alguien que reserva
las 8 en el mismo horario y deja fuera a ocho personas distintas, o que reserva mucho y asiste
poco, el control es un tope de reservas activas simultáneas. Se agrega como parámetro, del mismo
modo que la ventana de cancelación. No se construye ahora porque no hay evidencia de que el
problema exista.

### 7.5 El resto

1. Una reserva confirmada por alumna y clase. Sin duplicados.
2. Tope de **22** por clase.
3. No se reserva en el pasado ni en clases canceladas.
4. Si XO cancela una clase, se devuelve el crédito a todas, sin importar la ventana.
5. El monto de una compra **nunca se recalcula**: queda congelado en `compras.monto_clp`.

## 8. Modelo de datos

### 8.1 `compras` — con la declaración de transferencia

```sql
create table public.compras (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  plan_id uuid not null references public.planes (id) on delete restrict,
  -- Congelados al comprar: el plan puede cambiar de precio después.
  cantidad_clases int not null check (cantidad_clases > 0),
  monto_clp int not null check (monto_clp >= 0),
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'pagada', 'rechazada', 'reembolsada')),
  medio_pago text not null default 'transferencia'
    check (medio_pago in ('transferencia', 'flow', 'importacion')),

  -- Lo que declara la alumna. Todo opcional salvo la fecha: no se le pide
  -- adjuntar nada, porque el admin igual va a mirar la cuenta.
  declarada_at timestamptz not null default now(),
  titular_declarado text,
  nota_alumna text,

  -- Lo que hace el admin.
  aprobada_por uuid references public.perfiles (id),
  aprobada_at timestamptz,
  motivo_rechazo text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- Un rechazo sin motivo es un callejón sin salida para quien pagó.
alter table public.compras add constraint compras_rechazo_con_motivo
  check (estado <> 'rechazada' or motivo_rechazo is not null);
```

### 8.2 `clases` — las instancias fechadas

`horarios` es la plantilla semanal; `clases` es cada ocurrencia con fecha. Las reservas apuntan
acá, nunca a `horarios`.

```sql
create table public.clases (
  id uuid primary key default gen_random_uuid(),
  horario_id uuid not null references public.horarios (id) on delete restrict,
  fecha date not null,
  inicio timestamptz not null,
  -- Se copian del horario al generar: si mañana cambia el horario, las clases
  -- ya generadas y reservadas no se mueven solas.
  curso_id uuid not null references public.cursos (id) on delete restrict,
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  sede_id uuid not null references public.sedes (id) on delete restrict,
  cupo_maximo int not null default 22 check (cupo_maximo > 0),
  estado text not null default 'programada'
    check (estado in ('programada', 'cancelada')),
  motivo_cancelacion text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index clases_horario_fecha on public.clases (horario_id, fecha);
create index clases_inicio_idx on public.clases (inicio) where estado = 'programada';
```

**`cupo_maximo` se copia en la clase**, no se lee de la sala: si mañana la sala cambia de
capacidad, una clase ya reservada no puede quedar sobrevendida de golpe.

**Generación.** Una función `generar_clases(dias int default 70)` idempotente —el índice único la
hace segura de re-ejecutar— que materializa desde `horarios` activos. Se corre:

- a diario, con **pg_cron** (⚠️ confirmar que esté disponible en el plan actual de Supabase; si no,
  un Vercel Cron llamando a una Route Handler con secreto, como `/api/revalidar`);
- a mano desde admin, con un botón;
- **antes de importar**, porque la importación necesita clases donde colgar las reservas.

Se generan **70 días** y se muestran **60**: el margen evita que un día sin cron deje el final del
calendario vacío.

### 8.3 `reservas`

```sql
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid not null references public.perfiles (id) on delete restrict,
  clase_id uuid not null references public.clases (id) on delete restrict,
  -- De qué lote salió el crédito. Sin esto, cancelar no sabe a dónde devolverlo.
  credito_id uuid not null references public.creditos (id) on delete restrict,
  estado text not null default 'confirmada'
    check (estado in ('confirmada', 'cancelada', 'asistio', 'no_asistio')),
  cancelada_at timestamptz,
  credito_devuelto boolean not null default false,
  origen text not null default 'web' check (origen in ('web', 'admin', 'importacion')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Una persona, una clase. Parcial: cancelar y volver a reservar debe poderse.
create unique index reservas_una_por_clase
  on public.reservas (perfil_id, clase_id)
  where estado in ('confirmada', 'asistio');
```

### 8.4 `parametros` — lo que se ajusta sin desplegar

```sql
create table public.parametros (
  clave text primary key,
  valor text not null,
  descripcion text,
  updated_at timestamptz not null default now()
);
```

Arranca con `cancelacion_minutos = 30` y `calendario_dias = 60`. Es lo que PRD-0006 §8 exige como
criterio de aceptación, y el lugar natural donde entraría el tope de §7.4.

### 8.5 Las dos funciones que concentran el riesgo

```sql
-- Acredita: cambia estado, crea el lote y escribe el asiento, o no hace nada.
-- La llama la bandeja de admin hoy y el webhook de Flow mañana.
acreditar_compra(p_compra_id uuid, p_actor_user_id uuid) returns public.compras

-- Reserva: valida cupo, consume del lote que vence antes, crea la reserva y
-- escribe el asiento. Todo o nada.
reservar(p_clase_id uuid, p_actor_user_id uuid) returns public.reservas

-- Cancela: libera el cupo y devuelve el crédito a su lote si está a tiempo.
cancelar_reserva(p_reserva_id uuid, p_actor_user_id uuid) returns public.reservas
```

Las tres son `security definer` y con validación completa adentro: son la única capa que resiste
una llamada directa con la service role key. Es la misma forma de `cambiar_rol` y `crear_lead`.

**Consumo FIFO por vencimiento:** se gasta primero el lote que vence antes. Es lo que ya pide
`ARCHITECTURE.md` §5.4.

### 8.6 RLS

| Tabla | Alumna | `admin`+ |
|---|---|---|
| `clases` | `select` de las programadas | todo |
| `compras` | `select` e `insert` de **las suyas** | `select` de todas; aprobar solo vía función |
| `creditos`, `movimientos_credito` | `select` de los suyos | `select` de todos |
| `reservas` | `select` de las suyas; crear y cancelar **solo vía función** | `select` de todas |
| `parametros` | `select` | `update` |

⚠️ **Ninguna tabla de dinero o cupo acepta `insert`/`update` directo desde `authenticated`.** Todo
pasa por las funciones de §8.5. Es la regla de `CLAUDE.md` sobre créditos y cupos, aplicada con
grants, no con confianza.

## 9. Importación de las alumnas que ya pagaron

### 9.1 El mapeo de "Curso Reservado"

La columna usa abreviaturas: `R` = Reggaeton Femme, `G` = Girly, más el día. **El par (letra, día)
identifica un horario único**, y eso se puede afirmar mirando los siete:

| Abreviatura | Horario | Profesora | Sede |
|---|---|---|---|
| `R lunes` | Reggaeton Femme, lunes 17:00 | Drimy | Providencia |
| `R miércoles` | Reggaeton Femme, miércoles 20:00 | Pau | Las Condes |
| `G lunes` | Girly, lunes 20:00 | Pau | Las Condes |
| `G viernes` | Girly, viernes 20:00 | Carli | Providencia |
| `G sábado` | Girly, sábado 18:00 | Carli | Providencia |
| `S sábado` | Slow Femme, sábado 17:00 | Lina | Providencia |
| `T lunes` | Teens, lunes 18:00 | Carli | Las Condes |

**Por qué no hay ambigüedad:** ningún curso se repite dos veces el mismo día. Reggaeton Femme está
lunes y miércoles; Girly lunes, viernes y sábado; y el sábado hay dos clases pero de cursos
distintos —Girly a las 18:00 y Slow Femme a las 17:00—, que la letra separa. Girly tiene tres
horarios y Reggaeton dos, pero **el día resuelve cuál**.

`"G lunes y R miércoles"` se parte por `y` y da dos horarios.

⚠️ Lo que sí falla el mapeo: una fila **sin letra** (`"sábado"` a secas) o **sin día** (`"G"`).
Ambas van a §9.5.

### 9.2 Las reservas se pre-crean, no solo los créditos

Es el punto que hace urgente esta importación. **Girly viernes está por llenar sus 22 cupos con
alumnas que ya pagaron**: si solo se acreditan créditos, el asiento queda disponible y alguien
nueva puede tomarlo. Se estaría vendiendo dos veces el mismo lugar.

Las reservas son derivables:

- **N clases en un horario** → las **próximas N fechas** de ese horario.
- **N clases en dos horarios** → `N/2` en cada uno, alternando. 8 clases en `G lunes y R
  miércoles` son 4 y 4.
- Si `N` no divide exacto entre los horarios declarados, la fila va a §9.5.

Cada reserva consume un crédito del lote importado, igual que una reserva normal: al terminar, la
alumna queda con **0 créditos y N reservas**, que es exactamente lo que compró. Si cancela una a
tiempo, recupera el crédito y puede usarlo donde quiera. El sistema no la trata distinto por
haber entrado por importación; solo el campo `origen` lo recuerda.

**Orden de proceso:** por fecha de pago, la más antigua primero. Si un horario se llena a mitad de
la importación, quien queda fuera es quien pagó después, y su fila va a §9.5 para resolverla a
mano. Nunca se pasa por encima del tope de 22.

### 9.3 Falta el correo en la mayoría de las filas

`auth.users` exige un correo único, y sin usuario no hay perfil, y sin perfil no hay dónde colgar
créditos ni reservas. Pero el cupo hay que tomarlo **ahora**, no cuando aparezca el correo.

**Propuesta: importar igual, con un correo temporal en un dominio reservado.**

- Se crea el usuario con `admin.createUser` y correo `<slug>@importada.invalid`. El TLD `.invalid`
  está reservado por RFC 2606: no existe, no resuelve y nadie puede recibir correo ahí. No se le
  manda nada.
- El perfil queda con **`pendiente_de_correo = true`**, y admin ve la lista de quiénes son.
- Cuando la alumna entrega su correo, un admin lo carga: se actualiza el correo en `auth.users` y
  se apaga la bandera. **Créditos y reservas ya están colgando de ese perfil**, así que no se mueve
  nada. Desde ese momento entra con magic link o Google.

Por qué esto y no una tabla aparte de "preinscripciones": porque las reservas tienen que apuntar a
un `perfil_id` real para que el cupo esté de verdad tomado. Una tabla paralela dejaría el asiento
libre, que es justo lo que hay que evitar.

### 9.3.b El duplicado tiene que ser visible, no solo estar anotado

Si la alumna se registra sola con su correo real **antes** de que un admin cargue el suyo, queda
con dos cuentas: una con sus créditos y sus reservas, otra vacía. **Con 36 alumnas sin correo
cargado, alguna lo va a hacer.** Tratarlo como un riesgo anotado en un documento es garantizar
que nadie se entere hasta que la alumna reclame que perdió sus clases.

No hace falta fusión automática —es una decisión con plata de por medio y debe tomarla una
persona—, pero sí que el sistema levante la mano. **Dos señales, en dos vistas:**

**`duplicados_probables`** cruza cada perfil `pendiente_de_correo` con perfiles que **no** lo
están y cuyo **nombre normalizado coincide** —sin tildes, sin mayúsculas, sin espacios de más—.
Devuelve las dos filas lado a lado con sus saldos, para que se vea de un vistazo cuál tiene las
clases y cuál no.

**`perfiles_sin_actividad`** lista cuentas de alumna **sin créditos y sin reservas**. Es la otra
mitad: alguien que se registró sola y no tiene nada es, o una interesada nueva, o exactamente el
duplicado que buscamos. Aparece ahí **antes** de que note que le faltan sus clases.

Las dos vistas van con `security_invoker = true`, así que respetan el RLS de `perfiles`: solo un
admin ve filas. Sin eso, una vista sobre `perfiles` filtra la tabla entera.

La coincidencia por nombre no es perfecta —dos alumnas pueden llamarse igual, y alguien puede
registrarse como "Cata" habiéndose inscrito como "Catalina"—, y por eso son **señales para
revisar**, no reglas. El costo de un falso positivo es que un admin mire dos filas y descarte;
el de un falso negativo, que alguien pierda clases que pagó.

PRD-0009 las va a mostrar en el portal de administración. Mientras tanto se consultan desde el
Table Editor, que es donde igual se están cargando los correos.

**Cuanto antes se cierre esa ventana, mejor.** No es un estado en el que convenga quedarse.

### 9.4 El monto: se registra el que se pagó

Los precios de la planilla son **de promoción**, no de lista: 4 clases a $20.000 y 8 a $36.000
hasta el 31 de agosto, contra $28.000 y $48.000 de lista.

Se crea una `compras` real por cada fila, con `monto_clp` = **lo efectivamente transferido**,
`medio_pago = 'importacion'`, `estado = 'pagada'` y `pagada_at` con la fecha del pago si está, o
la de importación si no.

> ✅ **Resuelto el 31/08/2026: el movimiento es de tipo `compra`, no `regalo`.**
>
> `regalo` existe para clases que la academia **no cobró**. Estas se cobraron: son cerca de
> **$950.000 efectivamente recibidos**. Registrarlas como regalo dejaría el dashboard de owner
> (PRD-0010) reportando casi un millón de pesos menos de los que entraron, y la conciliación con
> la cuenta bancaria no cuadraría nunca.
>
> El motivo *"pack pagado antes del sistema"* se conserva en `movimientos_credito.motivo` y en
> `compras.nota_alumna`. Lo que distingue estas compras del resto es `medio_pago = 'importacion'`,
> que permite aislarlas en cualquier reporte sin sacarlas de los ingresos.

**Vigencia de los créditos importados: 60 días desde la importación**, no desde el pago original.
Es más generoso y es más simple; y como ya vienen consumidos por las reservas pre-creadas, en la
mayoría de los casos el vencimiento no llega a aplicar.

### 9.5 Filas que requieren decisión manual antes de importar

**La importación no adivina.** Cualquier fila que caiga en uno de estos casos se aparta y se
resuelve con Felipe o Carla antes de correr nada:

| Caso | Cómo se detecta | Por qué no se puede resolver solo |
|---|---|---|
| **Monto que no calza con ningún plan** | El monto no es $8.500, $16.000, $28.000, $48.000 ni las promos $20.000 y $36.000 | Puede ser un descuento acordado, un pago parcial o un error de tipeo. Adivinar el plan cambia cuántas clases recibe |
| **Cantidad de clases sin pack equivalente** | No es 1, 2, 4 ni 8 | No hay plan al cual asociarla, y `compras.plan_id` es obligatorio |
| **Pago pendiente** | La fila viene sin monto, o marcada como no pagada | No se acredita nada por algo que no entró a la cuenta |
| **Curso sin especificar** | Vacío, o sin letra, o sin día | No hay horario al cual colgar las reservas. Con crédito sin reserva perdería el cupo |
| **Clases no divisibles entre los horarios** | Ej. 3 clases en dos horarios | Repartir 2 y 1 es una decisión de negocio, no aritmética |
| **El horario ya está lleno** | Al procesar, el horario llegó a 22 | Alguien tiene que decidir a qué otro horario va, o si se abre uno |
| **Correo repetido** | Dos filas con el mismo correo | Puede ser la misma persona con dos packs, o un error |
| **Monto y cantidad de clases que no concuerdan** | Ej. 8 clases con monto de pack de 4 | Una de las dos columnas está mal y hay que saber cuál |

La importación corre en **dos pasadas**: una de **simulación**, que no escribe nada y devuelve el
informe de qué se importaría y qué queda apartado; y la real, que solo corre cuando la lista de
apartadas está resuelta o aceptada.

### 9.6 Cómo se ejecuta

Un script en `scripts/importar-alumnas.ts`, no una pantalla: se corre una vez, con supervisión, y
construir interfaz para eso es trabajo que se tira a la basura. Lee un CSV exportado del Sheet,
usa la service role key, y es **idempotente por correo o por nombre completo**: correrlo dos veces
no duplica ni personas ni créditos.

## 10. Correo

Tres correos: aviso de declaración a la academia, aprobación a la alumna, rechazo con motivo a la
alumna. Más adelante, comprobante de reserva (PRD-0006 §3.5).

`ARCHITECTURE.md` §1 dejaba el proveedor "a decidir". **Propuesta: Resend**, por integración
simple con Next, dominio propio y plan gratuito suficiente para este volumen.

✅ **Escrito como `decisions/0007-proveedor-de-correo.md`**, porque sin correo transaccional este
PRD no cierra: el aviso de transferencia declarada y el comprobante de reserva están los dos
dentro del alcance.

Lo que decide el ADR no es el precio —a este volumen todos son gratis o casi— sino **dónde viven
las plantillas**: con `react-email` un correo es un componente más del repo, se revisa en un pull
request y usa los mismos tokens de `BRAND.md` que el sitio, en vez de vivir en una consola donde
alguien edita HTML sin dejar rastro.

⚠️ **Consecuencia que ese ADR destapa y que este PRD hereda:** Resend exige un dominio propio
verificado para enviar con buena reputación, y `xodancestudio.cl` **sigue sin registrarse**
(`CONTEXT.md` §12). Se puede arrancar con el dominio de prueba de Resend, pero eso manda los
correos desde una dirección que no es de XO — y son correos de dinero. **Registrar el dominio pasa
a ser requisito de este PRD**, no una tarea suelta de marca.

⚠️ **El correo nunca es parte de una transacción.** Si falla el envío, la compra se aprobó igual y
la reserva existe igual. Se reintenta; no se revierte plata por un problema de correo.

## 11. Criterios de aceptación

- [ ] Declarar una transferencia crea una compra `pendiente` y **no toca ningún cupo**.
- [ ] Llega el correo de aviso a la academia, y si no llega, la compra igual está en la bandeja.
- [ ] Aprobar acredita exactamente las clases del plan, con vencimiento a 60 días, y deja asiento
      en el libro.
- [ ] Aprobar dos veces la misma compra no acredita dos veces.
- [ ] Rechazar sin motivo es imposible.
- [ ] El calendario muestra 60 días y no una semana.
- [ ] Reservar descuenta un crédito y crea la reserva, en una transacción.
- [ ] Con 22 reservas la clase no acepta más, ni con dos personas reservando a la vez. Hay test.
- [ ] Cancelar a más de 30 minutos devuelve el crédito **a su lote original**; a menos, no.
- [ ] La ventana de cancelación se cambia sin desplegar.
- [ ] `authenticated` no puede insertar en `creditos`, `reservas` ni `compras` fuera de las
      funciones, verificado con la llave publishable contra la API.
- [ ] La simulación de importación no escribe nada y lista las filas apartadas.
- [ ] Tras importar, una alumna con 4 clases en `G viernes` tiene 4 reservas y 0 créditos.
- [ ] Cambiar el correo de una alumna importada conserva sus créditos y reservas.

## 12. Métrica de éxito

**Cuántas horas pasan entre que una alumna declara y un admin resuelve**, medido sobre la primera
semana. Si la mediana pasa de un día, la aprobación manual se vuelve el cuello de botella que la
pasarela tenía que resolver, y eso cambia la prioridad de Flow.

Métrica secundaria, para el problema que originó todo: **cero casos de alguien que pagó y se quedó
sin cupo** en el horario que había reservado.

## 13. Riesgos y supuestos

- **La aprobación manual depende de que alguien mire.** Un fin de semana sin revisar es una alumna
  con la plata transferida y sin poder reservar. Es el costo asumido de no tener pasarela.
- **`pg_cron` puede no estar disponible** en el plan actual de Supabase. ⚠️ Confirmar antes de
  implementar; si no está, el generador va por Vercel Cron.
- **La ventana de correos temporales** de §9.3 es el riesgo operativo más real de este PRD.
- **Supabase pausado** ya no solo rompe el deploy: rompe reservar y comprar. Con dinero real
  entrando, subir a Pro deja de ser opcional.
- **Se asume que la planilla tiene fecha de pago** o que el orden de las filas la refleja. Si no,
  el orden de proceso de §9.2 es arbitrario y hay que definirlo a mano.
- **La ventana de 30 minutos sigue siendo generosa**, como ya advertía PRD-0006 §7. Con 22 cupos
  el impacto de una cancelación tardía es proporcionalmente mayor que con 45.

## 14. Entrega por partes

Aprobado el 31/08/2026 implementar esto en tres tramos, con revisión entre uno y otro.

| Parte | Qué | Estado |
|---|---|---|
| **1** | Esquema, funciones, RLS y ADR-0007 | ✅ **Hecha.** Migración escrita, **sin aplicar** |
| **2** | Interfaz, unificación de planes y generador de clases | ✅ **Hecha.** Migración escrita, **sin aplicar** |
| **3** | Script de importación | ⏳ **Se implementa, no se ejecuta** |

**Por qué la importación se construye pero no se corre:** faltan 36 correos y hay filas que
requieren decisión manual (§9.5). Queda lista, con su pasada de simulación, para el día en que
los datos estén completos.

## 15. Notas de implementación — parte 1

| Pieza | Dónde |
|---|---|
| Esquema, funciones, RLS y vistas | `supabase/migrations/20260831120000_compras_creditos_y_reservas.sql` |
| Decisión de proveedor de correo | `context/decisions/0007-proveedor-de-correo.md` |

Decisiones tomadas al escribir la migración:

- **La concurrencia del último cupo se resuelve bloqueando la fila de la clase**
  (`select … for update`), no con un constraint. Serializa solo a quienes reservan **esa** clase,
  y deja el conteo imposible de quedar obsoleto entre que se lee y se escribe. Un constraint sobre
  un conteo agregado no existe en Postgres sin materializarlo, y materializarlo es otro dato que
  se puede desincronizar.
- **`acreditar_compra` es idempotente.** Si la compra ya está `pagada`, devuelve y no acredita de
  nuevo. Es lo que hace segura la aprobación con doble clic hoy, y lo que va a hacer seguro el
  webhook de Flow mañana, que llega repetido por diseño.
- **`generar_clases` convierte a hora de Santiago explícitamente.** Las clases se piensan en hora
  local y se guardan en UTC; sin el `at time zone` el horario se corre con el cambio de hora.
- **`reservar` acepta `p_perfil_id`** para que un admin reserve a nombre de otra persona. Lo
  necesita la importación, y lo va a necesitar el portal de administración.
- **Devolver un crédito a un lote ya vencido queda registrado en el motivo del movimiento.** Puede
  pasar: se reserva con un lote a punto de vencer y se cancela después. Se devuelve igual —no
  quedarse con el crédito de alguien es lo correcto— pero que el libro lo diga evita el reclamo de
  "me devolvieron algo que no puedo usar" sin explicación.
- **El libro es append-only también para `service_role`**, con `revoke update, delete`. Salta RLS,
  no salta grants. Mismo criterio que `cambios_rol`.
- **`planes` se siembra con los precios de lista.** ⚠️ `lib/planes.ts` sigue siendo lo que dibuja
  la sección Planes del sitio: **son dos fuentes para el mismo dato** y hay que unificarlas en la
  parte 2, antes de que se desincronicen. Está anotado en la migración.
- **La migración termina llamando a `generar_clases()`**, para que el calendario quede poblado
  apenas se aplique.

⚠️ **Sin aplicar**, como se pidió. Al aplicarla conviene verificar tres cosas: que se generaron
clases para los siete horarios, que `authenticated` no puede insertar en `creditos` ni `reservas`
con la llave publishable, y que dos reservas simultáneas sobre el último cupo dejan pasar una sola.

⚠️ **`pg_cron` sigue por confirmar.** Sin él, las clases se generan solo al aplicar la migración y
al apretar el botón de admin, y el calendario se va quedando corto por el final.

## 16. Notas de implementación — parte 2

| Pieza | Dónde |
|---|---|
| Promo en la base y datos de transferencia | `supabase/migrations/20260831130000_planes_promo_y_transferencia.sql` |
| Planes desde la base | `lib/planes.ts` (tipos y formato) · `lib/planes-consultas.ts` |
| Correo | `lib/correo.ts` |
| Escrituras de plata y cupo | `lib/acciones.ts` |
| Comprar | `app/(cuenta)/comprar/` · `components/FormularioCompra.tsx` |
| Calendario y reservas | `app/(cuenta)/reservar/` · `components/Calendario.tsx` |
| Mis clases | `app/(cuenta)/mis-clases/` · `components/MisReservas.tsx` |
| Bandeja de aprobación | `app/(admin)/admin/compras/` · `components/BandejaCompras.tsx` |
| Generador de clases | `app/api/generar-clases/route.ts` · `vercel.json` |

### Los planes quedaron unificados: manda la base

`lib/planes.ts` conserva tipos, formato de pesos y el cálculo de precio vigente. **Los precios se
fueron a la tabla `planes`.** Era la misma forma de incoherencia que ya nos pasó con los cursos, y
esta vez con plata de por medio.

Para que la promoción no quedara como única cosa en el código, se agregaron a `planes` tres
columnas provisionales: `precio_promocional`, `promo_hasta` y `promo_nombre`. **PRD-0012 las
reemplaza** cuando llegue con su tabla de períodos. Gana algo de inmediato: PRD-0014 §5 advertía
que la promo *"se apaga a mano y necesita deploy"* porque la landing es estática. Ahora se apaga
sola al pasar la fecha, y editarla desde el Table Editor refresca el sitio por webhook.

### `pg_cron` sigue sin confirmarse, así que hay camino alternativo

`/api/generar-clases` con secreto en cabecera, más una entrada en `vercel.json` que lo dispara a
diario. **Si `pg_cron` está disponible, lo correcto es agendar `select public.generar_clases()`
ahí**: es SQL puro, sin HTTP y sin un secreto que se pueda filtrar. Que corran los dos no rompe
nada — `generar_clases` es idempotente por índice único—, así que la decisión se puede tomar
después sin desarmar esto.

⚠️ Vercel Cron dispara **GET**, no POST. La ruta responde a los dos.

### El monto no viaja en el formulario

Se envía el slug del plan y **el servidor calcula cuánto vale**, promoción incluida. Si el precio
viniera del cliente, cualquiera podría declarar que pagó $1 y esperar que el admin no se fijara.

### Un defecto de la parte 1, encontrado al construir esta

`parametros` quedó sin grant para `service_role`: la migración revocó todo y lo devolvió a `anon`
y `authenticated`, olvidando al rol del servidor. Postgres lo dice literal —
*"GRANT SELECT ON public.parametros TO service_role"*— y es **el mismo descuido que hubo con
`perfiles`**. No se notaba porque `parametro_int` es `security definer` y corre como su dueño.
Corregido en la migración de esta parte.

### Otras decisiones

- **El conteo de cupos ajenos va con la service role key**, y es lo único de `compras-consultas.ts`
  que no usa la sesión. Una alumna no puede leer las reservas de otra —RLS se lo impide, y está
  bien— pero sí necesita saber cuántos lugares quedan. Lo que se devuelve es un número, nunca
  quién reservó.
- **A los correos `.invalid` no se les escribe.** Son las alumnas importadas sin correo real;
  mandarles algo sería un rebote garantizado.
- **El filtro del calendario atenúa en vez de esconder**, como pide `BRAND.md` §6, y no baja de
  55% de opacidad por lo que ese mismo documento advierte: una clase atenuada sigue siendo
  información.
- **Las fechas se formatean a mano** contra `America/Santiago`, no con `Intl` a secas, para que
  servidor y navegador escriban lo mismo. Una diferencia ahí es un error de hidratación.
- **`inicioSegunRol` para `alumna` pasa de `/mi-perfil` a `/mis-clases`**: ahora hay algo que hacer
  al entrar.

⚠️ **Los datos de transferencia se siembran vacíos**, y es a propósito: no los conozco y no se
inventan datos bancarios. Mientras estén vacíos, `/comprar` muestra que faltan y **no deja
declarar** — es mejor eso que mandar a alguien a transferir a ninguna parte. Se cargan desde el
Table Editor, en `parametros`.

⚠️ **Migración de la parte 2 sin aplicar.** La de la parte 1 **sí está aplicada** (verificado: 73
clases generadas, las siete tablas creadas). Hasta que corra la segunda, `npm run build` falla a
propósito con `column planes.precio_promocional does not exist`. Compilación y TypeScript pasan.

### Al aplicar, conviene verificar

- Que `/` vuelve a salir `○` y muestra los precios desde la base.
- Que `authenticated` no puede insertar en `creditos` ni `reservas` con la llave publishable.
- Que dos reservas simultáneas sobre el último cupo dejan pasar una sola.
- Que `service_role` ya puede leer `parametros`.

## 17. Nota de implementación — la bandeja vacía del 02/09/2026

**Síntoma:** `/admin/compras` decía "No hay transferencias esperando" con **cinco compras en
estado `pendiente`** en la base. El correo de aviso sí llegaba, así que declarar funcionaba.

**Lo que NO era: RLS.** La política existe y es correcta —
`compras_admin_lee ... using (public.tiene_nivel('admin'))` — y es la misma forma que
`leads_admin_lee` de PRD-0004, que funciona. Los grants también estaban.

### La causa: el embed a `perfiles` era ambiguo

`compras` tiene **dos llaves foráneas a `perfiles`**: `perfil_id` (de quién es la compra) y
`aprobada_por` (quién la revisó). Pedir `perfiles ( nombre, email )` a secas no le dice a
PostgREST cuál usar:

```
PGRST201: Could not embed because more than one relationship was found
          for 'compras' and 'perfiles'
```

El error ocurre **al parsear la consulta, antes de aplicar RLS**, y no devuelve ninguna fila.
Verificado con cuatro variantes: la desambiguada resuelve, la de `getMisCompras` —que no embebe
`perfiles`— nunca falló, y por eso la alumna sí veía sus compras.

`movimientos_credito` tenía **la misma ambigüedad latente**, por `perfil_id` y `creado_por`.
Quedó desambiguada también, aunque todavía no haya consulta que la use: los cuatro nombres de
llave están verificados contra la base y exportados como constantes.

### La causa de fondo: el error se convertía en lista vacía

Las ocho consultas de `lib/compras-consultas.ts` desestructuraban solo `data` y hacían
`data ?? []`. **Un fallo de lectura se volvía indistinguible del caso normal**, y "no hay
transferencias esperando" es exactamente la pantalla que se espera ver cuando de verdad no hay
ninguna. Por eso nadie lo notó.

PRD-0004 sí había hecho esto bien: la página de leads captura `error` y lo muestra. Al construir
la bandeja se copió la política de RLS pero no ese cuidado.

**Ahora toda consulta devuelve `Lectura<T> = { datos, error }`**, y las páginas muestran el error
con `<ErrorDeLectura>` — que dice explícitamente *"esto no significa que no haya nada: significa
que la consulta falló y no sabemos qué hay"*. La regla que impone el componente:

> Donde haya un estado vacío, primero se pregunta si hubo error. El vacío se muestra **solo si no
> lo hubo**.

Se extendió a `getCatalogoCompleto`, que tenía el mismo defecto y alimenta `/admin`,
`/admin/leads` y el portal de profesora. Auditado: no queda ninguna consulta que se trague un
error, salvo la lectura de `calendario_dias`, que es una preferencia con un valor por defecto
sensato y está comentada como excepción deliberada.

### Lo que esto deja como regla

Un fallo de lectura que se ve como ausencia de datos es **peor que el bug que lo causó**: no se
puede distinguir del caso normal, así que no se reporta y no se busca. Cualquier consulta nueva
va con su error a la vista.
