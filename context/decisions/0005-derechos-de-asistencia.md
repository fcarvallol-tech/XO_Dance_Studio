# ADR-0005 — Abstraer el derecho a asistir (créditos, suscripción y freepass)

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 22 de agosto de 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

Al 22/08/2026 conviven **dos** formas de tener derecho a asistir a una clase:

1. **Créditos** comprados en packs (Girly, K-Pop).
2. **Suscripción mensual** con horario fijo (Teens).

Y hay una tercera en el horizonte: el **Freepass** quincenal o mensual —acceso ilimitado a
clases durante un período, como el de Power Peralta—, que se quiere agregar más adelante.

La pregunta no es si construir Freepass ahora. Es si el módulo de reservas se escribe amarrado
a los créditos o no.

## El problema si no se decide

Si `reservas` se escribe con la regla "reservar descuenta un crédito", entonces:

- La rama de Teens necesita una excepción, porque no consume créditos.
- El Freepass necesita otra excepción, porque tampoco.
- Cada excepción se cuela en la validación de cupo, en la cancelación, en la devolución y en las
  métricas.

Terminarían siendo tres caminos paralelos en el corazón del sistema, y el corazón del sistema es
justo donde un bug le cuesta plata a alguien.

## Decisión

**La reserva no consume un crédito: consume un `derecho_de_asistencia`.**

Se modela una abstracción con tres implementaciones:

| Tipo | Qué es | Al reservar |
|---|---|---|
| `credito` | Un crédito de un lote comprado | Descuenta uno |
| `suscripcion` | Suscripción activa a ese horario | No descuenta nada; valida vigencia |
| `freepass` | Pase con vigencia por período | No descuenta nada; valida vigencia |

`reservas` guarda `tipo_derecho` y la referencia correspondiente. La validación de cupo, la
cancelación y la devolución operan sobre la abstracción, no sobre el crédito.

**El Freepass no se construye ahora.** Solo se deja el hueco donde entra.

## Razón

El costo de dejar el hueco hoy es una columna y un `switch` con tres casos. El costo de no
dejarlo es reescribir el módulo de reservas cuando llegue el Freepass, con reservas reales en
producción y alumnas que dependen de que no se rompa.

## Por qué el Freepass se pospone, y no es solo por alcance

**No se puede poner precio a un Freepass sin saber cuántas clases va a tomar la gente.** Ese
número no existe todavía: XO no ha operado un solo mes con el modelo de packs. Ponerle precio
ahora es adivinar, y si se adivina bajo, cada alumna intensiva pasa a costar plata en vez de
generarla.

Con dos o tres meses de datos, la tasa de utilización de créditos da la respuesta directamente.
Ahí el precio se calcula en vez de inventarse.

Matiz a favor de agregarlo después: en Los Dominicos la sala cuesta $0, así que el costo marginal
de un asiento vacío es cero. Un Freepass que llene clases que igual se iban a dictar es negocio
puro. El riesgo aparece en Los Leones, y sobre todo si los freepass desplazan a alumnas que
habrían pagado por clase.

## Consecuencias

**Más fácil:** agregar Freepass después sin tocar el corazón de reservas. Y agregar cualquier
otra modalidad que aparezca —clases de cortesía, convenios con empresas— por el mismo camino.

**Más difícil:** una indirección más en el módulo más delicado del sistema. Se paga con tests.

**Consecuencia en métricas:** la ocupación de una clase deja de ser "créditos consumidos" y pasa
a ser reservas por tipo de derecho. El tablero del owner tiene que distinguirlos, o el margen por
clase queda mal calculado.

## Cuándo revisar

Cuando haya 2–3 meses de datos de utilización, se abre el PRD del Freepass con precio calculado.
