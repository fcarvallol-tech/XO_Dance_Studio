# PRD-0009 — Portal de administración

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 4 |
| **Relacionados** | PRD-0008 · PRD-0010 |

## 1. Problema

Alguien tiene que crear los cursos, dar de alta a las profesoras, armar el calendario, mirar
quién está inscrita y resolver las solicitudes. Hoy eso es Felipe con planillas y memoria.

## 2. Alcance

1. **Profesoras:** crear, editar y desactivar perfiles; asignar rol y cursos. **Requisito
   explícito:** se crean desde la página, sin tocar código ni desplegar.
2. **Cursos:** crear, editar y desactivar; asociar profesoras. Mismo requisito.
2.b **Planes y precios:** editar precios y activar/desactivar planes sin deploy.
3. **Horarios y clases:** definir horarios recurrentes, generar clases, cancelar una clase
   puntual con motivo, asignar reemplazo.
4. **Calendario general:** todas las clases, todas las profesoras, con el filtro por profesora.
5. **Alumnas vigentes:** listado con búsqueda, saldo de créditos y última actividad.
6. **Reservas:** todas, con filtros por clase, fecha y alumna; cancelar una reserva a nombre de
   alguien.
7. **Solicitudes de horario:** bandeja con aprobar o rechazar y respuesta escrita.
8. **Otorgar créditos** a una alumna, con motivo obligatorio. Disponible para admin y owner.

## 2.b Datos iniciales

Los cinco cursos y las cinco profesoras que hoy viven en `lib/cursos.ts` y `lib/profesoras.ts`
se cargan como **seed editable**, no como valores fijos. La oferta ya cambió una vez y va a
volver a cambiar: el sistema tiene que asumir que el catálogo es data, no configuración.

## 3. Fuera de alcance

- Métricas y finanzas → PRD-0010, solo para `owner`.
- Editar el saldo de créditos directamente: **otorgar** créditos sí se puede, pero siempre como
  un movimiento con motivo y autor, nunca sobrescribiendo un número.
- Carga masiva desde Excel.

## 4. Casos borde

- **Cancelar una clase con reservas.** Devuelve el crédito a todas y notifica. Nunca en silencio.
- **Desactivar una profesora con clases futuras.** Bloquear hasta reasignar o cancelar esas
  clases.
- **Editar un horario recurrente.** No debe alterar clases pasadas ni reservas ya hechas: los
  cambios aplican de aquí en adelante.
- **Cambiar la capacidad de una sala por debajo de las reservas existentes.** Advertir y no
  expulsar a nadie automáticamente.

## 5. Reglas de negocio

1. Toda acción de admin que toque créditos o reservas ajenas queda registrada con autor y motivo.
2. Nada se borra físicamente.
3. El tope de 22 es del sistema: ninguna operación de admin lo supera sin confirmación explícita
   registrada.

## 6. Criterios de aceptación

- [ ] Se puede crear una profesora, un curso y un horario recurrente, y aparecen clases en el
      calendario.
- [ ] Cancelar una clase devuelve créditos y notifica a las inscritas.
- [ ] Toda alumna es encontrable por nombre o correo en menos de dos pasos.
- [ ] Una solicitud de horario se resuelve y la profesora ve la respuesta.
- [ ] Un admin puede otorgar créditos y queda registrado quién, cuándo y por qué.
- [ ] Se puede crear una profesora y un curso nuevos sin escribir código ni desplegar.
- [ ] Los cursos y profesoras actuales aparecen precargados y son editables.
- [ ] Ninguna vista de admin expone montos si el usuario no es `owner`.

## 7. Métrica de éxito

Que armar la programación de la semana tome menos de 15 minutos y no requiera abrir ninguna
planilla.
