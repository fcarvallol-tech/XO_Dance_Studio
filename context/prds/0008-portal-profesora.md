# PRD-0008 — Portal de la profesora

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 4 |
| **Relacionados** | PRD-0004 · PRD-0009 |

## 1. Problema

Las profesoras necesitan saber qué clases tienen, quién viene y poder proponer horarios nuevos,
sin depender de que alguien se lo mande por WhatsApp.

## 2. Usuario

La profesora, casi siempre desde el teléfono, mirando la clase de hoy minutos antes de entrar a
la sala.

## 3. Alcance

1. **Mis cursos:** los cursos que dicta.
2. **Mis clases:** calendario propio, con el mismo patrón de filtro del calendario general.
3. **Listado de alumnas inscritas** por clase, con el conteo sobre el tope de 22.
4. **Solicitar horario:** formulario para pedir un bloque nuevo (día, hora, curso propuesto,
   mensaje). Va a la bandeja del administrador.
5. Estado de sus solicitudes: pendiente, aprobada o rechazada, con la respuesta.

## 4. Fuera de alcance

- Ver ingresos, precios o cualquier dato financiero. **Restricción explícita.**
- Tomar asistencia. Candidato a iteración siguiente; hoy no está en el alcance definido.
- Crear o cancelar clases por su cuenta: eso pasa por administración.
- Editar el listado de inscritas.

## 5. Casos borde

- **Reemplazo:** una profesora cubre la clase de otra. La clase tiene su propia `profesora_id`,
  que puede diferir de la del horario recurrente, y debe aparecer en el calendario de quien la
  dicta ese día.
- **Solicitud que choca con un horario existente** en la misma sala: se muestra el conflicto al
  administrador al momento de resolverla.
- Profesora que además es alumna: ve los dos portales sin mezclarlos.

## 6. Reglas de negocio

1. Una profesora ve solo sus clases y sus alumnas, nunca las de otra.
2. Del listado de inscritas ve nombre y poco más: **nunca RUT, dirección ni datos de contacto
   del apoderado**.
3. El tope de 22 se muestra siempre como contexto (por ejemplo, 14/22).

## 7. Criterios de aceptación

- [ ] Una profesora ve solo lo suyo, comprobado también por API directa.
- [ ] La lista de inscritas es legible en teléfono y muestra el conteo sobre 22.
- [ ] Una solicitud de horario llega a administración y su estado se refleja de vuelta.
- [ ] En ninguna vista aparece un monto.

## 8. Métrica de éxito

Que las profesoras dejen de preguntar por WhatsApp cuántas alumnas tienen ese día.
