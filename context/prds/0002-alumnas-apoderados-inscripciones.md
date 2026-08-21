# PRD-0002 — Alumnas, apoderados e inscripciones

| Campo | Valor |
|---|---|
| **Estado** | **Descartado** — reemplazado por PRD-0004 y PRD-0005 |
| **Autor** | Felipe Carvalho |
| **Fecha** | Agosto 2026 |
| **Hito** | Hito 1 — Núcleo operacional |
| **PRDs relacionados** | PRD-0001 (leads) · PRD futuro de mensualidades |

> ⚠️ **Descartado el 21/08/2026.** El negocio pasó de inscripción con mensualidad a paquetes de
> clases con reserva por horario, así que la entidad `inscripciones` deja de existir tal como
> está descrita acá. Lo que sigue vigente —modelar a la alumna y a quien paga por ella, la
> autorización de imagen, el trato de datos sensibles— se trasladó a PRD-0004 (cuentas) y
> PRD-0005 (compras). Se conserva el documento sin editar el resto: un PRD descartado vale
> tanto como uno implementado, porque evita que alguien reproponga lo mismo en tres meses.

---

## 1. Problema

Hoy no existe un registro estructurado de quién es alumna, quién es su apoderado, en qué curso
está, desde cuándo y cuánto paga. Esa información vive repartida entre la memoria de Felipe,
chats de WhatsApp y una planilla. Con 8 alumnas se sostiene; con 30 y cinco profesoras, no.

Sin esta base, nada de lo que viene después es posible: no se pueden generar mensualidades sin
inscripciones, ni tomar asistencia sin lista de curso, ni calcular retención sin fechas de alta
y de retiro.

## 2. Usuario y contexto de uso

**Felipe (admin)**, desde el computador, dando de alta alumnas después de una clase de prueba o
del Open Day. En el Open Day puede tener que registrar varias seguidas en poco rato, así que el
formulario tiene que ser rápido y tolerar datos incompletos.

**Profesoras**, desde el teléfono, consultando la lista de su sección. Solo lectura, sin datos
de plata.

## 3. Alcance

1. CRUD de **apoderados**: nombre, RUT, email, WhatsApp, dirección, comuna.
2. CRUD de **alumnas**: nombre, RUT, fecha de nacimiento, apoderado, colegio, observaciones
   médicas, autorización de uso de imagen, estado.
3. **Ficha de alumna**: datos, inscripciones actuales e históricas, apoderado, y espacio
   reservado para asistencia y pagos (que llegan en hitos posteriores).
4. CRUD de **inscripciones**: alumna × sección, fecha de inicio, precio acordado, estado.
5. Acciones sobre inscripción: **pausar**, **retirar** (con motivo), **reactivar**.
6. **Listado de alumnas** con filtros por curso, sección, estado y búsqueda por nombre o RUT.
7. **Lista de sección**: quiénes están inscritas en una sección concreta, con cupo usado/total.
8. **Conversión desde lead**: desde un lead se crea apoderado + alumna + inscripción con los
   datos ya cargados, y el lead pasa a `convertido` quedando vinculado.

## 4. Fuera de alcance

- Generación y cobro de mensualidades → hito 2. Acá solo se guarda el `precio_acordado_clp`.
- Toma de asistencia → hito 3.
- Portal de apoderados → hito 4.
- Carga masiva desde Excel. Con 30 alumnas se cargan a mano; si algún día son 300, se evalúa.
- Firma digital de autorizaciones. Por ahora se registra el flag y la fecha; el papel firmado
  se guarda como archivo adjunto.

## 5. Flujo principal

**Alta desde clase de prueba (el camino más frecuente):**

1. Felipe abre el lead en `/erp/leads` y toca "Convertir a alumna".
2. El formulario aparece precargado con nombre de alumna, edad, WhatsApp y curso de interés.
3. Completa lo que falta del apoderado (RUT, email) y de la alumna (fecha de nacimiento, colegio).
4. Marca si hay autorización de uso de imagen.
5. Elige la sección concreta y confirma el precio (sugerido: el de la sección; editable).
6. Guarda. Se crean apoderado, alumna e inscripción activa; el lead queda `convertido`.

**Alta directa:** `/erp/alumnas/nueva`, mismo formulario sin precarga, con opción de elegir un
apoderado existente (caso hermanas) o crear uno nuevo.

## 6. Casos borde y errores

- **Hermanas:** un apoderado con varias alumnas. El buscador de apoderado debe permitir
  reutilizar uno existente sin duplicarlo.
- **RUT duplicado:** advertir y ofrecer abrir la ficha existente, no crear un registro nuevo.
- **Alumna mayor de 18:** puede ser su propio apoderado. El formulario lo permite sin obligar
  a inventar un tercero.
- **Sin RUT al momento del alta:** se permite guardar. El RUT es requerido para facturar, no
  para inscribir. Queda marcado como dato incompleto.
- **Cupo lleno:** advertencia explícita, permitir sobrecupo con confirmación y dejarlo registrado.
- **Edad fuera del rango del curso:** advertencia, no bloqueo. Se registra la excepción.
- **Doble inscripción activa en la misma sección:** bloqueado.
- **Retiro:** la inscripción pasa a `retirada` con fecha y motivo. **No se borra nada.**

## 7. Modelo de datos

Ver `ARCHITECTURE.md` §2.2 para el detalle de `apoderados`, `alumnas` e `inscripciones`.

Puntos específicos de este PRD:

- `alumnas.observaciones_medicas` es dato sensible: no aparece en listados ni exportaciones,
  solo en la ficha, y solo para rol `admin`.
- `alumnas.autoriza_uso_imagen` es `boolean not null default false`. **Nunca asumir `true`.**
- `inscripciones.precio_acordado_clp` se copia desde `secciones.precio_mensual_clp` al crear,
  pero queda independiente: cambiar el precio de lista no altera inscripciones existentes.
- `leads.alumna_id` se llena al convertir.
- Borrado lógico en las tres tablas.

## 8. Reglas de negocio

1. Toda alumna menor de 18 debe tener apoderado asignado. Sin excepción.
2. No se permiten dos inscripciones activas de la misma alumna en la misma sección.
3. El sobrecupo requiere confirmación explícita y queda registrado.
4. El retiro nunca borra historial.
5. La autorización de uso de imagen es opt-in explícito, con fecha.
6. Las profesoras ven la lista de sus secciones; no ven RUT, dirección, precio ni observaciones
   médicas.

## 9. Criterios de aceptación

- [ ] Se puede crear un apoderado con una o más alumnas asociadas.
- [ ] Se puede inscribir una alumna en una sección y aparece de inmediato en la lista de esa sección.
- [ ] El contador de cupo (inscritas/total) se actualiza correctamente.
- [ ] Inscribir sobre cupo exige confirmación y queda registrado.
- [ ] Un lead se convierte en alumna sin retipear ningún dato ya capturado.
- [ ] Retirar una inscripción conserva el registro histórico y pide motivo.
- [ ] Una profesora autenticada ve solo sus secciones y no ve campos sensibles.
- [ ] RLS activo: ninguna consulta sin autenticar devuelve datos de alumnas.
- [ ] Búsqueda por nombre y por RUT funciona con RUT escrito con o sin puntos.

## 10. Métrica de éxito

**El 100% de las alumnas activas están en el sistema y la planilla deja de usarse** dentro de
las dos semanas siguientes al despliegue.

## 11. Riesgos y supuestos

- Se asume que las secciones ya existen en base de datos. Si el módulo de catálogo (1.1) no está
  listo, este PRD queda bloqueado.
- Riesgo de sobre-diseñar el formulario: si registrar una alumna toma más de dos minutos,
  Felipe va a volver a la planilla y el ERP muere ahí.
- Los datos actuales de las 8 alumnas pueden estar incompletos. Hay que permitir cargar fichas
  parciales sin pelear con validaciones.

## 12. Notas de implementación

_(Completar al cerrar)_
