# ADR-0003 — Pasarela de pago

| Campo | Valor |
|---|---|
| **Estado** | **Aceptada** — Flow, 21/08/2026 |
| **Fecha** | 21 de agosto de 2026 |
| **Decide** | Felipe Carvalho |

## Contexto

El modelo de packs exige cobrar en línea desde la primera versión. La intención declarada es
ofrecer **Webpay** y varias alternativas relevantes.

**Requisito previo:** toda pasarela pide RUT de empresa con Inicio de Actividades. El trámite
está **en curso**; falta la firma de Carla. Es el camino crítico del cobro online y no depende
de programar.

## Nota sobre Fintual / Fintoc

Fintual es una plataforma de inversiones, no una pasarela de pago. La referencia era a **Fintoc**
(open banking, transferencia automatizada), confirmado el 21/08/2026. Queda como candidato para
más adelante, no para la v1.

## Opciones

| Opción | A favor | En contra |
|---|---|---|
| **Webpay / Transbank directo** | El estándar chileno, máxima confianza, débito Redcompra que es el medio dominante | Integración burocrática y lenta; onboarding pesado |
| **Flow** | **Agrega Webpay + tarjetas + Khipu en una sola integración**; alta pyme rápida | Comisión algo mayor que Transbank directo |
| **Mercado Pago** | Integración rápida, muy buena experiencia móvil, marca reconocida | Comisión más alta; percepción de "marketplace" |
| **Fintoc** | Transferencia automatizada, comisiones bajas, confirmación inmediata | Sin tarjetas; experiencia menos familiar |
| **Khipu** | Comisiones bajas, transferencia | Flujo con más fricción |

## Recomendación

**Una sola pasarela al lanzar, y que sea Flow.** Razón: entrega Webpay —que es lo que el público
chileno espera y lo que se pidió— sin pasar por el onboarding directo de Transbank, y de paso
suma tarjetas y transferencia en la misma integración.

Integrar tres pasarelas en la v1 triplica el trabajo, triplica los webhooks que hay que hacer
idempotentes y triplica la superficie donde se puede acreditar mal un crédito. Es exactamente el
lugar del sistema donde un bug le cuesta plata real a alguien.

**Alternativa de bajo costo mientras tanto:** aceptar transferencia bancaria con registro manual
del pago por admin. Permite operar desde el día uno sin depender del SII ni de la pasarela, y ya
está contemplado en el modelo (`pagos.medio = transferencia`).

## Decisión

**Flow, como única pasarela de la v1.**

Alcance de la integración: checkout de Flow, webhook de confirmación idempotente por referencia
de transacción, y acreditación de créditos en el servidor.

Fintoc y Mercado Pago quedan como candidatos posteriores. Agregar una segunda pasarela después
es barato si el módulo se diseña con la acreditación desacoplada del proveedor; hacerlo en
paralelo desde el día uno, no.

Mientras el Inicio de Actividades no esté listo, se opera con **transferencia bancaria y registro
manual del pago** por admin, que ya está contemplado en el modelo (`pagos.medio = transferencia`).

## Nota de implementación

Sea cual sea: **la fuente de verdad de un pago es el webhook, no el retorno del navegador**, y
la acreditación debe ser idempotente por referencia de transacción. Acreditar dos veces, o no
acreditar cuando la persona cerró la pestaña, son los dos errores clásicos y los más caros.
