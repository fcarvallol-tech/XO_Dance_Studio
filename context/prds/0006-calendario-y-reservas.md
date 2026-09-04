# PRD-0006 — Calendario de clases y reservas

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 3 |
| **Relacionados** | PRD-0005 (créditos) · PRD-0007 (gestión de reservas) |

## 1. Problema

Una vez que la alumna tiene créditos, necesita poder ver qué clases hay y tomar una. Hoy eso se
coordina por WhatsApp, uno a uno.

## 2. Usuario

La alumna, desde el teléfono, decidiendo a qué clase de esta semana va. Quiere ver rápido qué
hay, con quién, y reservar en dos toques.

## 3. Alcance

1. **Calendario** de clases programadas, vista semanal por defecto.
2. **Filtro por profesora**: al tocar el nombre de una profesora, sus clases ganan protagonismo
   (color sólido de marca, mayor peso visual) y las demás se atenúan sin desaparecer.
3. **Detalle de clase** con: profesora, hora de inicio y término, lugar, estilo, curso al que
   pertenece, y cupos disponibles.
4. Botón **Reservar** dentro del detalle.
5. Al reservar: se descuenta un crédito, se crea la reserva, se envía comprobante por email y se
   muestra confirmación en pantalla.
6. Generación de clases desde `horarios_recurrentes`.
7. Estado visual claro para clase llena y clase ya reservada por la alumna.

## 4. Fuera de alcance

- Lista de espera cuando la clase está llena. Candidato a iteración siguiente.
- Reserva recurrente ("todos los lunes").
- Vista mensual.
- Reservar para otra persona (salvo el caso de apoderado con dependientes, que depende de
  PRD-0004).

## 5. Casos borde — los que importan

- **Dos personas reservan el último cupo a la vez.** Con 22 cupos y campañas de Instagram esto
  va a pasar. El cupo se valida en base de datos, en transacción o con constraint. Nunca leyendo
  el conteo y escribiendo después.
- **Reservar sin créditos.** Se bloquea y se ofrece comprar.
- **Créditos que vencen antes de la clase.** El crédito se consume al reservar, así que la
  reserva es válida aunque el lote venza después.
- **Clase cancelada por XO.** Se devuelve el crédito a todas las reservas, siempre, sin importar
  la ventana de cancelación, y se avisa por email.
- **Clase que ya empezó.** No reservable.
- **Falla el email pero la reserva se creó.** La reserva vale. El comprobante se reintenta; no se
  revierte una reserva por un problema de correo.

## 6. Reglas de negocio

1. Una reserva confirmada por alumna y clase. Sin duplicados.
2. Tope duro de **22** reservas confirmadas por clase (capacidad de sala, confirmada el
   30/08/2026 en las dos sedes). El cupo es atributo de la **sala**, no del curso: depende del
   espacio físico.
3. Reserva y descuento de crédito son atómicos.
4. No se reserva en el pasado ni en clases canceladas.

## 7. Ventana de cancelación

**Definida: hasta 30 minutos antes del inicio de la clase**, devolviendo el crédito. Después de
ese momento se puede cancelar igual —libera el cupo— pero sin devolución.

⚠️ **Es una política muy generosa y conviene saber lo que implica.** El costo de la clase está
comprometido mucho antes de esos 30 minutos: la sala se paga y la profesora cobra sus $18.000
igual. Con 30 minutos, una clase puede pasar de 6 reservas a 2 sin que XO pueda hacer nada, y
esa clase se dicta a pérdida. Lo habitual en la industria son 6 a 12 horas, justamente para dar
tiempo a que otra persona tome el cupo.

Se implementa como está definido, pero el parámetro debe ser **configurable en base de datos**,
no una constante en el código, para poder ajustarlo sin desplegar.

## 8. Criterios de aceptación

- [ ] El calendario carga la semana en menos de 2 s en 4G.
- [ ] El filtro por profesora destaca sus clases y atenúa el resto sin ocultarlo, manteniendo
      legible el texto de las atenuadas.
- [ ] El detalle muestra los cinco datos: profesora, horario, lugar, estilo y curso.
- [ ] Reservar descuenta exactamente un crédito y llega el comprobante.
- [ ] Con 22 reservas la clase se muestra llena y no acepta más, ni siquiera con dos personas
      reservando simultáneamente.
- [ ] Cancelar a más de 30 minutos devuelve el crédito; a menos, no, y se avisa antes de
      confirmar.
- [ ] La ventana de cancelación es un parámetro configurable, no una constante.
- [ ] Hay test de concurrencia sobre el último cupo.

## 9. Métrica de éxito

**≥ 90% de las reservas se hacen desde la web** y no por WhatsApp, a 30 días de lanzado.

## 10. La clase cancelada que desaparecía (04/09/2026)

§5 de este PRD decía, desde agosto:

> **Clase cancelada por XO.** Se devuelve el crédito a todas las reservas, siempre, sin importar
> la ventana de cancelación, y se avisa por email.

**Nada de eso existía.** Había `cancelar_reserva` —la que usa la alumna para soltar su cupo— y
ninguna función para cancelar una clase. Cancelar significaba poner `estado = 'cancelada'` en el
Table Editor, que es como se hace hoy porque el portal de administración no existe. Eso dejaba:

| | Qué pasaba |
|---|---|
| La clase | fuera del calendario: RLS solo exponía `estado = 'programada'` |
| **La reserva** | **fuera también**, porque la consulta descartaba las reservas cuya clase no venía |
| El estado de la reserva | seguía en `confirmada`, como si la clase estuviera en pie |
| **El crédito** | **sin devolver** |
| La alumna | sin enterarse de nada |

A alguien que pagó le desaparecía de la pantalla una clase reservada, y se quedaba sin el crédito.
Que la clase se esfumara era el síntoma visible; **lo caro era el crédito**.

### El arreglo

**Un trigger, no solo una función.** Es la decisión que hace que esto sirva: mientras no exista el
portal de administración, cancelar se hace editando la fila a mano, y una función que hay que
acordarse de llamar no se llamaría nunca. Con `clases_al_cancelar`, la devolución ocurre **se
cancele como se cancele** — desde la función, desde el Table Editor o desde una consulta suelta.

Devuelve **siempre**, sin mirar la ventana de cancelación —la alumna no tuvo nada que ver— y **al
lote original**, para no estirarle el vencimiento por algo que canceló la academia. Es idempotente:
solo toca reservas que sigan `confirmada`.

`cancelar_clase(clase, actor, motivo)` queda para cuando exista la interfaz, y agrega lo que el
trigger no puede saber: que quien cancela sea admin, y **el motivo, que es obligatorio** porque la
alumna lo va a leer.

### Lo que ve ella

La reserva **aparece arriba, entre las próximas**, aunque figure como cancelada: es una noticia que
todavía no vio y que le cambia la semana. Tachada, con el motivo, y con el aviso de que le
devolvieron la clase a su saldo. Sin botón de cancelar, que ya no tiene nada que soltar.

En el historial se distingue **quién canceló**: "La cancelamos nosotras · clase devuelta" no es lo
mismo que "Cancelaste fuera de plazo", y antes las dos decían "Cancelada".

### ⚠️ Lo que sigue sin hacerse

**El correo.** Un trigger de base de datos no puede mandarlo, y la interfaz desde donde saldría no
existe. Por ahora ella se entera al entrar. Cuando llegue PRD-0009, cancelar desde el portal debe
además avisar por correo — `lib/correo.ts` ya tiene dónde colgarlo.

### ⚠️ Sin probar con datos

Al escribir esto había **0 reservas** en la base, así que el flujo completo —reservar, cancelar la
clase, ver el crédito de vuelta— no se pudo reproducir con datos reales. Conviene hacerlo con la
primera reserva de verdad, o con una de prueba, antes de confiar en él. Es el mismo pendiente que
ya arrastra la política `reservas_de_mis_clases`.
