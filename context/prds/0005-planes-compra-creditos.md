# PRD-0005 — Planes, compra de clases y créditos

| Campo | Valor |
|---|---|
| **Estado** | Borrador — **bloqueado por decisiones de negocio** |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 2 |
| **Relacionados** | PRD-0004 · PRD-0006 · ADR-0002 · ADR-0003 |

## 1. Problema

El negocio pasa a vender paquetes de clases por adelantado. Hoy no hay forma de cobrar en línea
ni de llevar cuenta de cuántas clases le quedan a cada persona.

## 2. Alcance

1. Catálogo de **planes** en base de datos (editable sin deploy): nombre, cantidad de clases,
   precio y vigencia. **Un solo nivel de precio, sin segmento.** Cuatro planes iniciales:

   | Plan | Precio |
   |---|---|
   | Clase suelta | $8.500 |
   | 2 clases | $16.000 |
   | 4 clases | $28.000 |
   | 8 clases | $48.000 |
2. Página de compra con los planes disponibles.
3. Integración con **Flow** (ADR-0003): checkout, webhook idempotente, acreditación en servidor.
4. **Créditos por lotes**, no un contador: cada compra genera un lote con su propia vigencia.
5. **Libro de movimientos** (`movimientos_credito`): compra, reserva, cancelación, expiración,
   ajuste manual. Nunca se edita, solo se agrega.
6. Comprobante de compra por email.
7. Vista del saldo en el portal de la alumna, con desglose de vencimientos.
8. Proceso de expiración de créditos vencidos (60 días).
9. **Otorgar créditos manualmente** desde admin u owner, con motivo obligatorio y autor
   registrado. Se crea un lote sin compra asociada y un movimiento tipo `regalo`.

## 3. Fuera de alcance

- Suscripción con cobro recurrente automático.
- Descuentos y códigos → PRD-0012 (promociones por período) y PRD-0013 (códigos). Ahí vive
  también el **descuento a universitarias**, que ya no es un segmento de precio.
- Códigos de referido. (Relacionado con el campo "afiliado" del perfil, todavía sin definir.)
- Reembolsos automáticos: en la v1 los hace un admin a mano y quedan como movimiento.
- Facturación electrónica al SII.

## 4. Casos borde

- **Pago aprobado pero el usuario cierra el navegador antes de volver.** El crédito debe
  acreditarse igual: la fuente de verdad es el webhook de la pasarela, no el retorno del browser.
- **Webhook duplicado.** Debe ser idempotente por referencia de transacción, o se acredita dos
  veces.
- **Pago rechazado o abandonado.** La compra queda `fallida` y no acredita nada.
- **Crédito vencido con reserva futura ya hecha.** La reserva sobrevive: el crédito se consumió
  al reservar, no al asistir.
- **Compra durante una caída de Supabase.** Hay que poder reconciliar contra la pasarela.

## 5. Reglas de negocio

0. **Un crédito sirve para cualquier clase de la parrilla.** No se asocia a un curso, ni al
   comprarlo ni al consumirlo. Es la regla que más barato sale respetar ahora y más caro
   revertir después: toca `planes`, `compras`, `creditos` y `reservas` a la vez.
1. Un crédito acreditado nunca se borra: se consume, se expira o se ajusta, y todo queda en el
   libro.
2. El saldo disponible se calcula desde los lotes vigentes, nunca se guarda como número suelto.
3. Al reservar se consume **primero el lote que vence antes**.
4. La acreditación ocurre en el servidor, disparada por el webhook, jamás desde el cliente.
5. Los precios se editan desde administración, nunca en código.
6. Un crédito otorgado a mano deja siempre rastro: quién, cuándo y por qué. Nunca se edita el
   saldo directamente.

## 6. ⚠️ Decisiones que bloquean este PRD

- ✅ Precios definidos: un solo nivel, definitivo el 25/08. Ver `CONTEXT.md` §5.b.
- ✅ Vigencia: **60 días**.
- ✅ Sin tarifa universitaria: el descuento va por código de descuento (PRD-0013).
- ✅ **Créditos universales (30/08/2026).** Simplifica este PRD: no hay que modelar
  compatibilidad entre plan y curso, ni validar al reservar que el crédito "sirva" para esa
  clase, ni explicar en la página de compra qué cubre cada pack. Un crédito es un crédito.
- ✅ Modelo híbrido resuelto (ADR-0002).
- ✅ Pasarela: **Flow** (ADR-0003). ⚠️ Inicio de Actividades **en curso**, falta la firma de Carla.
- ⚠️ Política de reembolso en dinero (distinta de devolver créditos).
- ⚠️ ¿Un mes con 5 clases se cobra distinto que uno con 4? (afecta a la rama de suscripción)

## 7. Criterios de aceptación

- [ ] Una compra pagada acredita exactamente la cantidad de clases del plan.
- [ ] Un webhook repetido no acredita dos veces.
- [ ] El saldo mostrado coincide siempre con la suma del libro de movimientos.
- [ ] Llega comprobante por email con detalle y vigencia.
- [ ] Un crédito vencido deja de estar disponible y queda registrado como expiración.
- [ ] Un crédito vence exactamente a los 60 días y queda registrado como expiración.
- [ ] Un admin puede regalar créditos y el movimiento queda con motivo y autor.
- [ ] Hay tests de la lógica de saldo, consumo y vencimiento.

## 8. Métrica de éxito

**Tasa de utilización de créditos ≥ 70%** a 60 días. Si la gente compra y no viene, la caja se
ve bien y el negocio se está vaciando por debajo.
