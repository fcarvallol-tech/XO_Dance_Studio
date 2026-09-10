# PRD-0009 — Portal de administración

| Campo | Valor |
|---|---|
| **Estado** | Borrador |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 4 |
| **Relacionados** | PRD-0008 · PRD-0010 · PRD-0018 (clases especiales: §8 de este PRD) |

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
9. ✅ **Solicitudes de horario: adelantado en PRD-0008** (02/09/2026). La bandeja para aprobar
   o rechazar con respuesta obligatoria vive en `/admin/solicitudes`, con los conflictos de
   sala y horario a la vista. Se adelantó porque sin ella una solicitud caía en un buzón que
   nadie abre. **Lo que sigue siendo de este PRD:** crear el bloque en la parrilla al aprobar,
   que toca cupos y el calendario de las alumnas.
10. **Clases especiales (PRD-0018), lo que se define desde acá:** el precio por defecto, la
    retención del cupo y la regla de pago de la profesora. Ver §8. El formulario de creación, la
    bandeja de reembolsos y la migración siguen en PRD-0018.

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

## 8. Clases especiales: parámetros y pago de la profesora

> Separado del PRD-0018 el 10/09/2026. Nada de esto cambia el esquema: son valores que owner
> carga en `parametros` y una regla que la liquidación (PRD-0010 parte 3) aplica. Se sacaron de
> la fase 0 de ese PRD para que la migración no espere a confirmaciones que no necesita.

### 8.1 Precio por defecto de una especial — `especial_precio_default_clp` · ✅ $12.000, confirmado el 10/09/2026

Lo que decidió Felipe (09/09/2026): owner fija el precio en cada clase; admin crea con un valor
por defecto que no puede tocar. Ese valor es una fila de `parametros` que **la migración del
PRD-0018 no inserta**, para no inventar un precio. Mientras no exista, admin no puede crear
especiales y owner tiene que escribir el precio a mano.

**$12.000**, confirmado por Felipe el 10/09/2026. Las razones de la propuesta, para el registro:

- Es más que la clase suelta de pack ($8.500), así que un admin que crea sin pensar en el precio
  no publica una especial más barata que la parrilla por accidente.
- Con la regla de §8.3, en Los Leones la academia cubre la sala desde la **segunda** alumna
  ($24.000 > $17.000) y en Diaguitas desde la primera.
- Es un número redondo que se puede decir en un Reel.

Entra en el alcance de §2.b (precios sin deploy): se edita desde el portal, y hasta que exista esa
pantalla, desde el Table Editor.

### 8.2 Retención del cupo — `especial_retencion_horas`

El mecanismo lo decidió Felipe y está en PRD-0018 §8.2: una reserva pendiente de pago ocupa cupo
hasta `min(declarada + retención, inicio − 2 h)`. El número **nace en 24 horas** con la
migración, como propuesta. Se edita acá, sin desplegar.

### 8.3 Pago de la profesora en una especial — ✅ decidido y confirmado

**Decidido por Felipe el 09/09/2026:** `variable = (recaudado − costo de sala) / 2`, entero CLP,
**$0 si el neto es negativo**. Se cuenta sobre compras `pagadas` de la clase, netas de reembolsos.

**Sin sueldo base por hora** en las especiales, confirmado por Felipe el 10/09/2026. Es la
diferencia con la parrilla (`CONTEXT.md` §5.b: $18.000/hora más $250 por crédito consumido): en
una especial la profesora cobra solo el variable.

**Por qué neto y no bruto**, con números. Precio $12.000, sala Los Leones $17.000:

| Alumnas | Recaudado | Regla **bruto** (50 % del recaudado, la academia paga la sala) | Regla **neto** (50 % de recaudado − sala) |
|---|---|---|---|
| 2 | $24.000 | Profesora $12.000 · Sala $17.000 · **Academia −$5.000** | Profesora $3.500 · Academia $3.500 |
| 3 | $36.000 | Profesora $18.000 · Sala $17.000 · Academia $1.000 | Profesora $9.500 · Academia $9.500 |
| 5 | $60.000 | Profesora $30.000 · Sala $17.000 · Academia $13.000 | Profesora $21.500 · Academia $21.500 |
| 10 | $120.000 | Profesora $60.000 · Sala $17.000 · Academia $43.000 | Profesora $51.500 · Academia $51.500 |
| 22 | $264.000 | Profesora $132.000 · Sala $17.000 · Academia $115.000 | Profesora $123.500 · Academia $123.500 |

Con la regla bruta la academia **pierde plata con dos alumnas** y gana $1.000 con tres. Con la
regla neta la sala se paga primero y lo que queda se parte igual: la academia nunca queda debajo
de la profesora, y las dos ganan lo mismo. En Diaguitas, con sala $0, las dos reglas coinciden.

**Caso borde:** si recaudado < sala (una alumna en Los Leones), el neto es negativo. La profesora
no debe plata: su variable es **$0** y la academia absorbe la pérdida. Es el caso que
`minimo_alumnas` (PRD-0018 §7.1) existe para evitar, aunque cancelar siga siendo decisión de una
persona.

**Dónde se implementa:** la función pura `variableEspecial(recaudado, costoSala)` con sus tests
(la tabla de arriba fila por fila, más recaudado < sala y sala $0) y la fila correspondiente en
`liquidaciones_profesoras` van con PRD-0010 parte 3. Coherente con §3 de este PRD: los montos los
ve solo owner.

**Sección cerrada el 10/09/2026.** Lo que queda es implementarla: owner carga el default en la
fase 7 del plan del PRD-0018 y `variableEspecial` va con PRD-0010 parte 3.

