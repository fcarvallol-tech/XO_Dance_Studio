# ADR-0008 — La profesora ve su propia liquidación

| Campo | Valor |
|---|---|
| **Estado** | Aceptada · **reemplaza la regla 4 de PRD-0008 §6** |
| **Fecha** | 4 de noviembre de 2026 (decisión de Felipe) · escrito el 5 de noviembre |
| **Decide** | Felipe Carvallo |

## Contexto

PRD-0008 (portal de profesora, 02/09/2026) fijó cuatro reglas duras. La cuarta dice:

> 4. No ve ningún monto, en ninguna vista: ni precios, ni lo que pagó una alumna, ni su saldo de
>    clases.

Se escribió para que la profesora no viera **lo que pagan las alumnas** ni el negocio. Lo que no
existía entonces era la liquidación: el cálculo de cuánto se le debe a ella cada mes (PRD-0010
parte 3). Ese monto es **su** plata, no la de una alumna.

El 04/11/2026 Felipe decidió que la profesora ve su liquidación en su portal, solo la suya ("Las
cinco decisiones que destraban la liquidación", punto 4, `CONTEXT.md` §5.b). Eso contradice la
regla 4 tal como está escrita, y `CLAUDE.md` pide que una decisión tomada no se cambie en silencio.
Este ADR es ese registro.

## Opciones evaluadas

### Opción A — Mantener la regla 4: ningún monto

A favor:
- La regla queda simple y no hay que pensar qué montos sí.

En contra:
- **El error se encuentra tarde.** Si una clase quedó mal marcada, se descubre el día del pago,
  cuando la transferencia no calza, y ahí ya es un ajuste.
- **Carla sigue contestando** "¿cuánto me toca este mes?" por WhatsApp, cinco veces al mes.

### Opción B — Ve su liquidación, y nada más que eso

A favor:
- **El error se encuentra antes de pagar.** Si ve "no dictada" en una clase que dio, avisa y se
  corrige antes del día 1.
- Lo que ve es su propio trabajo, y no le da ninguna pista de lo que paga cada alumna.

En contra:
- **Va a reclamar lo que vea mal.** Es el objetivo, pero conviene que Carla lo sepa antes de
  abrirlo.
- Abre una puerta nueva a datos de la academia, y hay que cuidar exactamente qué pasa por ella.

## Decisión

**Opción B.** La regla 4 de PRD-0008 pasa a decir:

> 4. **No ve ningún monto que no sea el suyo.** Ve su liquidación —lo que la academia le debe o le
>    pagó a ella—, y nada más: ni precios, ni lo que pagó una alumna, ni el saldo de una alumna,
>    ni la liquidación de otra profesora, ni los costos de la academia.

**La regla 2 de PRD-0008 no cambia y no tiene excepción**: del listado de inscritas ve el nombre y
nada más. **Su liquidación no muestra ningún dato de una alumna, ni siquiera el nombre.** Ni RUT,
ni correo, ni teléfono, ni datos del apoderado.

## Razón

Esa regla protegía la plata **de las alumnas** y el negocio, y eso sigue protegido. Lo que se abre es
la cuenta de la profesora con la academia, que es suya. Y que ella la vea es la forma más barata de
encontrar un error antes de transferir y no después.

## Consecuencias

**Qué ve, por clase suya del mes:**

- fecha, curso, sede, estado y causa;
- cuántos créditos se consumieron, **como número**;
- base, variable, incentivo y total;
- si el mes está pagado, cuándo y cuánto;
- los ajustes, con su motivo.

**Qué no ve, y cómo se cierra:**

| No ve | Por qué no puede |
|---|---|
| Nombre, RUT, correo, teléfono o apoderado de una alumna | **La liquidación no lee `perfiles`.** Cuenta reservas por clase y no nombra a nadie |
| Precios o lo que pagó una alumna | El cálculo no los usa: el variable sale de **cuántos** créditos se consumieron, no de cuánto valían |
| Las liquidaciones de otra profesora | La función filtra adentro por la profesora de la sesión. **Se prueba con su sesión** |
| `comprobante_path`, quién pagó, el egreso | No están en el tipo de retorno de su función |
| `costo_hora_clp` de la sala o el costo de otra | Ídem |

**Cómo se implementa:**

- **Las tablas** `liquidaciones_profesoras` y `ajustes_liquidacion` **quedan con RLS de solo
  owner**. La profesora no las lee.
- **Lee por una función `security definer`** cuyo tipo de retorno **es** este contrato de columnas,
  filtrada adentro por `mi_profesora_id()`. RLS filtra filas, no columnas: abrirle la tabla con una
  política "solo lo suyo" le entregaría el comprobante y el detalle completo (`CLAUDE.md`).
- **La función tiene su grant escrito** a `authenticated`, y revocado a `public` y `anon`.
- **Admin**, que no tiene profesora asociada, recibe cero filas.

**Lo que se vuelve más difícil:** cada columna que se agregue a esa función se revisa contra esta
tabla. Si una columna nueva sale de `perfiles`, de `compras` o de `creditos`, está mal.

PRD-0008 queda con una nota en la regla 4 que apunta a este ADR. El texto original no se borra.

## Cuándo revisar

- **Si aparece un monto que dependa de una alumna en particular.** Por ejemplo, un variable
  distinto según el plan con que pagó. Ahí la liquidación empezaría a filtrar algo de la alumna.
- **Si las profesoras pasan a ser algo distinto de personas a honorarios**, con retención o
  contrato. Ahí lo que se le muestra tiene que calzar con un documento tributario, y eso va en el
  PRD de lo tributario.
