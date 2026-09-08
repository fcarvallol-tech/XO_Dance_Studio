# PRD-0010 — Dashboard de owner: métricas y finanzas

| Campo | Valor |
|---|---|
| **Estado** | Borrador — en revisión de Felipe |
| **Fecha** | 21 de agosto de 2026 · reescrito el 6 de septiembre de 2026 |
| **Hito** | Hito 5 |
| **Relacionados** | PRD-0009 · PRD-0017 · `ARCHITECTURE.md` §8 · ADR-0002 |

> **Qué cambió el 06/09/2026.** El PRD original describía el tablero completo en una pasada.
> Al revisarlo contra el esquema aparecieron tres cosas que no estaban: las tablas de finanzas
> no existen, no hay registro de asistencia, y nada emite el movimiento de expiración. El
> alcance se parte en tres entregas, se recortan dos métricas con su motivo escrito, y se
> agrega §11, que es cómo se verifica un tablero que hoy da cero en todo.

---

## 1. Problema

El owner necesita saber si el negocio está funcionando, no solo si la operación del día corre.
En un modelo de paquetes prepagados esto es menos obvio de lo que parece: la caja puede verse
excelente mientras el negocio se vacía, porque cobrar por adelantado no es lo mismo que
entregar el servicio.

Hay un problema adicional, propio de este momento: **hoy no hay ninguna compra ni ninguna
reserva real**. Un tablero recién construido va a mostrar cero en todo, y un cero se ve
exactamente igual cuando el sistema funciona que cuando la consulta está rota. Ya pasó en este
proyecto: la bandeja de transferencias decía "no hay transferencias esperando" con cinco
compras pendientes en la base, y nadie lo notó por meses porque esa es la pantalla que uno
espera ver cuando no hay ninguna (PRD-0017 §17). Un tablero entero con ese defecto es peor.

## 2. Usuario y contexto de uso

Carla, desde el computador, una o dos veces por semana, con diez minutos. La pregunta que trae
es concreta: *¿abro, muevo o cierro este horario?* No viene a explorar datos; viene a decidir.

También lo abre a fin de mes para pagarle a las profesoras y para saber cuánto quedó.

## 3. Alcance

Se entrega en tres partes. **Esta versión del PRD detalla la parte 1**; las partes 2 y 3 quedan
enunciadas y se detallan cuando la 1 esté cerrada.

### Parte 1 — Tablero de métricas

1. Bloque de **créditos**: vendidas, consumidas, vencidas sin usar, brecha, tasa de
   utilización, por vencer en 30 días, y la conciliación del libro contra los lotes.
2. Bloque de **venta**: ingresos del período, ticket promedio, plan más vendido.
3. Bloque de **demanda**: ocupación por clase sobre 22, ocupación por horario, ranking de
   profesoras por reservas y por ingreso atribuido.
4. Bloque de **alumnas**: activas, tasa de recompra, con crédito y sin reservar hace 30 días,
   embudo.
5. Bloque de **operación**: cancelaciones, separadas por si devolvieron el crédito.
6. Todo indicador con su comparación contra el período anterior y su número absoluto.
7. Acceso solo `owner`, verificado también en la base y no solo en la ruta.

### Parte 2 — Finanzas

8. Tabla `egresos` y página para registrarlos.
9. Costos por sede y por hora de profesora en la base, que es lo que permite calcular
   **caja neta** y **margen por clase dictada**.

### Parte 3 — Liquidación de profesoras

10. Tabla `liquidaciones_profesoras`: clases dictadas, monto y estado de pago.
11. **Registrar que una clase no se dictó, con causa y autor**, y descontarla de la liquidación.
    Requisito del 07/09/2026; lo que hace falta antes está en §8.5.

## 4. Fuera de alcance

- **Proyecciones y forecasting.** No hay serie histórica que justifique una proyección.
- **Exportar a contabilidad o integración con el SII.**
- **Métricas de Instagram.** Viven en Instagram.
- **No-shows.** Ver §6.1: no existe registro de asistencia, así que la métrica daría cero para
  siempre. Requiere un PRD propio que le dé a la profesora cómo tomar asistencia.
- **Ingresos de suscripciones (Teens).** PRD-0011 no está construido; no hay tabla
  `suscripciones` ni `cargos_mensuales`. El tablero declara que lo que muestra es solo packs.
- **La primera etapa del embudo, "visita".** Ver §6.2.

## 5. Los bloques del tablero

Todos toman un período. El predeterminado es el mes en curso, comparado con el anterior.

### 5.1 Créditos — el indicador propio de este modelo

Es el bloque que va primero en la página, porque es el que dice algo que la caja esconde.

| Indicador | Definición |
|---|---|
| **Clases vendidas** | Suma de `movimientos_credito.cantidad` con `tipo = 'compra'` en el período |
| **Clases regaladas** | Lo mismo con `tipo = 'regalo'`. **Se muestra aparte:** un regalo no es una venta |
| **Clases consumidas** | Consumo neto: suma de `cantidad` con `tipo in ('reserva','cancelacion')`. Una reserva resta, una devolución suma |
| **Vencidas sin usar** | Suma de `creditos.cantidad_disponible` en lotes con `fecha_vencimiento <= now()` |
| **Brecha (pasivo vigente)** | Suma de `creditos.cantidad_disponible` en lotes con `fecha_vencimiento > now()`. Es plata cobrada por un servicio que todavía se debe |
| **Tasa de utilización** | Consumidas ÷ otorgadas, **acumulado histórico**, no del período |
| **Por vencer en 30 días** | Disponible en lotes que vencen entre hoy y hoy + 30 días |
| **Conciliación** | Ver §5.1.b |

**La brecha tiene tres partes, no dos.** El PRD original la definía como vendidas − consumidas.
Eso sobreestima el pasivo, porque incluye créditos que ya vencieron y que nadie va a usar. Un
crédito vencido dejó de ser una deuda y pasó a ser margen: hay que separarlo, no sumarlo.

**La tasa de utilización es acumulada a propósito.** Por período no significa nada: alguien
compra ocho clases en septiembre y las gasta en octubre, y septiembre saldría con 0% de
utilización teniendo el negocio perfectamente sano.

#### 5.1.b La conciliación, que es lo que hace confiable al resto

Se muestra una franja arriba del bloque con dos números que **tienen que ser iguales**:

```
suma de movimientos_credito.cantidad   ==   suma de creditos.cantidad_disponible
```

Si no coinciden, el libro y los lotes se desincronizaron y **todo el bloque de créditos es
sospechoso**: la franja se pinta en rojo y lo dice. Es la única métrica del tablero cuyo valor
correcto se conoce de antemano, y por eso es también la mejor prueba de que las consultas leen
lo que creen leer.

⚠️ **La conciliación no se hace contra `saldo_resultante`.** Esa columna guarda el saldo
**vigente** al momento del asiento —`saldo_creditos()` filtra por `fecha_vencimiento > now()`—
así que no es el acumulado del libro y no cuadra con él por diseño. Verificado en la definición
de `saldo_creditos`, migración `20260831120000`. Nadie debe construir una métrica sobre esa
columna creyendo que es un acumulado.

### 5.2 Venta

Ingresos del período · ticket promedio · plan más vendido.

### 5.3 Demanda

Ocupación por clase sobre 22 · ocupación por horario, para ver saturados contra muertos ·
ranking de profesoras por reservas y por ingreso atribuido.

### 5.4 Alumnas

Activas · tasa de recompra · con crédito vigente y sin reservar hace más de 30 días · embudo.

### 5.5 Operación

Cancelaciones del período, abiertas en tres: dentro de la ventana (crédito devuelto), fuera de
la ventana (crédito perdido) y por clase cancelada por XO (crédito devuelto siempre).

## 6. Lo que el tablero no muestra, y lo dice en pantalla

Un indicador ausente se nota; uno en cero, no. Los tres casos se muestran como una tarjeta con
su explicación, nunca como un cero.

### 6.1 No-shows: no hay registro de asistencia

`reservas.estado` acepta `no_asistio`, pero **ninguna función del sistema lo escribe**: ni
`reservar`, ni `cancelar_reserva`, ni nada en el portal de profesora. La métrica daría cero
permanentemente. La tarjeta dice *"sin registro de asistencia todavía"*, y queda anotado como
deuda en `ARCHITECTURE.md` §10 con un PRD propio propuesto.

### 6.2 Embudo: empieza en "cuenta creada", no en "visita"

Dos razones. Las visitas no se miden en ninguna parte —no hay analítica instalada—, y `leads`
**no tiene `perfil_id`**: no hay columna que ate un lead a la cuenta que esa persona creó
después. `ARCHITECTURE.md` §6 la pide como cambio pendiente desde agosto.

Agregarla es tocar el flujo de captación dentro de un PRD de métricas, y poblarla hacia atrás
sería cruzar por WhatsApp o por nombre, que no es confiable. El embudo parte entonces en
**cuenta → primera compra → primera reserva → segunda compra**, y la tarjeta dice que el tramo
lead → cuenta todavía no se puede medir.

### 6.3 Caja neta: es de la parte 2

Requiere `egresos`, que no existe. La parte 1 muestra **ingresos brutos** y lo rotula así. Un
número rotulado "neto" que en realidad es bruto es peor que no tenerlo: se decide con él.

## 7. Reglas de negocio

### 7.1 Ingreso atribuido a una profesora

El PRD original decía "se atribuye al momento de la reserva, no al de la compra, porque la
compra no elige profesora". La regla concreta:

1. **Cada reserva vale el precio unitario del lote que la pagó:**
   `compras.monto_clp ÷ compras.cantidad_clases` de la compra que originó `reservas.credito_id`.
   Así una clase pagada con un pack de 8 vale $6.000 y la misma clase pagada con una suelta vale
   $8.500, que es exactamente lo que entró.
2. **Un crédito de regalo vale $0.** Un lote sin `compra_id` no trajo plata; atribuirle el
   precio de lista inventaría un ingreso que nunca existió.
3. **Se atribuye toda reserva que consumió un crédito y no lo recuperó**, haya asistido la
   alumna o no. Si canceló fuera de la ventana y perdió el crédito, la plata se ganó igual y la
   clase se dictó igual.
4. **Se atribuye en el período de la reserva**, no en el de la clase. Una reserva hecha hoy para
   la semana que viene cuenta hoy.
5. Una reserva que **recuperó** su crédito —cancelada a tiempo, o clase cancelada por XO— no
   atribuye nada.
6. **El total nunca se muestra como una sola cifra.** Ver §7.1.b.

### 7.1.b Dictado y comprometido no se suman en un solo número

Consecuencia directa de la regla 4: si la atribución ocurre al reservar y el calendario abre 60
días, el "ingreso atribuido" de una profesora puede ser en su mayoría **clases que todavía no
dicta**. Un número así, leído de una pasada, se lee como plata ganada. No lo es.

Se muestran dos cifras, nunca una sola:

| | Qué es |
|---|---|
| **Dictado** | Reservas cuya clase ya ocurrió. Plata ganada y servicio entregado |
| **Comprometido** | Reservas de clases futuras. Todavía puede evaporarse: la alumna cancela a tiempo y recupera el crédito, o XO cancela la clase |

Si en algún lugar hace falta el total, va **rotulado como suma de las dos** y con las dos partes
visibles al lado. El ranking de profesoras ordena por **dictado**: es lo único que ya ocurrió.

⚠️ **Esta definición se va a querer revisar cuando exista registro de asistencia** (§6.1). Hoy
"dictada" es una inferencia —clase pasada y no cancelada—, no un hecho que alguien registró. Con
asistencia real, "dictado" pasa a apoyarse en un hecho, y la parte 3 necesita además distinguir
la clase que **no se dictó** (§8.5). Ese es el momento de revisar esta regla, no antes.

### 7.2 Todo sale del libro y de las reservas

Ninguna métrica se lee de un total guardado a mano. `movimientos_credito` es la fuente de los
créditos, `compras` de la caja y `reservas` de la demanda.

### 7.3 La fecha de un ingreso es `aprobada_at`, no `declarada_at`

Una compra entra a la caja del período en que **se confirmó el pago**, no en el que la alumna
declaró la transferencia. Una compra `pendiente` no es ingreso: es una intención.

### 7.4 El absoluto va siempre junto al porcentaje

Con los denominadores de los primeros meses, "50% de recompra" pueden ser dos personas de
cuatro. Se muestra *"50% · 2 de 4"*. Sin excepción.

### 7.5 Una clase cancelada no cuenta en la ocupación

Una clase que no ocurrió no es un horario muerto; es una clase que no ocurrió. Sale del
denominador del promedio de ocupación y se cuenta aparte.

### 7.6 Solo `owner`, y verificado en la base

`admin` no ve montos. La verificación no puede vivir solo en el layout de la ruta: las
funciones chequean `tiene_nivel('owner')` internamente y levantan `42501` si no. Un admin
llamando `/rest/v1/rpc/` a mano tiene que rebotar igual.

## 8. Modelo de datos

### 8.1 La parte 1 no crea ninguna tabla

Todo lo que necesita ya está: `compras`, `creditos`, `movimientos_credito`, `reservas`,
`clases`, `horarios`, `perfiles`, `planes`. La migración de la parte 1 agrega **funciones**, no
esquema.

### 8.2 Dos funciones, no doce consultas

Cada consulta al portal es una llamada HTTP a Supabase y se cuentan de a una. La página resuelve
con un máximo de **tres** llamadas: la identidad (ya memoizada con `cache()`) más dos funciones
que devuelven JSON.

```sql
-- Todo el resumen del período Y del anterior, en una sola ida y vuelta.
create or replace function public.metricas_resumen(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$ ... $$;

-- Detalle por clase, horario y profesora, para demanda y ranking.
create or replace function public.metricas_demanda(p_desde timestamptz, p_hasta timestamptz)
returns jsonb language plpgsql stable security definer set search_path = public as $$ ... $$;
```

**Las funciones agregan; no dividen.** Suman, cuentan y agrupan, que es lo que Postgres hace
bien. Las tasas, brechas, promedios y variaciones contra el período anterior las calcula
`lib/dominio/metricas.ts` sobre esos crudos. Así lo frágil —divisiones por cero, denominadores
chicos, porcentajes— queda en funciones puras con tests, y no hay lógica duplicada: el SQL nunca
divide y el TypeScript nunca consulta.

### 8.3 Permisos, escritos y no heredados del default

```sql
revoke all on function public.metricas_resumen(timestamptz, timestamptz) from public, anon;
grant execute on function public.metricas_resumen(timestamptz, timestamptz)
  to authenticated, service_role;
```

`revoke ... from public` no es `revoke ... from anon`: `PUBLIC` cubre a todos los roles,
`authenticated` incluido, y las funciones nacen con `EXECUTE` para `PUBLIC`. Esto ya rompió el
login una vez (PRD-0008 §15). El grant va escrito aunque hoy funcione por el default.

El filtro por rol vive **adentro** de la función, no en un grant a un rol que no existe: no hay
un rol de Postgres "owner", el rol está en `perfiles`.

⚠️ Al cerrar, auditar `GET /rest/v1/` y confirmar que estas funciones son lo único nuevo que la
API expone, y que no le abren a `anon` ninguna tabla que hoy esté cerrada. Una función
`security definer` concedida de más anula el RLS de todo lo que lee.

### 8.4 Lo que crean las partes 2 y 3

`egresos` (`fecha, categoria, descripcion, monto_clp, sede_id, comprobante_url`) ·
`liquidaciones_profesoras` (`profesora_id, periodo, clases_dictadas, monto_bruto_clp,
comision_clp, monto_neto_clp, estado`) · los costos por hora de sala y de profesora.
Con RLS de solo `owner` en las dos, que es la primera vez que el proyecto tiene una tabla así.

### 8.5 Parte 3 — la liquidación necesita saber si la clase se dictó

Requisito de Felipe, 07/09/2026: **el día 1 de cada mes hay que ver cuánto se le debe a cada
profesora por el mes anterior**, y hay que poder registrar que una profesora **no dictó** una
clase, con el motivo, para que se descuente.

Hoy el sistema no lo sabe. `clases.estado` es `programada | cancelada`, así que una clase pasada
que sigue en `programada` es ambigua: puede que se haya dictado, o puede que nadie la haya
tocado nunca. Liquidar sobre esa ambigüedad es pagarle a alguien por una clase que quizá no dio.

#### 8.5.a Son dos hechos distintos, y la liquidación necesita solo uno

| Hecho | De qué es atributo | Para qué sirve |
|---|---|---|
| **¿Ocurrió la clase?** | De la **clase** | Liquidación de la profesora |
| **¿Vino la alumna?** | De la **reserva** | No-shows, y nada más |

**El registro de asistencia que se dejó fuera en §6.1 NO es prerrequisito de la liquidación.**
A la profesora se le paga por dictar, no por cuántas alumnas llegaron: una clase con dos
alumnas se dictó igual y se paga igual. Las dos cosas se pueden construir en cualquier orden, o
solo una.

#### 8.5.b Lo que sí hace falta: estado nuevo y causa estructurada

Ambas cosas, y no son la misma:

- **El estado** responde *¿ocurrió?* → `clases.estado` gana `dictada` y `no_dictada`.
- **La causa** responde *¿por qué no?* → columna nueva, con valores acotados.

`no_dictada` no es lo mismo que `cancelada`. Cancelada es que se avisó antes: el cupo se liberó
y el trigger le devolvió el crédito a cada alumna. `no_dictada` es que llegó la hora y no hubo
clase. Para la alumna el efecto debe ser el mismo —no recibió el servicio, se le devuelve el
crédito— pero **el trigger de hoy solo reacciona a `cancelada`**, así que hay que extenderlo.
Para la profesora son casos distintos, y de ahí sale el descuento.

```sql
alter table public.clases
  add column causa text check (causa in ('profesora_enferma', 'profesora_no_llego',
                                         'sala_no_disponible', 'sin_alumnas',
                                         'fuerza_mayor', 'decision_xo')),
  add column causa_motivo text,          -- el detalle en palabras
  add column registrada_por uuid references public.perfiles (id),
  add column registrada_at timestamptz;
```

La causa acotada es lo que separa **que se enferme de que no llegue**, que era el requisito
explícito, y es lo que la liquidación puede leer para decidir. El texto libre acompaña, no
reemplaza: una columna de texto no se puede sumar.

`registrada_por` y `registrada_at` no son adorno. Esto mueve plata, igual que regalar créditos,
y ahí el proyecto ya decidió que el autor queda registrado (`movimientos_credito.creado_por`,
`cambios_rol.cambiado_por`). Mismo criterio.

#### 8.5.c Quién marca, y qué pasa con lo que nadie marca

Propuesta: **el default es "dictada"** —clase pasada, no cancelada, se dictó— y lo que se
registra explícitamente es **la excepción**. Nadie tiene que confirmar 30 clases al mes para que
la liquidación salga; solo las que fallaron.

Quién registra la excepción: **admin u owner, no la profesora.** No por desconfianza, sino
porque la profesora es parte interesada en el resultado. Puede reportarla, que es otra cosa.

#### 8.5.d Lo que no se puede resolver programando

Tres decisiones que son de Felipe y que bloquean el cálculo, no el esquema:

1. **Si la profesora avisa que está enferma, ¿se le paga la clase?** Sin esa regla, `causa` no
   sabe cuánto descontar. Es la pregunta de verdad detrás del requisito.
2. **Si la clase no se dictó por causa de XO** —sala no disponible, se canceló por decisión de
   la academia—, ¿se le paga igual a la profesora que tenía el horario tomado?
3. **El variable de las profesoras**, que `CONTEXT.md` §5.b declara sin definir desde agosto.

#### 8.5.e El cierre mensual congela

"El día 1 veo lo del mes anterior" implica que el mes **se cierra**. Propuesta: al cerrarlo, la
fila de `liquidaciones_profesoras` guarda los montos calculados y **no se recalcula nunca más**.
Si el día 3 aparece una clase mal marcada, se corrige con un **ajuste en el mes siguiente**, no
editando lo ya pagado. Es el mismo principio que gobierna `movimientos_credito`: un libro que se
agrega y no se edita. Una liquidación que cambia sola después de pagada no se puede conciliar
contra la transferencia que se hizo.

---

## 9. Un cero que no miente

El requisito que da origen a esta sección: **un tablero en cero se ve igual si funciona que si
está roto.** Cuatro defensas, en capas.

1. **`Lectura<T>` en toda consulta**, con `<ErrorDeLectura>` en la tarjeta. El patrón de
   PRD-0017 §17: un fallo de lectura nunca se puede ver como ausencia de datos.
2. **Todo cero viene con su denominador y con la fecha del último dato.** No "0", sino
   *"0 compras en septiembre · última compra registrada: nunca"*. Un cero con procedencia es un
   dato; un cero pelado es una incógnita.
3. **La franja de conciliación de §5.1.b**, cuyo valor correcto se conoce sin mirar los datos.
4. **El escenario sembrado de §11**, que es la única forma de saber que los números salen bien
   cuando hay números.

## 10. Casos borde

- **Denominador cero.** Ticket promedio sin compras, utilización sin créditos otorgados,
  ocupación sin clases dictadas. No se muestra "0%" ni "NaN": se muestra "sin datos".
- **Empate en el plan más vendido.** Se muestran todos los empatados, no el primero que salga.
- **Alumna que compra y nunca reserva.** Cuenta en ingresos y **no** en alumnas activas. Es
  exactamente la brecha que el tablero existe para hacer visible.
- **Compra pendiente.** No es ingreso (§7.3). Se muestra aparte, como plata declarada y sin
  confirmar.
- **Lote vencido con saldo.** Existe: cancelar devuelve el crédito al lote original aunque ya
  haya vencido, y queda dicho en el motivo del asiento. Cuenta como vencido sin usar, no como
  pasivo.
- **Período anterior sin datos.** La comparación dice "sin período anterior", no "+100%".

## 11. Cómo se verifica un tablero que hoy da cero

Tres capas. La tercera es la que la lección del magic link obliga a no saltarse: **probar el
artefacto que toca la persona, no la función que ese artefacto termina llamando.**

### 11.1 Capa 1 — las funciones puras

`node --test` sobre `lib/dominio/metricas.ts`. Node 24 ejecuta TypeScript sin transpilar, así
que **no se agrega ninguna dependencia**. Cubre lo que se rompe callado: divisiones por cero,
variaciones contra un período vacío, redondeo de pesos, porcentajes con denominadores de dos.

### 11.2 Capa 2 — el SQL contra Postgres de verdad

Las funciones puras no prueban que el `sum()` sume las filas correctas. Se siembra un escenario
en un **proyecto Supabase de staging** y se contrasta cada agregado contra el valor calculado a
mano en §11.4, escrito **antes** de correr nada.

No se usa Docker: no está instalado en la máquina de trabajo, así que `supabase start` no es una
opción. No se siembra en producción: `movimientos_credito` tiene `revoke delete ... from
service_role`, o sea que **sembrar en el libro es irreversible incluso con la service role key**.

⚠️ **La siembra inserta las filas directamente, no llama a `acreditar_compra`.** Esa función
calcula el vencimiento como `now() + vigencia_dias`, así que todas las compras del escenario
—incluidas las de hace dos meses— quedarían venciendo dentro de 60 días y el escenario perdería
justamente el lote vencido. La consecuencia hay que tenerla clara: **la siembra prueba las
métricas, no prueba `acreditar_compra`.** Las operaciones del período actual que sí pueden
correr en tiempo real —`reservar` y `cancelar_reserva`— se llaman de verdad.

### 11.3 Capa 3 — abrir la página

Con el escenario sembrado: entrar a `/owner/metricas` con sesión **owner** real y contrastar
cada número contra §11.4. Después entrar con sesión **admin** y pedir la misma URL directa, y
además llamar `/rest/v1/rpc/metricas_resumen` con el token de ese admin, que es el camino que un
layout no cubre.

### 11.4 El escenario, con sus valores esperados

Cinco alumnas de prueba, con correos `@ejemplo.invalid`. **Ningún dato real de ninguna alumna**,
que es regla del proyecto y acá además sería ilegal. Las fechas son relativas a `now()`, y las
funciones reciben el período explícito, así que el escenario corre cualquier día:
período actual `[now − 30d, now]`, anterior `[now − 60d, now − 30d)`.

**Compras y lotes**

| # | Alumna | Plan | Monto | Estado | Aprobada | Créditos | Vence |
|---|---|---|---|---|---|---|---|
| C0 | Ana | pack-2 | $16.000 | pagada | now − 75d | 2 | now − 15d ⚠️ vencido |
| C1 | Ana | pack-4 | $28.000 | pagada | now − 45d | 4 | now + 15d |
| C2 | Bea | pack-2 | $16.000 | pagada | now − 35d | 2 | now + 25d |
| C3 | Ana | pack-8 | $48.000 | pagada | now − 20d | 8 | now + 40d |
| C4 | Bea | pack-4 | $28.000 | pagada | now − 12d | 4 | now + 48d |
| C5 | Cata | suelta | $8.500 | pagada | now − 5d | 1 | now + 55d |
| C6 | Emi | pack-4 | $28.000 | pagada | now − 3d | 4 | now + 57d |
| C7 | Dani | pack-4 | $28.000 | **pendiente** | — | 0 | — |
| R1 | Cata | regalo | $0 | — | now − 4d | 2 | now + 56d |

C0 queda fuera de los dos períodos a propósito: prueba que el corte del período anterior corta.

**Clases y reservas** — cinco clases: CL1 (now − 18d), CL2 (now − 11d), CL3 (now − 4d), CL4
(now + 3d, futura) y CL5 (now − 7d, **cancelada por XO**).

- **Ana** reserva CL1, CL2, CL3, CL4 y CL5. Consume C1 completo (vence primero) y una de C3.
  La de CL5 se devuelve sola, por el trigger de clase cancelada.
- **Bea** reserva CL1, y CL3 que **cancela a tiempo** — crédito devuelto.
- **Cata** reserva CL3 con su clase suelta, y CL2 con un crédito de **regalo** que
  **cancela tarde** — crédito perdido. Este caso prueba la regla 7.1.2: atribuye $0.
- **Emi** compra y nunca reserva. **Dani** declara y no se le aprueba.

**Valores esperados**

| Indicador | Esperado | Por qué |
|---|---|---|
| Ingresos del período | **$112.500** | C3 + C4 + C5 + C6. C7 no, está pendiente |
| Compras pagadas | **4** | |
| Ticket promedio | **$28.125** | 112.500 ÷ 4 |
| Plan más vendido | **pack-4, 2 de 4** | C4 y C6 |
| Ingresos período anterior | **$44.000** | C1 + C2 |
| Variación | **+$68.500 · +155,7%** | |
| Clases vendidas (período) | **17** | 8 + 4 + 1 + 4 |
| Clases regaladas (período) | **2** | R1, aparte de las vendidas |
| Clases consumidas (neto) | **7** | 9 reservas − 2 devoluciones |
| Vencidas sin usar | **2** | El lote C0 de Ana |
| Brecha / pasivo vigente | **18** | 20 disponibles − 2 vencidos |
| Por vencer en 30 días | **1** | C2 de Bea, vence en 25 días |
| Utilización acumulada | **25,9% · 7 de 27** | 27 otorgados históricos |
| **Conciliación** | **20 == 20** | Libro: 27 − 9 + 2. Lotes: 2+0+8+1+4+0+1+4 |
| Ocupación promedio dictadas | **7,6% · 5 de 66** | CL1 2, CL2 1, CL3 2, sobre 22 c/u |
| Ingreso atribuido — **dictado** | **$37.500** | CL1 $15.000 + CL2 $7.000 + CL3 $15.500 |
| Ingreso atribuido — **comprometido** | **$7.000** | Solo CL4, que todavía no ocurre |
| Cancelaciones | **3** | 2 con devolución, 1 sin |
| Alumnas activas | **4 de 5** | Dani no: sin créditos y sin reservas |
| Tasa de recompra | **50% · 2 de 4** | Ana y Bea. Dani queda fuera del denominador |
| En riesgo | **1** | Emi: crédito vigente, nunca reservó |
| Embudo | **5 → 4 → 3 → 2** | cuentas, primera compra, primera reserva, segunda compra |

Cada fila de esa tabla es un criterio de aceptación. Si una no calza, el defecto está en el
tablero, no en el escenario: los números se calcularon a mano antes de escribir una línea de SQL.

## 12. Criterios de aceptación

- [ ] El tablero muestra clases vendidas, consumidas, vencidas sin usar y la brecha entre ellas.
- [ ] La franja de conciliación cuadra con el escenario sembrado, y se pinta roja si no.
- [ ] Cada indicador trae comparación con el período anterior, o dice que no hay período anterior.
- [ ] Todo porcentaje va acompañado de su absoluto.
- [ ] Los 22 valores esperados de §11.4 coinciden con lo que muestra la página.
- [ ] Un usuario `admin` no accede por URL directa **ni** llamando la función por `/rest/v1/rpc`.
- [ ] Las tres tarjetas recortadas (§6) explican por qué no hay dato, en vez de mostrar cero.
- [ ] Un fallo de lectura se ve distinto de un cero legítimo.
- [ ] La página resuelve en tres llamadas a Supabase o menos, contadas con instrumentación.
- [ ] `npm run build` pasa.

## 13. Métrica de éxito

Que la decisión de abrir, mover o cerrar un horario se tome mirando el tablero y no por
intuición.

## 14. Riesgos y supuestos

| | |
|---|---|
| **El escenario sembrado puede estar mal calculado** | Es el riesgo central: si los valores esperados están mal, el tablero "pasa" estando roto. Mitigación: se calculan a mano y se escriben en el PRD **antes** de programar, que es lo que hace esta sección revisable por alguien que no escribió el código |
| **Staging no es producción** | Mismo Postgres y mismas migraciones, pero sin el volumen ni los datos sucios de la importación de alumnas. Cuando entren las primeras compras reales, repetir la capa 3 contra producción |
| **Nada emite `expiracion`** | El libro no registra el vencimiento de un crédito. La conciliación cuadra igual porque ni el libro ni los lotes lo descuentan, pero el día que exista ese proceso tiene que escribir el asiento **y** bajar `cantidad_disponible`, o la conciliación se rompe. Queda anotado como deuda |
| **La utilización acumulada se vuelve menos útil con el tiempo** | A dos años, un mal trimestre no se va a notar. Cuando haya historia suficiente, pasar a utilización por cohorte de compra |
| **`admin` no ve montos, pero sí ve compras** | El portal de administración ya muestra `monto_clp` en la bandeja de transferencias, porque para aprobar una transferencia hay que ver el monto. La regla de §7.6 es sobre las métricas agregadas del negocio, no sobre el monto de una compra que un admin tiene que aprobar. Vale la pena que quede dicho, porque leído literal el PRD original se contradice con PRD-0017 |

## 15. Pendientes que este PRD no resuelve

1. **Subir a `next@16.3.4`.** `npm audit` reporta 4 vulnerabilidades altas: `postcss` 8.4.31 y
   `nanoid` 3.3.16 (las dos solo en el pipeline de CSS de `next build`) y `sharp` 0.34.5, que
   está cerrada porque `next.config.ts` no declara `remotePatterns` y `next/image` solo optimiza
   archivos de `public/`. **Ninguna es alcanzable en producción.** El fix es un minor de Next,
   que arrastra las tres parchadas, y va **como cambio aparte** con su propia verificación de
   que el build sigue leyendo el catálogo desde Supabase.
2. **Toma de asistencia**, para que no-shows y margen por clase dictada existan (§6.1).
3. **`leads.perfil_id`**, para cerrar el tramo lead → cuenta del embudo (§6.2).
4. **Confirmar el mapeo de sedes y los costos** antes de la parte 2: se asume Los Leones =
   Seducción Latina Experience (Providencia, $17.000/hora) y Los Dominicos = Centro Comunitario
   Diaguitas (Las Condes, $0), con $18.000/hora de profesora, según `CONTEXT.md` §5.b. El
   variable de las profesoras sigue sin definir.
5. **Proceso de expiración de créditos**, que hoy no existe.

## 16. Notas de implementación

Se llena al terminar.
