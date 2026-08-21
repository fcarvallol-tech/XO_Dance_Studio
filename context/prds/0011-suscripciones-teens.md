# PRD-0011 — Suscripción mensual (XO Teens)

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 2 |
| **Relacionados** | ADR-0002 · PRD-0005 (packs) · PRD-0004 (cuentas) |

## 1. Problema

XO Teens no se vende por packs: es horario fijo, compromiso mensual y la mamá paga. Meterlo en
el modelo de créditos sería pedirle a una apoderada que reserve la clase de su hija todas las
semanas. El precio sí baja a la tarifa de packs ($30.000 por 4 clases), pero con las salas
nuevas el negocio queda igual o mejor y la profesora pasa a cobrar. Ver `CONTEXT.md` §5.b.

Es la rama del modelo híbrido que sostiene la caja recurrente del negocio.

## 2. Usuario

La mamá de una alumna de 11 a 15 años. Quiere que su hija tenga su clase el mismo día siempre,
pagar una vez al mes y no pensar más en el tema.

## 3. Alcance

1. **Suscripción**: alumna + curso + horario recurrente + precio mensual + estado.
2. La suscripción se asocia al **perfil del apoderado**, con la alumna como dato del registro.
3. **Cargos mensuales** generados por proceso, con vencimiento.
4. Registro de pago (manual en la v1) y estado de cuenta visible para el apoderado.
5. Pausar, retomar y dar de baja una suscripción, con motivo.
6. Vista de la lista de alumnas suscritas por horario, para la profesora y para administración.

## 4. Fuera de alcance

- **Cobro recurrente automático con la pasarela.** Complejidad alta para pocas alumnas. En la v1
  el pago se registra a mano y se manda recordatorio. Revisar cuando el volumen lo justifique.
- Reserva de clases: una alumna suscrita no reserva, tiene su horario.
- Prorrateo por ingreso a mitad de mes: se resuelve a mano como ajuste.

## 5. Casos borde

- **Alumna suscrita que quiere ir a otra clase** (una de Girly, o su mismo curso otro día).
  ⚠️ Sin definir: ¿se le permite? ¿compra un pack aparte? Decisión de negocio pendiente.
- **Hermanas.** Un apoderado con dos alumnas: dos suscripciones, un pagador. Debe verse claro.
- **Cumple 16 años.** ¿Pasa a Girly y por lo tanto a packs? Definir el traspaso.
- **Mes con clase cancelada por XO.** ¿Se recupera, se descuenta o no pasa nada? Definir.
- **Deja de pagar pero sigue asistiendo.** Necesita quedar visible en administración.

## 6. Reglas de negocio

1. Un cargo generado no se borra: se paga, se condona con motivo o queda vencido.
2. Dar de baja no elimina historial.
3. La profesora ve la lista de alumnas suscritas a su horario, sin montos.
4. Los datos de la menor (nombre, edad) nunca aparecen en rutas públicas ni en logs.

## 7. ⚠️ Decisiones pendientes

- ✅ **Precio definido:** el mismo de los packs. 4 clases al mes = $30.000. Teens deja los
  $45.000.
- ⚠️ ¿Un mes con 5 clases se cobra distinto que uno con 4?
- ¿Cobro automático o manual? (define si la pasarela necesita soportar suscripciones)
- ¿Puede una alumna de Teens comprar packs de otros cursos?
- Qué pasa al cumplir 16.

## 8. Criterios de aceptación

- [ ] Se puede crear una suscripción para una alumna en un horario y queda visible en la lista.
- [ ] El proceso mensual genera un cargo por suscripción activa, con vencimiento.
- [ ] Registrar un pago deja el cargo en `pagado` y actualiza el estado de cuenta.
- [ ] Pausar y dar de baja conservan el historial y piden motivo.
- [ ] Un apoderado con dos hijas ve ambas suscripciones separadas y su cuenta consolidada.
- [ ] La profesora ve la lista sin ningún monto.

## 9. Métrica de éxito

**Retención mensual ≥ 85%** en Teens, que es el KR de Fase 1 del negocio, medida desde el
sistema y no a mano.
