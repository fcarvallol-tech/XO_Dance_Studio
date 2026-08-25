# PRD-0013 — Códigos de descuento

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 22 de agosto de 2026 |
| **Hito** | Hito 2 (posterior a PRD-0005 y 0012) |
| **Relacionados** | PRD-0012 (promociones) · PRD-0005 (compras) |

## 1. Problema

XO quiere repartir descuentos por canales que no son la web: flyers impresos, el Open Day,
campañas de temporada, y un incentivo para quien compra por primera vez. Un precio promocional
general no sirve para eso: se necesita un descuento que solo obtiene quien tiene el código.

## 2. Tipos de código

| Tipo | Cómo funciona | Caso de uso |
|---|---|---|
| **Un solo uso** | Se generan en lote, cada uno sirve una vez y queda quemado | Flyers impresos, Open Day |
| **Primera compra** | Un código compartido, válido solo si la persona no tiene compras pagadas previas | Captación de alumnas nuevas |
| **Estacional** | Un código compartido con fecha de término y tope opcional de usos | Campañas de temporada |
| **Universitaria** | Un código compartido que se reparte por los canales donde están ellas: universidades, federaciones, el Instagram de la academia | **Descuento a universitarias** |

### El descuento universitario es un código, no un segmento de precio

Hasta el 25/08/2026 el descuento a universitarias era un **segundo nivel de precios** que se
desbloqueaba subiendo un certificado de alumno regular que un admin aprobaba. Eso salió del
modelo (ver `CONTEXT.md` §5.b): significaba tres columnas en `perfiles`, un flujo de aprobación,
un bucket privado para un documento personal de una menor o de una alumna, y una verificación que
caduca cada semestre. Todo eso para un descuento.

Como código no cuesta nada nuevo: es el mismo mecanismo que ya hay que construir para los flyers.
**No se verifica que quien lo usa sea universitaria**, y es deliberado, con el mismo criterio con
que se decidió no controlar el abuso del código de primera compra: el control sale más caro que
la pérdida. El descuento llega a quien recibe el código, y el canal por donde se reparte es el
filtro.

Las tres dimensiones son **independientes y combinables**: vigencia por fechas, tope de usos
(global y por persona), y condición sobre quién puede usarlo. Un código de un solo uso es
simplemente uno con tope global de 1.

## 3. Alcance

1. Tabla `codigos_descuento`: código, tipo de descuento (% o monto fijo), valor, vigencia desde
   y hasta, usos máximos globales, usos máximos por persona, condición (`ninguna` |
   `primera_compra`), planes aplicables, lote, activo.
2. Tabla `usos_codigo`: código, perfil, compra, fecha. Es el registro que impide reutilizar.
3. **Generación en lote**: crear N códigos únicos de una vez y exportarlos para imprimir.
4. Validación del código en el checkout, con mensaje claro cuando no aplica y por qué.
5. Administración **exclusiva del rol `owner`**.
6. Reporte por código y por lote: usos, ingreso generado, descuento entregado.

## 4. Fuera de alcance

- Códigos de referido entre alumnas. Relacionado con el campo "afiliado", todavía sin definir.
- Envío automático de códigos por email.
- Descuentos aplicados a suscripciones de Teens (v1: solo packs).

## 5. Casos borde — los que importan

- **Dos personas usan el último uso del mismo código a la vez.** Mismo problema que el último
  cupo de una clase: se valida en base de datos, con constraint o transacción, no leyendo el
  contador y escribiendo después.
- **Código aplicado y checkout abandonado.** El uso **no** se registra hasta que el pago se
  confirma por webhook. Si no, un carrito abandonado quema un código para siempre.
- **Abuso del código de primera compra.** Como el login es con Google y crear cuentas nuevas es
  gratis, alguien puede reusarlo con otro correo. **Decisión tomada el 22/08/2026: no se
  controla.** El monto en juego es de unos pocos miles de pesos por caso y el costo de un control
  serio —pedir RUT, verificar teléfono— es mayor que la pérdida esperada, además de agregar
  fricción justo en el momento de comprar. La condición se valida solo contra el perfil: si esa
  cuenta no tiene compras pagadas previas, el código aplica.
  Lo que sí se hace es **dejarlo visible**: el reporte por lote permite detectar un patrón raro
  si alguna vez ocurre. Detectar barato antes que prevenir caro.
- **Código sobre precio promocional.** ¿Se acumulan? Recomendación: **no** por defecto, con un
  flag `acumulable` por código para casos puntuales. Sin regla explícita, un pack de 4 puede
  terminar en $12.000 sin que nadie lo haya decidido.
- **Código que deja el total en cero.** Debe funcionar sin pasar por la pasarela, o bloquearse.
  Definir.
- **Mayúsculas y espacios.** Se normaliza: `xo lanzamiento` y `XO-LANZAMIENTO` son el mismo.

## 6. Reglas de negocio

1. El descuento se calcula **siempre en el servidor**. El cliente nunca manda un monto.
2. Un uso se registra solo con el pago confirmado.
3. `compras` guarda qué código se usó y cuánto descontó.
4. Solo `owner` crea, edita, desactiva o genera lotes.
5. Un código nunca se borra: se desactiva, para que su historial siga siendo legible.

## 7. Criterios de aceptación

- [ ] Un código de un solo uso funciona una vez y después es rechazado con mensaje claro.
- [ ] Dos usos simultáneos del último cupo de un código: solo uno pasa.
- [ ] El código de primera compra se rechaza para alguien con una compra pagada previa.
- [ ] Un código vencido se rechaza indicando que expiró.
- [ ] Abandonar el checkout no quema el código.
- [ ] Se pueden generar 500 códigos únicos y exportarlos.
- [ ] Un `admin` no accede a la administración de códigos.
- [ ] Cada compra registra código y descuento aplicado.

## 8. Métrica de éxito

Poder decir, por lote: cuántos códigos se repartieron, cuántos se usaron, y cuánto ingreso trajo
cada canal. Es la única forma de saber si los flyers sirven.
