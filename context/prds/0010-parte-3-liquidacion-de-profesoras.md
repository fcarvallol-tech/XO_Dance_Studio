# PRD-0010 parte 3 — Liquidación de profesoras

| Campo | Valor |
|---|---|
| **Estado** | **En desarrollo** (05/11/2026). Las siete preguntas de §13 están contestadas (Felipe, 04/11/2026, en `CONTEXT.md` §5.b). Pasos A–D en la rama `prd-0010-parte-3-liquidacion`: §13 cerrado, ADR-0008, funciones puras con tests y migración escrita **sin aplicar**. El portal (paso E) no está empezado. Ver §12.3 |
| **Autor** | Claude, a pedido de Felipe |
| **Fecha** | 20 de octubre de 2026 |
| **Hito** | Hito 5 |
| **Plazo** | ~~1 de noviembre, por octubre~~. **La liquidación arranca el 1 de noviembre de 2026** (Felipe, 04/11): octubre se pagó a mano, está cerrado fuera del sistema y **no se carga**. El primer mes liquidable es noviembre, que se paga a comienzos de diciembre |
| **PRDs relacionados** | PRD-0010 §3.10–12, §7.1, §8.5 y §17 · PRD-0008 (portal de profesora) · PRD-0018 (especiales) · PRD-0021 · PRD-0023 (regalos) |

> **De dónde sale.** PRD-0010 §3 enunció la parte 3 en tres líneas y §8.5 dejó escritas las reglas
> de pago del 07–08/09/2026. Este documento la desarrolla. Donde §8.5 sigue valiendo se cita y no
> se repite; donde los datos reales la contradicen, se dice y se pregunta (§13).
>
> ✅ **Actualizado el 05/11/2026 con las respuestas de Felipe del 04/11.** La fuente es
> `CONTEXT.md` §5.b: "Incentivo por promedio — regla del 04/11/2026, en dos tramos" y "Las cinco
> decisiones que destraban la liquidación". **Esas secciones viven hoy en la rama
> `pedidos-de-uso` y no en `main`.** Donde este PRD y esas secciones digan cosas distintas, mandan
> ellas. Los cambios de fondo respecto del borrador del 20/10:
>
> - **Se arranca en noviembre, no en octubre.** Nada intenta importar octubre.
> - **El variable tiene umbral**: `máx(0, créditos − 5) × $250`, por clase (Felipe, 21/10). §6.1
>   decía $250 por cada crédito.
> - **Las causas son cinco**: `sala_no_disponible`, `cambio_de_parrilla`, `ausencia_profesora`,
>   `sin_alumnas` y `asistencia_insuficiente`. §7.2 proponía tres.
> - **Una clase recuperada se paga una sola vez, en la recuperación** (Felipe, 03/11).
> - **Hay un incentivo por promedio**, en dos tramos que se suman (§6.5), que el borrador no tenía.
> - **La profesora ve su liquidación**: ADR-0008, que reemplaza la regla 4 de PRD-0008.

---

## 1. Problema

El 1 de cada mes Carla o Felipe le transfieren a cada profesora lo del mes anterior. Hoy ese número
no existe en ninguna parte: `/owner/finanzas` calcula el **costo** de cada clase para el margen,
pero no hay una vista "cuánto le debo a Pau por octubre", no hay forma de decir que una clase no
se dictó y por qué, y no queda registro de lo que se pagó.

Tres cosas lo hacen urgente y no solo cómodo:

1. **Una clase pasada que nadie tocó se cuenta como dictada.** `clases.estado` solo admite
   `programada | cancelada`, y el motivo es texto libre. Si una profesora no llegó, la única forma
   de reflejarlo es cancelar la clase y escribir algo en `motivo_cancelacion`. Ese texto **no lo
   puede leer el cálculo**, así que no puede decidir si se paga.
2. **La regla literal de §8.5.a, aplicada a lo que ya está en la base, paga de más.** El 05/10 la
   migración `20261005120000_catalogo_octubre.sql` canceló las clases futuras de Teens que tenían
   reservas. Son cancelaciones de XO, y §8.5.a dice que una clase que no se dictó por causa de XO
   paga la base. Leído literal, **a Carli se le pagarían $18.000 por cada clase de un curso que ya
   no existe**. La causa tiene que distinguir eso (§7.2).
3. **Lo que se paga tiene que quedar fijo.** Si la liquidación se recalcula cada vez que alguien
   corrige una clase, el monto de octubre deja de calzar con la transferencia que se hizo el 1 de
   noviembre, y nadie puede conciliar.

## 2. Usuario y contexto de uso

- **Owner (Carla o Felipe)**, desde el computador, el día 1 de cada mes y con el banco abierto al
  lado. Mira cuánto le debe a cada una, transfiere, sube el comprobante y lo marca como pagado.
  Cinco veces, en diez minutos. También entra durante el mes cuando una clase se cae, para dejarlo
  registrado.
- **Admin**, para registrar que una clase no se dictó, sin ver montos (PRD-0010 §7.6).
- **La profesora**, desde el teléfono, para saber cuánto va a recibir y revisar que esté bien antes
  del día de pago (§9, sujeto a la pregunta 5).

## 3. Alcance

1. **El cálculo** de lo que se le debe a cada profesora en un mes, derivado de lo que ya está en
   la base (§6). Una función pura en `lib/dominio/liquidacion.ts` con tests, alimentada por una
   función SQL que agrega y no divide, como las de las partes 1 y 2.
2. **El estado `no_dictada`** y una **causa con valores cerrados** en `clases`, obligatoria en
   toda clase de parrilla que no se dictó o se canceló (§7).
3. **Registrar una clase no dictada y un reemplazo** sobre clases ya pasadas, desde el detalle de
   la liquidación, con autor y fecha (§7.4, §7.5).
4. **El botón "Pagado"**, que congela el monto con su detalle clase por clase, exige el comprobante
   en el mismo paso y registra el egreso en `/owner/finanzas` (§8).
5. **La anulación de un pago** marcado por error, con motivo, sin borrar nada (§8.5).
6. **El aviso de diferencia** cuando un mes ya pagado cambia después, y el **ajuste** con motivo que
   lo corrige en el mes siguiente (§8.6).
7. **Lo que ve la profesora** en su portal: su liquidación y nada más (§9).
8. **Isi entra a `costos_profesoras`**, que hoy no la tiene (§6.4).

## 4. Fuera de alcance

### 4.1 El pago de las clases especiales

La regla está escrita (`CONTEXT.md` §5.b, Felipe 30/09/2026): **50% de lo recaudado después de
descontar la sala, sin base y sin variable.** Queda fuera por dos razones:

- **Es una tercera regla, no un caso de esta.** Sus entradas son otras —lo recaudado por
  transferencia de clase suelta (`reservas.compra_id`), no créditos consumidos— y sus ambigüedades
  también: si la sala se descuenta completa cuando la especial comparte bloque, qué pasa si lo
  recaudado no cubre la sala, si el 50% se calcula sobre lo aprobado o sobre lo declarado.
  Resolverlas en doce días junto con lo de parrilla pone en riesgo el 1 de noviembre.
- **¿Hubo especiales en octubre?** Si las hubo, se pagan a mano ese mes, como se hizo con
  septiembre, y la liquidación lo dice en pantalla (ver abajo).

**Por qué no rompe el diseño.** La liquidación es una **suma de líneas, cada una con su origen**
(`origen = 'parrilla'` hoy). Cuando entre la regla de especiales es otro origen, con su propia
función pura, y el total, el congelado, el comprobante y el portal de la profesora no cambian.
Lo que sí hay que respetar desde ya, para no cerrarse esa puerta:

- El cálculo filtra `clases.tipo = 'parrilla'` **explícitamente**, igual que `metricas_finanzas`.
  Una especial nunca cae por accidente en la regla de base más variable.
- Si en el mes hay especiales dictadas por esa profesora, la liquidación muestra **"N clases
  especiales, se pagan aparte"**. Un monto que omite algo en silencio es peor que uno incompleto
  que lo dice (PRD-0010 §9).
- El detalle congelado guarda el origen de cada línea, así que un mes pagado con especiales
  incluidas se distingue de uno sin ellas.

### 4.2 Cualquier pasarela de pago

Pagarle a la profesora sigue siendo **una transferencia que hace una persona desde el banco**. El
sistema registra que ocurrió; no la ejecuta. Sin pasarela, sin API bancaria, sin pagos programados.

**Por qué no rompe el diseño.** Lo que el sistema guarda es el **hecho** —cuánto, cuándo, quién y
con qué respaldo—, no el medio. Si algún día hay transferencia automática, el comprobante pasa a
ser el identificador de la operación en vez de un archivo, y la fila se llena igual. ADR-0003 trata
la pasarela para **cobrarle a las alumnas**, que es otro problema.

### 4.3 Otras cosas que no entran

- **Teens.** Inactivo desde el 05/10/2026 y PRD-0011 sin construir. Su variable va por inscripción
  ($1.000 por alumna al mes), es un segundo camino de cálculo (§8.5.g.4) y entra cuando vuelva.
- **Cancelar una clase futura desde el sistema.** Sigue por Table Editor o migración, como hoy. Lo
  que cambia es que la base **exige la causa** al cancelar (§7.3), así que el cálculo nunca recibe
  una cancelación sin clasificar. La pantalla para hacerlo es de PRD-0009.
- **Toma de asistencia.** No hace falta: el variable va por crédito consumido (§8.5.b).
- **Boletas de honorarios, retención y SII.** Lo que se registra es lo transferido. Si se paga
  contra boleta con retención, el bruto y el líquido son otro tema y se pregunta aparte.
- **Septiembre.** Se pagó por fuera, como el resto de ese mes. El primer mes liquidable es
  **octubre de 2026** y es un parámetro, no un `if` en el código.

## 5. Flujo principal

**El día 1 de noviembre, Carla en `/owner/liquidaciones`:**

1. La página abre en **octubre**: el mes más antiguo que tiene algo por pagar. Una fila por
   profesora activa o con clases en el mes: clases dictadas, no dictadas, créditos consumidos, base,
   variable y **total**. Arriba, el total del mes.
2. Si una fila tiene algo que impide pagarla, lo dice en la misma fila y el botón no aparece:
   *"Sin costo cargado"*, *"2 clases canceladas sin causa"*, *"El mes todavía no termina"*.
3. Abre la fila de Pau y ve el detalle clase por clase. Una de las clases dice "dictada" y no lo
   fue: aprieta **"No se dictó"**, elige la causa y escribe el detalle. El total se recalcula.
4. Transfiere desde el banco, saca el comprobante y vuelve. Aprieta **"Pagado"**, adjunta el
   archivo y confirma. El diálogo repite el monto: *"Vas a registrar que le pagaste $54.750 a Pau
   por octubre"*.
5. La fila de Pau pasa a **"Pagado el 01/11 · $54.750 · Ver comprobante"** y **sale de la vista de
   pendientes de octubre**. Cuando se paga la última del mes, la página pasa sola a noviembre. Ver
   la pregunta 4 sobre cómo se interpreta "pasa al mes siguiente".

**Durante el mes, admin u owner:** desde la misma vista del mes en curso, o desde el detalle de
la profesora, marcan una clase como no dictada o reasignan quién la dictó. Admin lo hace sin ver
montos.

**La profesora** abre "Mi liquidación" en su portal y ve lo mismo que Carla de su propia fila, sin
el comprobante (§9).

## 6. Cuánto se le debe a una profesora en un mes

### 6.1 Lo que dice la regla vigente

De `CONTEXT.md` §5.b y PRD-0010 §8.5, sin agregar nada:

- **Base: $18.000 por hora** de clase.
- **Variable: $250 por crédito consumido y no devuelto, a partir del sexto** (Felipe, 21/10/2026):
  `máx(0, créditos − 5) × $250`, clase por clase, sin prorratear ni arrastrar. 15 alumnas son
  $2.500. Créditos consumidos son **reservas** con crédito y Una reserva con crédito y
  `credito_devuelto = false`, fuera de `pendiente_pago`, `expirada` y `liberada`. ⚠️ **El umbral
  todavía no está en `costoClase()` de `lib/dominio/finanzas.ts`**, que calcula el margen de
  `/owner/finanzas`: hoy ese margen cobra $250 por cada crédito. Es **el mismo
  predicado** que atribuye ingreso (§7.1.3) y que ya usa `metricas_finanzas` (§17.4.3): se reutiliza,
  no se reescribe.
- **El crédito regalado se paga igual** (Felipe, 04/10/2026).
- **Se le paga a quien dictó**, que es `clases.profesora_id`, no la titular del horario (§8.5.d).
- **No dictó por causa suya: nada. Por causa de XO: la base, sin variable** (§8.5.a). Matizado en
  §7.2, porque la regla literal falla con los casos reales.

### 6.2 El cálculo

Para una profesora *P* y un mes *M*:

> **Liquidación(P, M) = Σ pago(clase)** sobre las clases con `tipo = 'parrilla'`,
> `profesora_id = P`, `inicio` dentro de *M* en `America/Santiago` e `inicio < now()`.

| Estado de la clase | Pago |
|---|---|
| `programada`, ya pasó (se presume dictada) | `base_hora_clp × horas` + `variable_credito_clp × créditos consumidos` |
| `no_dictada` o `cancelada` | Según el efecto de su causa (§7.2): la base × horas, o nada |
| `no_dictada` o `cancelada` **sin causa** | **No se calcula.** La fila queda bloqueada hasta clasificarla |
| `programada`, todavía no ocurre | No entra: el mes no se paga antes de terminar |

- **Horas**: `fin − inicio`; sin `fin`, una hora. Es `horasDeClase()` de `lib/dominio/finanzas.ts`
  y se reutiliza. Una clase de 90 minutos paga $27.000 de base, como dice `CONTEXT.md` para EB.
- **Pesos enteros.** Si la duración da fracción de peso, se redondea al peso por línea, no al total.
- **El mes** se corta en `America/Santiago`, como en la parte 1 (PRD-0010 §16): una clase del 31
  a las 21:00 es de ese mes, no del siguiente.
- **Se cuenta por la fecha de la clase**, no por la de la reserva. Es distinto del ingreso atribuido
  (§7.1.4), y a propósito: se le paga el trabajo cuando lo hizo.
- **El costo se lee de `costos_profesoras` al calcular.** Si Felipe cambia la base a mitad de mes,
  el mes sin pagar se recalcula con el valor nuevo entero. Un mes pagado no se mueve (§8).

### 6.3 Lo que se derivó y no estaba escrito

Tres cosas del cálculo no las dice ninguna regla. Son las únicas consecuencias de §6.1 que salen
de leer el esquema, y están para que se puedan objetar:

1. **La fecha que manda es la de la clase**, no la de la reserva (ver arriba).
2. **Una clase de parrilla pasada con cero reservas se paga** como dictada: la base, sin variable.
   Es lo que dice §8.5.e ("el default es dictada") combinado con §8.5.a. Pero es la pregunta abierta
   más cara (pregunta 1): en octubre puede haber varias.
3. **Una `no_dictada` no paga variable aunque haya tenido reservas**, porque al pasar a ese estado
   las reservas recuperan su crédito (§7.3). El variable sale solo en cero; no hace falta una regla.

### 6.4 Isi no tiene costo cargado

`costos_profesoras` se sembró el 30/09 con una fila por profesora existente. Isi entró el 05/10 y
`20261005120000_catalogo_octubre.sql` no le agregó la suya. **Hoy su liquidación de octubre no se
puede calcular.**

No se resuelve poniéndole $0: la liquidación muestra *"Sin costo cargado"*, sin botón, igual que
`/owner/finanzas` muestra "sin costo cargado" en el margen. La migración de esta parte le agrega la
fila con la regla general —$18.000 y $250— **si Felipe confirma que es su tarifa** (pregunta 3).

### 6.5 El incentivo por promedio (Felipe, 04/11/2026)

De `CONTEXT.md` §5.b, "Incentivo por promedio — regla del 04/11/2026, en dos tramos". Es la tercera
versión en tres días, y **reemplaza a las dos anteriores**.

| Promedio de las 4 mejores clases del mes, por curso | Incentivo |
|---|---|
| **≥ 14** | **$7.500** |
| **≥ 22** | **$7.500 más: $15.000 en total** |

1. **Las 4 mejores del mes, no las 4 últimas.** Con 5 clases en el mes se descarta la peor.
2. **Mes calendario**, en `America/Santiago`. No cruza meses.
3. **Por curso.** Una profesora con dos cursos tiene dos promedios **y puede ganar en los dos**.
4. **Solo cuentan las dictadas.** Una no dictada no entra como cero.
5. **Los tramos se suman.** El 22 exacto cobra los dos.
6. **Con menos de 4 dictadas en el mes, no hay incentivo**, salvo que recupere una y llegue a cuatro.
   La recuperación es una clase dictada más del mes en que se dicta.

**Lo que tuve que leer yo**, porque la regla no lo dice (§12.3):

- **"Alumnas" de una clase = créditos consumidos en ella**, el mismo número del variable. No hay
  registro de asistencia, y es el único conteo que ya existe.
- **El promedio se compara sin decimales**: suma de las 4 mejores ≥ 14 × 4 = 56. Así 13,75 no
  llega y 14,00 sí, sin redondeos.
- **La clase cuenta para quien la dictó** (`clases.profesora_id`), como el pago. Un reemplazo
  suma al promedio de la reemplazante en ese curso, no al de la titular.
- **Las especiales no entran**: se pagan con otra regla (§4.1).

⏸ **No implementado, a propósito:**

- **Promediar con 3 cuando las clases no se dictaron por decisión de la academia.** Felipe lo nombró
  como posibilidad, no como regla, y `CONTEXT.md` dice que el PRD lo pregunte antes de
  implementarlo. Queda en §13 como pregunta nueva.
- **El tramo más alto para Studio 98 y el incentivo por 100% de ocupación.** Están nombrados y no
  decididos.
- ⚠️ **El tramo de 22 es inalcanzable en Los Leones**, que tiene 16 lugares, y en Diaguitas pide el
  100%. `CONTEXT.md` lo marca como **sin resolver**: un umbral relativo a la capacidad
  probablemente corresponda. El código sigue la regla vigente y no lo corrige.

### 6.6 Las clases que no se dictaron, y su recuperación

De "Las cinco decisiones…", punto 1, y de la regla del 03/11:

| Causa | Si **no** se recupera | Si se recupera |
|---|---|---|
| `sala_no_disponible` | **Base**, sin variable: ella fue, el problema fue de XO | **Nada en la original**: se paga una sola vez, en la recuperación |
| `cambio_de_parrilla` | **Nada**: esa clase nunca estuvo en su semana | Nada en la original |
| `ausencia_profesora` | **Nada** | Nada en la original |
| `sin_alumnas` | **Base**, salvo que se haya **cancelado con anticipación** (ver abajo) | Nada en la original |
| `asistencia_insuficiente` | Igual que `sin_alumnas` | Nada en la original |

- **La recuperación se paga como cualquier clase dictada**: base más variable, en el mes en que se
  dicta. Así ni el sueldo ni la sala se pagan dos veces.
- **"Recuperada"** quiere decir que existe una clase marcada como su recuperación
  (`clases.recupera_clase_id`) que no está cancelada ni no dictada.
- **"Cancelar temprano ahorra la sala y el sueldo, cancelar el mismo día no"**: es la frase con que
  Felipe explicó la regla. La traduje así (§12.3): para `sin_alumnas` y `asistencia_insuficiente`,
  si la clase se **canceló antes del día de la clase** en `America/Santiago`, no se paga. Si se
  canceló el mismo día o después, o quedó `no_dictada`, se paga la base. Para las otras tres causas
  la anticipación no cambia nada.
- **El caso del 03/11**: la Reggaeton Femme de Pau en Los Leones queda `asistencia_insuficiente`.
  Se canceló después de la hora y se va a recuperar, así que no paga en noviembre y se paga la
  recuperación. Si no se recuperara, paga la base.

## 7. El estado `no_dictada` y su causa

### 7.1 Estado y causa son dos preguntas distintas

- **El estado** responde *¿ocurrió?* Se agrega `no_dictada` a `programada | cancelada`.
  - `cancelada`: se avisó antes. El cupo se liberó y el trigger devolvió los créditos.
  - `no_dictada`: llegó la hora y no hubo clase. Se registra después.
- **La causa** responde *¿por qué?*, y es lo que lee el cálculo. Valores cerrados, en una columna,
  **obligatoria en los dos estados**: una cancelación también decide si se paga la base.
- **No se agrega `dictada`.** PRD-0010 §8.5.c lo proponía, pero nadie confirma 30 clases al mes
  (§8.5.e): "dictada" sigue siendo `programada` y pasada. Agregar el estado obligaría a un proceso
  que lo escriba, y un proceso que no corre convierte cada clase en "sin confirmar".

### 7.2 Los valores, sacados de los casos reales

Se pidió proponerlos **a partir de lo que ya está en la base, no de casos hipotéticos**. Con una
limitación que hay que decir primero:

> ⚠️ **Hoy no pude leer la base de producción ni la de staging** (ver §12.1). Lo que sigue sale de
> lo que el repo registra que se escribió en producción: las migraciones aplicadas y el changelog.
> **Las cancelaciones hechas a mano desde el Table Editor no las veo.** Antes de cerrar la lista
> hay que correr la consulta de §7.6 y clasificar cada fila. Si aparece un caso que no calza, se
> agrega el valor; si un valor no tiene caso, se discute si sale.

Casos reales en el repo:

| Fecha | Qué pasó | Fuente | ¿Qué se pagó o debería pagarse? |
|---|---|---|---|
| Lun 07/09 | La Girly de Pau de los lunes **no se dictó** por el problema de salas que movió su horario. La migración se escribió el 08, después de esa clase | `CONTEXT.md` §4, migración `20260908150000` (la borró, no la canceló) | **Ambiguo**: es una clase perdida a última hora (base) y también la primera del cambio de parrilla (nada). Está justo en el borde de la pregunta 2 |
| 08–09/09 | Las clases futuras de los horarios viejos de Pau se cancelaron (con reserva) o borraron, con motivo "Cambio de horario…" | misma migración | El horario se movió; las clases nuevas reemplazan a las viejas. **Pagar la base por cada clase vieja sería pagarle dos veces la misma semana** |
| 05/10 | Las clases futuras de Teens con reserva se cancelaron con motivo "XO Teens se deja de dictar por ahora…" | `20261005120000` | El curso ya no existe. **Pagar la base sería pagarle a Carli por clases que nadie iba a dictar** |
| Mar 03/11 | La Reggaeton Femme de Pau de las 18:00 en Los Leones **no se dictó porque muchas alumnas no alcanzaron a llegar**. Pau no faltó. Se cancela después de la hora, con los créditos devueltos, y se va a recuperar; la sala de la recuperación no se cobra (Felipe, 03/11) | migración `20261103210000` | 🔴 **Pendiente de clasificar.** No calza en ningún valor de abajo: no es la sala, no es la parrilla y no es la profesora. Ver la nota que sigue |

> 🔴 **Caso nuevo, 03/11/2026: la clase que no se dicta por asistencia.** La de Pau del martes 3 es
> la primera clase de parrilla que no se dictó **por las alumnas**: Pau estaba, la sala estaba y la
> clase existía, pero no llegó gente suficiente para hacerla. **Esa causa no existe en el modelo**
> —ni en los tres valores propuestos ni en `sin_alumnas`, que pensaba en una clase sin reservas, y
> esta sí tenía— y no se puede liquidar hasta que exista. Queda **pendiente de clasificar para el
> pago**, y la pregunta es de Felipe: ¿se le paga la base a Pau, que fue y no faltó?
>
> Dos cosas más que el cálculo tendrá que saber, porque esta clase no viene sola:
> - **Se va a recuperar.** La recuperación es una clase más en el mes de Pau. Si se paga la base
>   por la del 3 y también por la recuperación, son dos pagos por una sola clase dictada.
> - **La sala de la recuperación no se cobra** (Felipe). El costo de sala sale hoy de
>   `sedes.costo_hora_clp` por `clases.sede_id`, sin excepción posible por clase: la recuperación
>   en Los Leones se costearía a $17.000 la hora aunque no se pague. Hace falta un modo de marcarla.

De ahí, los valores propuestos:

| Valor | Cuándo | Efecto en el pago | Caso real |
|---|---|---|---|
| `sala_no_disponible` | La sala falló o no estaba, y la clase no se pudo dar | **Base**, sin variable | 07/09, Pau, si se lee como sala que falló a última hora (ver arriba) |
| `cambio_de_parrilla` | XO movió o retiró el horario o el curso, y la clase dejó de existir | **Nada.** No es una clase que ella perdió: es una que ya no estaba en su semana | 08/09, Pau · 05/10, Teens |
| `ausencia_profesora` | La profesora no pudo dictarla: enferma, no llegó, otra cosa suya | **Nada** | ⚠️ **Ninguno en el repo.** Va igual porque la regla de pago vigente lo nombra (§8.5.a): sin este valor, el sistema no puede expresar la única causa que paga cero a última hora. Pregunta 2 |

Y lo que **no** se incluye, por no tener caso:

- `sin_alumnas`, `fuerza_mayor` y `decision_xo`, que proponía §8.5.c. `sin_alumnas` se resuelve
  primero como regla (pregunta 1), y según la respuesta será un valor o no. Agregar un valor después
  es una migración de una línea sobre un `check`; quitar uno que ya se usó, no.
- Separar `profesora_enferma` de `profesora_no_llego`. §8.5.a pide registrar la causa fina para ver
  patrones, pero **no cambia el monto** y no hay un solo caso. La causa fina va en el detalle de
  texto, que es obligatorio. Si aparecen casos y sirve separarlos, se separa.

**El efecto se deriva del valor, no se guarda aparte** (§8.5.c): una sola función
`efectoDeCausa()` en `lib/dominio`, usada por el cálculo y por la pantalla.

> 🔴 **El cambio de fondo respecto de §8.5.a:** la regla decía "causa de XO → base". Los casos
> reales muestran que **XO tiene dos tipos de causa**: la que le hace perder la clase a la profesora
> a última hora (paga) y la que reorganiza la parrilla (no paga). Esto no lo decido yo: es la
> pregunta 2, y hasta que Felipe la conteste `cambio_de_parrilla` queda propuesto, no aprobado.

### 7.3 Lo que cambia en `clases`

| Columna | Tipo | Regla |
|---|---|---|
| `estado` | text | Admite además `no_dictada` |
| `causa` | text | Uno de los valores de §7.2. **Obligatoria si `estado` es `cancelada` o `no_dictada` y `tipo = 'parrilla'`** (check de tabla). Nula en `programada` |
| `causa_detalle` | text | Obligatorio con la causa. Para la alumna en una cancelada sigue existiendo `motivo_cancelacion`, que es otra cosa: lo que ella lee |
| `causa_registrada_por` | uuid → `perfiles` | Quién la marcó. Esto mueve plata, como `movimientos_credito.creado_por` |
| `causa_registrada_at` | timestamptz | |
| `reasignada_por`, `reasignada_at`, `profesora_original_id` | uuid · timestamptz · uuid | Solo en un reemplazo (§7.5) |

- **El check se limita a parrilla.** Las especiales tienen su propio flujo de cancelación
  (PRD-0018) y se pagan con otra regla; exigirles causa ahora es tocar un flujo que no está en
  alcance.
- **El trigger que devuelve créditos** (`clases_al_cancelar`) reacciona hoy solo al pasar a
  `cancelada`. Se extiende a `no_dictada`: para la alumna el efecto es el mismo, no recibió la clase.
  Con una diferencia que ya existe y conviene recordar: una reserva cancelada **tarde** por la
  alumna ya perdió su crédito y no se le devuelve, porque la clase no se dictó después de que ella
  ya la había soltado. Se mantiene como hoy.
- **`cancelar_clase()` gana el parámetro de causa.** Hoy solo la llama `service_role` y ninguna
  pantalla.
- **Las canceladas que ya existen se clasifican en la misma migración**, con la causa que salga
  de §7.6. Sin eso, el check no se puede crear. Las del escenario de staging ("Escenario de
  prueba") se clasifican como `sala_no_disponible`, que es lo que el escenario simula.

### 7.4 Registrar que una clase no se dictó

- **Solo sobre clases pasadas** y `programada`. Una futura se cancela, no se "no dicta".
- **Admin u owner, no la profesora** (§8.5.e): es parte interesada. Puede avisar por WhatsApp, que
  es lo que hace hoy.
- **Una función de base**, `registrar_no_dictada(actor, clase, causa, detalle)`, `security definer`
  con el chequeo de rol adentro, concedida solo a `service_role` y llamada desde un Route Handler,
  como `registrar_egreso`.
- **No se puede si el mes de esa clase ya está pagado para esa profesora.** Rebota con *"Octubre ya
  se le pagó a Pau. Si esto cambia lo que se le debía, regístralo como ajuste en noviembre"*. Es lo
  que hace cumplir §8: el dato del mes pagado no se mueve por la puerta de atrás.
- **No se deshace con un botón.** Un error se corrige con la misma función hacia el estado correcto,
  que queda con su propio autor y fecha. Volver a `programada` no devuelve los créditos que ya se
  devolvieron, así que **se impide**: una `no_dictada` solo puede cambiar de causa.

### 7.5 El reemplazo

Un `update` de `clases.profesora_id` (§8.5.d), con `profesora_original_id`, `reasignada_por` y
`reasignada_at`. Desde el detalle de una clase pasada: *"La dictó otra profesora"* y se elige quién.

- La titular deja de verla en su liquidación y en "Mis clases". La reemplazante la ve en las suyas.
- **Mismo candado que §7.4**: no si el mes ya está pagado para cualquiera de las dos.
- Se puede hacer también sobre una clase futura (se sabe con anticipación que alguien cubre), y en
  ese caso las inscritas pasan a verse en el portal de la reemplazante, que es lo correcto.

### 7.6 La consulta que cierra la lista

Se corre **en producción, en solo lectura**, antes de escribir la migración. No escribe nada, pero
va igual con aprobación de Felipe porque es SQL contra producción (`CLAUDE.md`):

> Todas las clases con `estado = 'cancelada'`: fecha, curso, profesora, `motivo_cancelacion`, si es
> parrilla o especial y cuántas reservas tuvo. Más las clases de parrilla pasadas de octubre con
> cero reservas, que es lo que decide el peso de la pregunta 1.

Cada fila se clasifica a mano con Felipe. El resultado queda escrito en este PRD (§12) y la lista
de valores se ajusta a lo que apareció.

## 8. "Pagado": el monto se congela

### 8.1 Lo que se paga es un hecho; lo pendiente es un cálculo

**No hay fila de liquidación hasta que se paga.** Una liquidación pendiente es un cálculo, y
calcularlo cada vez que se mira es lo correcto: refleja la última corrección. Lo que se guarda es
el **pago**, y una vez guardado no se recalcula nunca.

Por eso no hay columna `estado` con `pendiente | pagada`: pendiente es "no hay fila". PRD-0010 §8.4
proponía también `comision_clp` y `monto_neto_clp`, de una idea de comisión de la fase 2 que hoy no
existe; no se crean.

### 8.2 `liquidaciones_profesoras`

| Columna | Tipo | Regla |
|---|---|---|
| `id`, `created_at`, `updated_at`, `deleted_at` | | Convención del ERP |
| `profesora_id` | uuid → `profesoras` | |
| `mes` | date | Primer día del mes. Mayor o igual que el primer mes liquidable (octubre 2026) |
| `monto_clp` | int | Mayor que cero. Lo transferido |
| `detalle` | jsonb | **La foto del cálculo al pagar**: cada clase con fecha, curso, sede, estado, causa, horas, créditos consumidos, base, variable, total de la línea y `origen`. Más los costos usados |
| `comprobante_path` | text | **No nulo.** Ruta en el bucket privado (§8.4) |
| `egreso_id` | uuid → `egresos` | El egreso que este pago registró (§8.3) |
| `pagada_at`, `pagada_por` | timestamptz · uuid → `perfiles` | |
| `anulada_at`, `anulada_por`, `motivo_anulacion` | | Solo si se anula (§8.5) |

- **Una sola vigente por profesora y mes**: índice único parcial sobre `(profesora_id, mes)` donde
  `deleted_at is null`.
- **El detalle no es adorno.** Sin él, el monto pagado queda solo y nadie puede explicar en
  diciembre de dónde salieron los $54.750 de octubre si alguien corrigió una clase entretanto. Con
  él, el monto pagado se explica **contra lo que la base decía ese día**, y el aviso de §8.6 puede
  mostrar qué línea cambió.
- **RLS de solo owner**, como `egresos`. Solo `select` para `authenticated`; toda escritura por
  función concedida a `service_role`.

### 8.3 Pagar es una sola función, una sola transacción

`pagar_liquidacion(actor, profesora, mes, monto_visto, comprobante_path)`:

1. Chequea que el actor sea owner. Un admin rebota con `42501`, también por `/rest/v1/rpc`.
2. Chequea que el mes ya terminó en `America/Santiago` y que no haya un pago vigente.
3. **Vuelve a calcular el monto adentro**, con el mismo SQL que la pantalla, y lo compara con
   `monto_visto`. Si no coinciden, rebota con *"El monto cambió mientras lo mirabas: ahora es
   $X. Recarga antes de marcarlo"*. Así nunca se congela un número distinto del que se transfirió
   mirando la pantalla, aunque alguien haya marcado una clase en el intertanto.
4. Rebota si alguna clase del mes está sin causa o si la profesora no tiene costo cargado.
5. Inserta la liquidación con el detalle **y el egreso** con categoría *sueldo de profesora*, fecha
   de hoy, el mismo monto y el mismo comprobante. Las dos filas o ninguna.

**Por qué el pago registra el egreso.** Si no lo hace, Carla tiene que ir a `/owner/finanzas` y
anotarlo a mano. Si se le olvida, la caja neta de noviembre queda inflada en lo que se pagó; si lo
anota además de que el sistema lo calcule en otra parte, se descuenta dos veces. Que el pago *sea*
el egreso deja una sola fuente. La categoría `sueldo_profesora` ya existe desde la parte 2.

### 8.4 El comprobante, en el mismo paso

Se reutiliza el patrón de los comprobantes de egresos (`app/api/egresos/comprobante/route.ts`):

- **Bucket privado nuevo**, `comprobantes-liquidaciones`, sin políticas para `anon` ni
  `authenticated`: solo la service role lee y escribe.
- **Route Handler**, no Server Action: la sesión, el tipo y el peso se verifican en el servidor.
- **URL firmada** de diez minutos para verlo, generada en el servidor tras verificar que quien la
  pide es owner.
- El archivo se nombra por el id de la liquidación.

Dos diferencias con egresos, y por qué:

1. **Va en el mismo paso, no después.** En egresos se registra primero y se adjunta luego. Acá el
   handler recibe el archivo, lo sube, y recién con la ruta llama a `pagar_liquidacion`. Si la
   función rebota, el archivo subido se borra en el mismo handler; si el borrado falla, queda un
   archivo huérfano sin fila, que no expone nada porque el bucket es privado.
2. **Acepta PNG además de PDF, JPG y WebP.** El comprobante de una transferencia es casi siempre un
   pantallazo de la app del banco, y en el teléfono un pantallazo es PNG. Con la lista de egresos,
   el primer intento del 1 de noviembre rebotaría. El tope sigue en 2 MB.

#### ¿Se puede marcar pagado sin comprobante? **No.**

1. **El comprobante es lo que vuelve el congelado verificable.** El monto queda fijo; el comprobante
   es la prueba de que ese número salió del banco. Un pago sin respaldo es una afirmación, y la
   liquidación existe justamente para dejar de pagar sobre afirmaciones.
2. **"Lo subo después" en la práctica es "nunca".** En egresos el comprobante es opcional y se sube
   aparte; un mes después, el que falta no lo busca nadie. Acá, al momento de apretar el botón, el
   pantallazo está en la mano.
3. **Es lo que se usa si una profesora reclama** que no le llegó o que le llegó otro monto.
4. **El costo de exigirlo es mínimo**: el flujo es "transfiero, saco pantallazo, lo marco", con el
   archivo ya a mano.

El caso que esto deja afuera es **pagar en efectivo**. Si pasa, se sube una foto de un recibo firmado
o de un mensaje de confirmación. No se agrega un camino "sin comprobante" para un caso que hoy no
existe; si se vuelve habitual, se revisa.

### 8.5 Anular un pago marcado por error

Owner, con motivo obligatorio. Marca `anulada_*` y `deleted_at` en la liquidación, **anula el egreso
asociado** con el mismo motivo (`anular_egreso` ya existe) y el mes vuelve a estar pendiente. Nada
se borra: la fila anulada sigue ahí con su detalle y su comprobante.

Es para el botón apretado por error o el mes equivocado, **no para corregir un monto**: si se
transfirió de más o de menos, eso es un ajuste (§8.6), porque la transferencia sí ocurrió.

### 8.6 Cuando un mes pagado cambia después

Pasa: el 3 de noviembre aparece que una clase de octubre no se dictó. §7.4 impide marcarla sobre un
mes pagado, así que la corrección **no** puede mover lo pagado. Se corrige con:

- **Un ajuste**, en el mes siguiente: una línea con monto positivo o negativo, motivo obligatorio y
  autor, que entra al total de ese mes y se congela con él al pagarlo. En el ejemplo, −$18.000 en
  noviembre con el motivo "La clase del 14/10 no se dictó". Vive en una tabla aparte,
  `ajustes_liquidacion` (`profesora_id`, `mes`, `monto_clp` distinto de cero, `motivo`,
  `registrado_por`), con RLS de solo owner y anulable igual que un egreso.
- **Un aviso, en la fila del mes pagado**, si el cálculo de hoy difiere del congelado: *"Hoy este
  mes daría $X; se pagaron $54.750"*, con la línea que cambió (para eso sirve el detalle). Se
  calcula al mirar y no se guarda. Con el candado de §7.4 no debería aparecer nunca; si aparece, algo
  cambió por fuera de las funciones (un costo editado, una reserva tocada a mano en el Table Editor)
  y es exactamente lo que hay que ver.

**Ni el aviso ni el ajuste son necesarios el 1 de noviembre**: el primer mes pagado es octubre, y la
primera vez que pueden hacer falta es en noviembre. Van en la última fase (§11).

## 9. Lo que ve la profesora

**Propuesta: ve su liquidación, y solo la suya.** Sujeto a la pregunta 5, porque contradice la regla
4 de PRD-0008: *"No ve ningún monto, en ninguna vista"*.

### 9.1 Por qué sí

- Esa regla se escribió para que no viera **lo que pagan las alumnas** ni el negocio. Lo que ella va
  a recibir es **su** plata.
- **El mejor momento para encontrar un error es antes del día 1.** Si ve en el mes en curso que una
  clase dice "no dictada" cuando la dio, avisa y se corrige antes de pagar. Sin portal, el error
  aparece cuando la transferencia no calza, y ahí ya es un ajuste.
- Le quita a Carla los cinco WhatsApp de "¿cuánto me toca este mes?".

### 9.2 Qué ve

"Mi liquidación" en el portal de profesora, por mes. El mes en curso rotulado **"En curso: puede
cambiar hasta que termine el mes"**; los pagados, con **"Pagado el 01/11/2026"**.

| Ve | No ve |
|---|---|
| Cada clase suya del mes: fecha, curso, sede, estado y causa | **Nombres** de quienes reservaron. La liquidación no los necesita |
| Créditos consumidos de cada clase, **como número** | Precios, lo que pagó cada alumna, el ingreso atribuido a ella |
| Base, variable y total de cada clase y del mes | El comprobante (es de owner) ni el egreso |
| Si el mes está pagado, cuándo y cuánto | Liquidaciones de otras profesoras |
| Los ajustes con su motivo | `costo_hora_clp` de la sala, ni ningún costo que no sea el suyo |

**Nada de contacto de alumnas** —ni RUT, ni correo, ni teléfono, ni apoderado— porque **la
liquidación no lee `perfiles` en ningún momento**: cuenta reservas por clase, no las nombra.

### 9.3 Cómo se hace sin abrir tablas

`liquidaciones_profesoras` y `ajustes_liquidacion` quedan con RLS de solo owner. La profesora lee
por **una función `security definer`, `mi_liquidacion(mes)`**, cuyo tipo de retorno **es** el
contrato de columnas de §9.2, filtrada adentro por la profesora de la sesión. RLS filtra filas, no
columnas (`CLAUDE.md`): abrirle la tabla con una política "solo lo suyo" le entregaría
`comprobante_path`, `pagada_por` y el detalle completo.

- Concedida a `authenticated` y `service_role`, revocada a `public, anon` **y con el grant escrito**.
- Una profesora que pide la de otra recibe cero filas, **probado con su sesión** (§10).
- `admin` no tiene profesora asociada: cero filas. No ve montos por esta puerta tampoco.

## 10. Criterios de aceptación

Valores esperados calculados a mano antes de programar, como manda PRD-0010 §11.4. Escenario en
staging con dos profesoras de prueba, P1 y P2, base $18.000 y variable $250, un mes cerrado:

| Clase | Qué pasa | P1 | P2 |
|---|---|---|---|
| A | P1 dictó. 3 créditos consumidos: 1 de pack, 1 **de regalo** y 1 **cancelado tarde**. Otra reserva cancelada **a tiempo** | $18.750 | |
| B | P1, pasada, **cero reservas** | $18.000 ⚠️ pregunta 1 | |
| C | P1, `no_dictada` por `ausencia_profesora`. Tenía 2 reservas: vuelven los créditos | $0 | |
| D | P1, `cancelada` por `sala_no_disponible` | $18.000 | |
| E | P1, `cancelada` por `cambio_de_parrilla` | $0 ⚠️ pregunta 2 | |
| F | Horario de P1, **la dictó P2** con 2 créditos consumidos | | $18.500 |
| G | Especial dictada por P1 | No entra: "1 clase especial, se paga aparte" | |
| H | P1, clase del mes **siguiente**, ya pasada | No entra en este mes | |
| | **Total** | **$54.750** | **$18.500** |

Más una tercera, P3, **sin fila en `costos_profesoras`**: "Sin costo cargado", sin botón.

- [ ] `npm test` en verde con los tests de `lib/dominio/liquidacion.ts`, que cubren cada fila.
- [ ] El escenario da exactamente esos montos **por SQL y en la página renderizada**.
- [ ] Con una clase cancelada **sin causa**, la fila de esa profesora dice cuántas y no ofrece
      "Pagado". El check de tabla impide además crear una nueva sin causa.
- [ ] Marcar C como no dictada **desde el botón** devuelve los dos créditos (libro y lotes cuadran:
      la conciliación de PRD-0010 §5.1.b sigue verde).
- [ ] "Pagado" **sin archivo** no se puede enviar, y la función rebota sin comprobante aunque la
      llamen por `/rest/v1/rpc`.
- [ ] Un pantallazo PNG de 1,5 MB se sube; uno de 3 MB rebota con su mensaje.
- [ ] Al pagar P1: queda la liquidación con $54.750 y su detalle, **y** un egreso de $54.750 en
      `/owner/finanzas` con el mismo comprobante. Si la función falla, no queda ninguna de las dos.
- [ ] Con P1 pagada, marcar B como no dictada **rebota** con el mensaje del ajuste. El monto pagado
      sigue en $54.750.
- [ ] Si el monto cambia entre que se abrió la página y se apretó "Pagado", rebota con el monto nuevo.
- [ ] El comprobante se ve por URL firmada con sesión owner; con sesión admin o profesora, 403; la
      URL firmada vencida no abre.
- [ ] Anular el pago deja la fila con `deleted_at`, anula el egreso y el mes vuelve a pendiente.
- [ ] P1 en su portal ve sus líneas y su total, y **cero** de P2. Probado con `set local role
      authenticated` y sus claims, y también lo que **no** debe ver: `comprobante_path` no existe en
      el retorno; `/rest/v1/liquidaciones_profesoras` le devuelve `[]`.
- [ ] Un admin recibe `[]` en las dos tablas, `42501` en `pagar_liquidacion` y nada en
      `/owner/liquidaciones`. Sí puede registrar una clase no dictada.
- [ ] `metricas_finanzas` y las métricas de ocupación **dejan de contar `no_dictada` como dictada**.
      Hoy las dos usan `estado <> 'cancelada'`, que la dejaría pasar (§11).
- [ ] `GET /rest/v1/` expone lo nuevo y nada más.
- [ ] `/owner/liquidaciones` resuelve en tres llamadas a Supabase o menos.
- [ ] `npm run build` pasa.

## 11. Riesgos, supuestos y deuda que toca

| | |
|---|---|
| **"Dictada" se infiere en tres lugares** | `metricas_resumen`, `metricas_demanda` y `metricas_finanzas` definen dictada como `estado <> 'cancelada' and inicio < now()`. Con `no_dictada` las tres se equivocan en silencio. Se corrigen en la misma migración, con una sola definición: `estado = 'programada' and inicio < now()` |
| **Doce días, con staging caído** | Todo el método de verificación del proyecto pasa por staging (§12.1). Si staging no vuelve en uno o dos días, el 1 de noviembre se paga con la liquidación calculada y verificada solo por tests, o a mano |
| **La regla de `cambio_de_parrilla` es nueva** | Si Felipe dice que sí se paga, cambia una línea de `efectoDeCausa()` y un esperado del escenario. Nada del modelo |
| **La profesora va a ver números** | Si ve una clase mal marcada, va a reclamar. Es el objetivo, pero conviene que Carla lo sepa antes de abrirlo |
| **El cron de generación** | Si no generó clases de octubre para algún horario, esas clases no existen y no se pagan. Se revisa en la consulta de §7.6: clases esperadas por horario contra clases que hay |
| **`CONTEXT.md` §12 está desactualizado** | Dice "componente variable: sin definir" y "remuneración de Carla: sin definir", cuando §5.b define el variable y la migración de la parte 2 incluye a Carli (Felipe, 30/09). No lo edito sin confirmación (`CLAUDE.md`) |

## 12. Notas de implementación

### 12.1 Estado del entorno al escribir esto (20/10/2026)

- **Staging no responde**: `ybopuahlzbjkkwumkllk.supabase.co` da `NXDOMAIN`. Lo más probable es que
  el plan gratuito lo haya pausado tras dos semanas sin uso (`CONTEXT.md` §11). Se reactiva desde el
  panel de Supabase.
- **El `SUPABASE_ACCESS_TOKEN` de `.env.local` está vencido o revocado** (401 en la API de gestión).
  Sin él no corre ni `migration list` ni `db push --dry-run`, contra ninguna de las dos bases.
- `.env.local` apunta a staging, como pide `supabase/README.md`. No hay credenciales de producción
  en la máquina, así que la consulta de §7.6 la tiene que correr Felipe o hay que cargarlas.

### 12.2 Fases propuestas (se detallan en un plan aparte al aprobar)

| Fase | Qué | Bloquea el 1/11 |
|---|---|---|
| 0 | Staging de vuelta, token nuevo, consulta de §7.6, clasificación con Felipe | Sí |
| 1 | `lib/dominio/liquidacion.ts` y `efectoDeCausa()` con tests | Sí |
| 2 | Migración: estado, causa, backfill, trigger, `liquidaciones_profesoras`, funciones, bucket, fila de Isi, las tres métricas corregidas | Sí |
| 3 | `/owner/liquidaciones` con detalle, "No se dictó", reemplazo, "Pagado" con comprobante | Sí |
| 4 | Verificación en staging por SQL, por sesión de cada rol y con clics a 390 px | Sí |
| 5 | Producción, **con aprobación de Felipe para esa migración**. Objetivo: el 29/10, con dos días de margen | Sí |
| 6 | Portal de la profesora (§9) | No: puede entrar después del primer pago |
| 7 | Aviso de diferencia y ajustes (§8.6) | No: no pueden hacer falta antes de noviembre |

### 12.3 Implementación, 05/11/2026 (rama `prd-0010-parte-3-liquidacion`)

| Paso | Qué | Estado | Commit |
|---|---|---|---|
| A | §13 contestado desde `CONTEXT.md`; §6.5 incentivo y §6.6 causas | ✅ | `03a30ed` |
| B | ADR-0008: la profesora ve su liquidación | ✅ | `1c442c9` |
| C | `lib/dominio/liquidacion.ts`, **38 tests**, prueba de mutación | ✅ | `1ac78c7` |
| D | Migración `20261105140000_liquidacion_profesoras.sql`: escrita, `--dry-run` contra producción lista **solo esa**, **sin aplicar**. Escenario en base local: **29 de 29** | ✅ | ver el log de la rama |
| E | `/owner/liquidaciones`, "Mi liquidación" en el portal, el Route Handler del comprobante | ⏸ No empezado, a propósito | — |
| — | Aviso de diferencia y ajustes (§8.6) | ⏸ Fase 7, como estaba | — |

**Dónde la implementación se separó del borrador, y por qué:**

1. **La regla de pago vive solo en `lib/dominio`.** El borrador decía que `pagar_liquidacion`
   "vuelve a calcular el monto adentro, con el mismo SQL que la pantalla" (§8.3). Eso habría puesto
   la regla en SQL y en TypeScript, y solo una de las dos con tests. Quedó así:
   - la base entrega **insumos** y una **huella** (md5) de esos insumos más la tarifa;
   - la pantalla calcula con `liquidar()` y manda monto, detalle y huella;
   - `pagar_liquidacion` recalcula la huella y **rebota si cambió**.

   Es la misma garantía —nunca se congela un número distinto del que se miró—, sin duplicar la
   regla.
2. **La causa vive en `causas_de_clase`, no en `clases`** (§7.3 la ponía en `clases`). `clases` es
   pública entera desde 20260904120000 (`using (true)`), y un detalle como "la profe estaba
   enferma" no puede quedar a la vista de cualquiera. `causas_de_clase` la leen solo admin y owner.
   El reemplazo, por lo mismo, queda en `reasignaciones_de_clase` y no en columnas de `clases`.
3. **No hay `check` que obligue la causa al cancelar.** El borrador lo pedía, con el backfill de
   todas las canceladas.
   - Sin leer producción no se pueden clasificar las que ya existen.
   - Un `check` nuevo rompería cualquier flujo que hoy cancela sin causa.

   En cambio, **la liquidación no se puede pagar** mientras haya una cancelada o no dictada sin causa
   (`textoDeBloqueo`, y `pagar_liquidacion` lo vuelve a comprobar). El efecto que importa —no pagar
   sin clasificar— es el mismo.
4. **`registrar_no_dictada` también clasifica canceladas.** Una cancelación también decide si se
   paga, así que la misma función le pone causa a una `cancelada` sin cambiarle el estado.
5. **`metricas_resumen` no se tocó.** La migración de PRD-0024 (20261105130000) también la
   redefine, y la que se aplique última ganaría. Solo usa "dictada" para `ultima_clase_at`.
   `metricas_finanzas` y `metricas_demanda` sí pasan a `estado = 'programada'`.
6. **`hoy_santiago()`**: una sola fuente para "¿terminó el mes?" y para la fecha del egreso. Permite
   probar el pago de un mes cerrado sin esperar a que se cierre.
7. **La clase de Pau del 03/11 queda clasificada** en la misma migración como
   `asistencia_insuficiente`, con la fecha de su cancelación (después de la hora). En una base sin
   esa clase no hace nada.

**Lo que no se puede saber sin producción**, y conviene correr en solo lectura antes de aplicar:
cuántas clases de parrilla de noviembre están `cancelada` sin causa. Esas bloquean el pago de su
profesora hasta que alguien las clasifique.

## 13. Preguntas para Felipe — contestadas el 04/11/2026

Las respuestas salen de `CONTEXT.md` §5.b ("Las cinco decisiones que destraban la liquidación" e
"Incentivo por promedio… en dos tramos"). **No las reconstruí de este PRD ni de la conversación.**

1. **¿Una clase de parrilla sin reservas se paga?** ✅ **Sí, la base**, como dictada, salvo que se
   marque no dictada.
   - Si se marca `sin_alumnas`, sigue la regla de la recuperación: si se recupera, se paga una sola
     vez en la recuperación; si no, la base.
   - Razón de Felipe: *"ella organizó su día en torno a esa clase y traer alumnas es trabajo de
     XO"*. Es la opción (c) con un matiz: `sin_alumnas` no recuperada **sí** paga la base. §6.6.
2. **¿Se paga la base cuando XO reorganiza la parrilla?** ✅ **No.**
   - `cambio_de_parrilla` no paga: esa clase nunca estuvo en su semana.
   - `sala_no_disponible` paga la base. `ausencia_profesora` queda y no paga.
   - Se suman `sin_alumnas` y `asistencia_insuficiente`. **Cinco valores**, y se agregan más si
     aparecen casos que no calcen.
3. **¿La tarifa de Isi es la general?** ✅ **Sí**: $18.000 la hora y $250 por crédito. La
   migración le agrega su fila a `costos_profesoras`.
4. **¿"Pasa al mes siguiente" es por profesora o por mes?** ⚠️ **No encontré la respuesta en
   `CONTEXT.md`.** Tomé la propuesta: la página muestra el mes más antiguo con algo pendiente, la
   profesora pagada sale de esa lista, y cuando se paga la última pasa sola al mes siguiente. Es
   pantalla (paso E), no cambia el modelo.
5. **¿La profesora ve su liquidación?** ✅ **Sí, solo la suya.** La regla 4 de PRD-0008 se reescribe
   como "ningún monto que no sea el suyo": **ADR-0008**. Sigue valiendo sin excepción: **nunca
   datos de contacto de una alumna**.
6. **¿Hubo especiales en octubre?** ✅ **Ya no importa**: octubre se pagó a mano y no se carga. Las
   especiales siguen fuera de alcance (§4.1); la liquidación de noviembre dice cuántas hubo para
   pagarlas aparte.
7. **¿Boleta de honorarios?** ✅ **Pendiente a propósito**, hasta el Inicio de Actividades. Mientras
   tanto **el sistema registra lo que se transfiere**. Lo tributario va a un PRD aparte, no acá.

**Y una que se suma, del incentivo:**

8. 🔴 **¿Se promedia con 3 cuando las clases no se dictaron por decisión de la academia?** Felipe
   lo nombró como posibilidad, no como regla. **No está implementado**: con menos de 4 dictadas no
   hay incentivo, sin excepción. Si se aprueba, son una condición y un test en `incentivoDeCurso()`.

**Lo que quedó sin decidir y no bloquea:** el tramo alto para Studio 98, el incentivo por 100% de
ocupación y el umbral relativo a la capacidad (§6.5).
