# PRD-0012 — Precios promocionales por período

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 22 de agosto de 2026 |
| **Hito** | Hito 2 |
| **Relacionados** | PRD-0005 (planes y compras) · PRD-0013 (códigos) |

## 1. Problema

Los precios de lista son fijos, pero el negocio necesita bajarlos por períodos acotados. El caso
concreto e inmediato: para el lanzamiento, dejar el pack de 4 en **$20.000** (lista: $30.000) y
el de 8 en **$36.000** (lista: $52.000).

Hoy eso solo se puede hacer editando el precio del plan, lo que borra el precio de lista y
obliga a acordarse de revertirlo a mano. Nadie se acuerda.

## 2. Alcance

1. Tabla de **precios promocionales**: plan, precio promocional, fecha de inicio, fecha de
   término, nombre de la promoción, activa.
2. El precio vigente se resuelve al momento de comprar: si hay promoción activa para ese plan y
   segmento, manda ella; si no, el precio de lista.
3. En la página de compra, el plan muestra el precio promocional con el de lista tachado y el
   período de validez.
4. Administración de promociones **exclusiva del rol `owner`**.
5. Una promoción se puede programar a futuro y termina sola. Sin intervención manual.

## 3. Fuera de alcance

- Códigos de descuento → PRD-0013. Son otro mecanismo.
- Descuentos por volumen automáticos: eso ya está en la escalera de packs.
- Promociones dirigidas a una persona específica.

## 4. Casos borde

- **Dos promociones que se solapan** para el mismo plan. Regla: gana la de menor precio, y la
  interfaz de owner avisa del solapamiento al crearla.
- **Promoción que termina mientras alguien está pagando.** El precio se congela al iniciar la
  compra: si el checkout se abrió con $20.000, se cobra $20.000 aunque la promo termine en el
  intertanto. Lo contrario es una estafa involuntaria.
- **Cambiar el precio de lista con una promo activa.** No afecta a la promo vigente.
- **Compras pasadas.** El precio pagado vive en `compras.monto_clp` y **nunca** se recalcula. Una
  promo posterior no cambia lo que alguien ya pagó.

## 5. Reglas de negocio

1. El precio efectivo se resuelve **en el servidor** al crear la compra, nunca se acepta un
   precio enviado por el cliente.
2. `compras.monto_clp` guarda lo efectivamente cobrado y `compras.promocion_id` cuál se aplicó.
   Sin eso no se puede medir cuánto costó la promoción.
3. Solo `owner` crea, edita o desactiva promociones.
4. Las promociones se registran con autor y fecha.

## 6. Criterios de aceptación

- [ ] Owner crea una promoción con fechas y el precio cambia solo al llegar la fecha de inicio.
- [ ] La promoción termina sola en la fecha de término, sin tocar nada.
- [ ] La página de compra muestra precio promocional, precio de lista tachado y vigencia.
- [ ] Una compra registra qué promoción se aplicó.
- [ ] Un `admin` no puede acceder a la administración de promociones.
- [ ] Cambiar el precio de lista no altera una promoción vigente.

## 7. Métrica de éxito

Poder responder, para cada promoción: cuántas compras generó, cuánto ingreso, y cuánto se dejó
de cobrar respecto del precio de lista. Sin eso, una promoción es una corazonada.
