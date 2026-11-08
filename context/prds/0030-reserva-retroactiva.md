# PRD-0030 — La reserva retroactiva: "fue a clase y no reservó"

| Campo | Valor |
|---|---|
| **Estado** | **Parte 1 implementada en la rama `prd-0030-reserva-retroactiva`, sin publicar.** Migración escrita, **sin aplicar** en ningún lado. **Parte 2 (la deuda): borrador**, espera a Felipe (§3.2) |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 8 de noviembre de 2026 |
| **Hito** | Hito 3 — Reservas |
| **PRDs relacionados** | PRD-0024 §8.6.a (de donde sale) · PRD-0010 parte 3 (la liquidación que paga la reserva) · PRD-0029 (el marcado de asistencia, en borrador: esto **no** lo reemplaza) |

> Numerado 0030 porque Felipe pidió no empezar el 0028 ni el 0029 (07/11/2026).

---

## 1. Problema

A la clase de Pau del jueves 5/11 y a la de Isi del viernes 6/11 llegaron niñas sin reserva. No
entendieron cómo reservar, no alcanzaron, o Felipe no revisó a tiempo si tenían créditos sin
adjudicar. Felipe anotó quiénes fueron.

Hoy la única herramienta es **quitar el crédito** (PRD-0024). Con eso la cuenta queda cuadrada,
pero la clase queda mal registrada:

- **la profesora no cobra los $250 de esa alumna**, porque la liquidación cuenta reservas, no créditos;
- **la profesora puede perder el incentivo del promedio**, que también sale de las reservas.

Lo que falta no es "editar la lista de asistentes". Falta **la reserva**: es lo que consume el
crédito y lo que paga.

**Tiene que estar antes de que cierre noviembre.** Si se cierra el mes y después se agrega una
asistencia, hay que anular el cierre y volver a cerrar.

## 2. Usuario y contexto de uso

**Solo el owner.** Lo usa desde el computador o el teléfono, con la lista que anotó en la mano,
después de la clase. Registra una a una, con un minuto por alumna.

## 3. Alcance

**Se parte en dos** (Felipe, 08/11/2026: "si esto te crece más de lo que esperas, pártelo").
Crece porque una reserva sin crédito toca cinco piezas que hoy funcionan:

- la columna `reservas.credito_id`;
- la liquidación, que solo cuenta reservas con crédito;
- `acreditar_compra()`, que ya está en producción;
- la pantalla de comprar;
- el portal de la alumna.

### 3.1 Parte 1 — la reserva retroactiva, con aviso (construida)

1. **Función `reservar_retroactiva()`** en la base. Es solo para el owner, que se verifica adentro. Hace todo en una transacción: el lote, la reserva y el movimiento en el libro, con autor y motivo.
2. **El crédito se evalúa con la fecha de la clase** (§8.1).
3. **Si ese día no tenía crédito, no se inventa uno.** La función devuelve la pregunta y el owner decide (§8.2):
   - usar una de las clases que la alumna tiene **hoy**, o
   - no registrar.
4. **El cupo no se valida** (§8.3).
5. **Un mes con la liquidación cerrada se rechaza**, con el mensaje "anula el cierre y vuelve a cerrar".
6. **Pantalla `/owner/asistencias`**, con tres partes:
   - el número de asistencias registradas después en el mes;
   - el paso 1 elige la clase y el paso 2 busca a la alumna por nombre o correo y registra;
   - la lista del mes, con motivo, autor y cuándo se registró.
7. **`reservas_retroactivas()`**, la lista para el owner. Solo owner, verificado adentro.

### 3.2 Parte 2 — la deuda de una clase (borrador, no construida)

Lo que pidió Felipe. Queda para cuando él lo apruebe:

1. **Un registro propio de deuda, en una tabla nueva.** No es un lote en −1 ni un saldo negativo. El sistema cuadra el libro contra la suma de los lotes (157 = 157 el 08/11), y un lote negativo rompe esa igualdad y todas las verificaciones que se apoyan en ella.
2. **La deuda se descuenta sola en la próxima compra.** Si compra un pack de 4 debiendo una, le quedan 3. Eso cambia `acreditar_compra()`, que está en producción.
3. **La deuda no le impide comprar.** Es el peor lugar para poner un obstáculo.
4. **Ella la ve antes y después**, con el motivo: en su portal y en el momento de comprar. Si compra 4 y le quedan 3 sin explicación, se siente robo.
5. **El owner ve la lista de quién debe.**
6. **La reserva de una alumna que debe tiene que pagarle a la profesora igual.** Hoy la liquidación cuenta solo reservas con `credito_id`. La reserva con deuda necesita su propia columna (`deuda_id`), porque `reservas_credito_o_compra` exige crédito o compra. Además hay que cambiar los insumos de la liquidación, que todavía no está en producción.

Mientras no exista la parte 2, el caso "no tenía crédito ese día ni tiene hoy" **no se registra**.
El owner lo resuelve a mano: regala una clase con motivo y registra con "usar una de hoy".

## 4. Fuera de alcance

- **El marcado de asistencia completo.** Es PRD-0029 y sigue en borrador. Esto es solo la corrección retroactiva.
- Corregir una reserva marcada `no_asistio`: se rechaza, porque esa reserva ya consumió su crédito.
- Clases especiales: se pagan aparte, con su compra, y no con clases del pack.
- Avisarle por correo a la alumna. No se pidió.
- Que admin pueda hacerlo. Es solo owner, como revocar.

## 5. Flujo principal (parte 1)

1. El owner entra a **Asistencias pasadas**. Arriba ve cuántas lleva registradas este mes.
2. Elige la clase de una lista de las dictadas en los últimos 45 días, con fecha, curso, profesora y sala. Ve quiénes ya están registradas.
3. Busca a la alumna por nombre o correo. Las que ya tienen reserva en esa clase no aparecen.
4. Aprieta **"Fue a esta clase"**, escribe el motivo y aprieta **Registrar**.
5. Si tenía crédito ese día, queda registrada. Si ese crédito hoy ya venció, se lo dice.
6. Si ese día no tenía crédito, el diálogo lo dice: **"No tenía crédito vigente el día de la clase. Hoy tiene N clases"**. Ofrece **Usar una de hoy** o **No registrar**.
7. La reserva aparece en la lista del mes. La profesora la ve como inscrita, y la liquidación la paga.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| El lote estaba vigente el día de la clase y hoy está vencido | **Se usa ese lote.** Su vencimiento no se toca (§8.1) |
| Varios lotes vigentes ese día | El que vencía primero entre esos |
| El lote se creó después de la clase (compró después) | No cuenta para ese día. Se pregunta (§8.2) |
| Sin crédito ese día, con crédito hoy | Pregunta: usar una de hoy o no registrar |
| Sin crédito ese día ni hoy | No escribe nada. Lo resuelve la parte 2 |
| Sala llena | **Se registra igual** (§8.3) |
| Ya tiene una reserva `confirmada`, `asistio` o `no_asistio` en esa clase | Rechaza: una segunda le cobraría dos veces la misma clase |
| Tenía una reserva cancelada con el crédito devuelto | Se puede registrar: esa ya no consumió nada |
| Clase futura, cancelada o especial | Rechaza, con un mensaje para cada caso |
| Liquidación de esa profesora y ese mes cerrada (no anulada) | Rechaza: "Anula el cierre, registra la asistencia y vuelve a cerrar" |
| La liquidación todavía no está en la base | No hay cierre que proteger. La función lo pregunta con `to_regclass` y no depende de esa migración |
| Admin, profesora o alumna | `42501`. Ni la sesión del owner la ejecuta directo: la llama el servidor, que verifica antes |
| Motivo de menos de 5 caracteres | Rechaza |

## 7. Modelo de datos

Migración `20261108120000_reserva_retroactiva.sql`, **sin aplicar**:

- `reservas.creada_por` y `reservas.motivo`, nuevas columnas.
- `reservas.origen` admite `retroactiva`. Una reserva con ese origen exige autor y un motivo de al menos 5 caracteres.
- Índice parcial de las retroactivas.
- `reservar_retroactiva(actor, perfil, clase, motivo, usar_credito_de_hoy)`, con grant solo a `service_role`.
- `reservas_retroactivas(desde, hasta)`, con grant a `authenticated`. Verifica owner adentro.

La reserva queda `asistio`, con `origen = 'retroactiva'` y `created_at` de hoy, que es cuándo se
registró. Su movimiento `reserva` −1 queda con `created_at` = inicio de la clase, que es cuándo
se consumió.

## 8. Reglas de negocio

### 8.1 🔴 El crédito se evalúa con la fecha de la CLASE, no con la de hoy

> **Esta es la parte que alguien va a querer "arreglar". No se arregla.**

La pregunta no es "¿tiene crédito hoy?". Es **"¿tenía crédito el día que bailó?"** (Felipe,
08/11/2026). Si la clase fue el 5, su lote vencía el 8 y se registra el 12, ella sí tenía crédito
cuando bailó.

- Se miran los lotes **vigentes a la fecha de la clase**: ya existían al empezar la clase y todavía no vencían. Entre esos, se descuenta **el que vencía primero**, el mismo orden de siempre.
- El movimiento del libro va **fechado al inicio de la clase**.
- **La fecha de vencimiento del lote NO se toca.** No se revive nada y no se lleva ninguna lista paralela de vencidos.
- **Un lote que venció con una clase sin usar, consumida por una clase anterior a su vencimiento, nunca estuvo realmente sin usar.** La alumna la usó a tiempo; lo que llegó tarde fue el registro.

**Qué pasa con el tablero cuando se usa un lote que hoy está vencido** (probado en la base local):

| Cifra | Cambia | Por qué |
|---|---|---|
| `vencidas_sin_usar` (y `vencidas_vendidas` o `vencidas_regaladas`) | **Baja en 1** | Ese crédito no venció sin usar: se usó. **Está bien que cambie** |
| `consumidas` del mes de la clase | **Sube en 1**, en el mes de la clase y no en el de hoy | El movimiento va fechado ese día. Si la clase fue en un mes anterior, **la cifra de ese mes cambia hacia atrás** |
| Vigentes y por vencer | No cambian | El lote ya no era vigente |
| Conciliación libro = lotes | **Sigue cuadrando** | El lote baja 1 y el libro agrega −1 en la misma transacción |

Si el lote todavía está vigente, `vencidas` no cambia, y `consumidas` sube en el mes de la clase.

**`saldo_resultante`** del movimiento retroactivo es el saldo de hoy, no el que tenía ese día.
Calcular el de ese día obligaría a reescribir los saldos de los movimientos posteriores, y el
libro no se edita.

### 8.2 Sin crédito ese día: la decisión es del owner (parte 1)

La base no regala sola ni bloquea. Devuelve la pregunta con cuántas clases tiene hoy, y el owner
elige. Esto cubre el caso de "créditos sin adjudicar": una transferencia declarada antes de la
clase y aprobada después da un lote creado después de la clase. Ese lote no contaba ese día,
pero el owner sabe que estaba pagado y puede usar ese.

> **Decisión abierta para Felipe:** ¿una compra **declarada** antes de la clase y aprobada después
> debería contar como vigente ese día, sin preguntar? Hoy pregunta. Es más seguro, y en la
> práctica es un clic más.

### 8.3 🔴 El cupo no bloquea en una clase pasada

**A propósito** (Felipe, 08/11/2026). Si fueron 17 en una sala de 16, fueron 17. Bloquear no
protege ningún cupo, porque ya no hay nada que reservar, y deja la clase mal registrada.
**Que nadie lo "arregle" agregando la validación de `reservar()`.**

### 8.4 Solo owner, con su registro

Todo va en una transacción, con el movimiento en el libro, con quién la creó y por qué. **El
libro no se edita, se agrega.**

### 8.5 La cuenta del mes, a la vista

El número de retroactivas del mes está arriba en la pantalla. Si un mes aparecen veinte, el
problema no es esta herramienta: **es que nadie está marcando asistencia.** Al 08/11, ninguna de
las 6 clases dictadas en noviembre tiene una sola reserva marcada `asistio`.

## 9. Criterios de aceptación (parte 1)

- [x] Un lote vigente el día de la clase y vencido hoy se usa, y su vencimiento no cambia. *Base local.*
- [x] El movimiento va fechado al inicio de la clase, con autor y motivo. La reserva queda `asistio` y `retroactiva`. *Base local.*
- [x] Entre dos lotes vigentes ese día se usa el que vencía primero. *Base local.*
- [x] Sin crédito ese día devuelve la pregunta sin escribir nada. Con "usar una de hoy", usa el lote de hoy. *Base local.*
- [x] Sala llena: se registra igual. *Base local.*
- [x] Se rechazan: duplicado, clase futura, clase cancelada, motivo corto y admin. Una alumna y el owner con sesión no pueden ejecutarla. *Base local.*
- [x] Mes con liquidación cerrada: rechaza. Con el cierre anulado: deja. *Base local, con una tabla mínima.*
- [x] El tablero: `vencidas_sin_usar` −1, `consumidas` +1, libro = lotes. *Base local.*
- [x] La reserva cumple lo que cuenta la liquidación: tiene crédito, no está devuelta y no es pendiente. *Base local.*
- [ ] **Desde la página en staging**, con sesión de owner: registrar, ver la pregunta de "sin crédito" y ver la cuenta del mes. Una admin que entra por URL no ve la página. *Necesita la migración en staging, con aprobación.*
- [ ] Con la liquidación en staging: la profesora cobra la clase registrada después.

## 10. Métrica de éxito

Las asistencias de noviembre quedan registradas antes del cierre. Y la cuenta mensual de
retroactivas **baja** cuando exista el marcado de asistencia (PRD-0029). Si no baja, el marcado
no se está usando.

## 11. Riesgos y supuestos

- **Cambia cifras de meses anteriores** (§8.1). Es correcto, pero un tablero mirado el 2/12 y otra vez el 10/12 puede dar distinto `consumidas` de noviembre.
- **El tamaño del problema en noviembre, al 08/11:**
  - 6 clases dictadas (las 2 del 2 y 3/11 se cancelaron), 5 con cupo libre, 72 lugares sin ocupar en total;
  - 47 alumnas con 131 créditos vivos, de las que 14 no tienen ninguna reserva en pie y 12 nunca reservaron;
  - **ninguna reserva marcada `asistio`** en ninguna clase.

  No sirve para adivinar quién fue, pero dice que el universo es chico: 6 clases.

## 12. Notas de implementación

| Fase | Qué | Estado |
|---|---|---|
| 1 | Migración `20261108120000_reserva_retroactiva.sql` | ✅ Escrita · **sin aplicar** |
| 2 | Escenario `scripts/base-local/escenario-retroactiva.mjs` | ✅ **26 de 26**. Revocar (25/25) y pack de amigas (30/30) siguen pasando con la migración |
| 3 | Acción `registrarAsistenciaPasada`, componente `RegistrarAsistencia`, página `/owner/asistencias`, enlace en el menú del owner | ✅ `tsc`, lint y build |
| 4 | Prueba desde la página en staging | ⏳ Necesita la migración en staging, con aprobación por nombre |
| 5 | Parte 2, la deuda | ⏸ Borrador, espera a Felipe |
