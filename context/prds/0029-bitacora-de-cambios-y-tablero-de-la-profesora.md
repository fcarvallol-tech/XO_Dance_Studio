# PRD-0029 — Bitácora de cambios de la profesora y su tablero de desempeño

| Campo | Valor |
|---|---|
| **Estado** | **Borrador — anotado para más adelante.** No se implementa. Pedido de Felipe el 06/11/2026 |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 6 de noviembre de 2026 |
| **Hito** | Hito 4 — Portales (profesora) |
| **PRDs relacionados** | PRD-0021 (asistencia y capacidad: la columna existe) · PRD-0010 parte 3 (el incentivo, que mide otra cosa — ver §4.3) · PRD-0008 (roles y la regla de datos de contacto) · PRD-0028 (comentarios de las alumnas, la otra mitad de la misma pregunta) |

---

## 1. Problema

**Una de las cinco profesoras retiene mucho mejor que las otras y no sabemos por qué.** Felipe
empezó a probarlo a mano el 06/11/2026: le pidió a una profesora que agregara una dinámica a su
clase para ver si cambiaba algo.

El problema no es la idea de probar: es que **hoy no queda registro de qué se probó ni de qué pasó
después.** Dentro de dos meses nadie va a poder decir si la dinámica de noviembre sirvió, porque no
está escrito qué se hizo, cuándo empezó, cuándo terminó, ni con qué números se comparó.

Y la profesora, que es quien hace el cambio, es la que menos información tiene: ve a las alumnas que
tiene enfrente y nada más.

## 2. 🔴 Lo que esto puede y no puede entregar. Leer antes de diseñar.

Felipe pidió que **"quede prueba irrefutable de que los cambios que hace funcionan o no
funcionan"**. Hay que decirlo derecho: **con el tamaño actual de XO eso no se puede.**

Los números: 74 alumnas, 5 profesoras, unas 4 clases por curso al mes. Una profesora que agrega una
dinámica y ve subir la recurrencia de 8 a 11 alumnas no probó nada — ese movimiento cabe entero
dentro del ruido normal de una semana. Y noviembre de 2026 es el peor mes posible para medir: se
lanzó el sitio, cambiaron los precios, la capacidad de Los Leones bajó de 18 a 16, se canceló una
clase y se devolvieron créditos. Cualquier cambio de los números tiene cinco explicaciones antes de
llegar a la dinámica.

**Lo que esto sí entrega, y vale la pena por sí solo:**

- **Memoria.** Qué se probó, en qué curso, desde cuándo y hasta cuándo. Hoy eso vive en la cabeza
  de Felipe y en un mensaje de WhatsApp.
- **Las preguntas correctas.** Una curva con el período marcado encima no prueba la causa, pero
  muestra dónde mirar y qué preguntarle a la profesora.
- **Un patrón repetido.** Si la misma dinámica se prueba en tres cursos distintos y en los tres la
  recurrencia sube, eso ya no es ruido. **Ahí está el valor real, y llega por repetición, no por un
  tablero.**
- **Que la profesora vea sus propios números**, que es lo que de verdad cambia comportamiento.

**El riesgo de no decir esto en la pantalla:** un tablero que muestra una flecha verde al lado de
"dinámica activa" va a producir conclusiones seguras y equivocadas, y decisiones de plata tomadas
sobre ellas. La pantalla tiene que decir cuántas clases y cuántas alumnas hay detrás de cada
número, y callarse cuando son pocas.

## 3. Paso cero: hoy no se marca la asistencia

`reservas.estado` acepta `asistio` y `no_asistio`, pero **en todo el código esos valores solo se
leen, nunca se escriben.** No hay pantalla, acción ni función que los ponga.

Consecuencia: todo lo que el sistema sabe hoy es **quién reservó**. Si el tablero se construye sobre
eso, va a medir intención y no presencia — y la pregunta de Felipe es sobre quién *vino*. La
diferencia no es menor: una alumna que reserva y no llega igual le paga su variable a la profesora,
así que el sistema no tiene hoy ninguna señal de ausencia.

**Entonces lo primero de este PRD es que la profesora marque la asistencia**, desde su clase, en el
teléfono, en la sala. Es chico y es la condición de todo lo demás. Sin eso, el resto se construye
sobre el dato equivocado.

## 4. Alcance

### 4.1. Marcar asistencia

En la pantalla de su clase, la profesora marca quién vino. Lista de inscritas, un toque por alumna,
y listo. Debe funcionar bien con el teléfono en la mano y sin buena señal.

Decidir en la revisión: hasta cuándo se puede marcar o corregir (propuesta: 48 horas), y qué pasa
con las clases que nadie marcó —propuesta: quedan sin dato, **nunca se asume que todas vinieron**,
porque un supuesto cómodo contamina para siempre la serie—.

### 4.2. La bitácora de cambios

La profesora escribe el cambio que está probando. Campos:

- **Qué cambió.** Texto libre, en sus palabras.
- **En qué curso.** Uno de los suyos.
- **Desde cuándo** y **hasta cuándo** (vacío mientras esté corriendo).
- **Estado:** `activo` o `terminado`. Pedido explícito de Felipe.
- **Cómo resultó.** Una nota al cerrarlo, escrita por ella.

Esa última es la que hace que la bitácora sirva: sin el cierre, queda una lista de intentos sin
desenlace. Y el rango de fechas es lo que permite marcar el período sobre la curva.

### 4.3. El tablero

**La métrica central es la que Felipe describió con sus propias palabras:** de las alumnas que
vinieron a una clase, cuántas volvieron a una clase de ese curso dentro de los siguientes N días
(propuesta: 14, dos semanas, que cubre la semana siguiente y un resbalón).

Eso es una **tasa de retorno por cohorte de clase**, y tiene una virtud que ninguna otra métrica
tiene acá: **es lo más cercano a lo que la profesora sí controla.** Cuántas llegan depende de
Instagram, del horario, de la sala, del precio y del mes. Que las que llegaron vuelvan, depende
bastante más de la hora que pasaron en la sala.

🔴 **Y acá hay algo que conviene ver de frente: el tablero y el incentivo apuntan a cosas
distintas.** El incentivo del PRD-0010 paga por **promedio de asistentes**; este tablero mide
**retorno**. Una profesora puede subir su retorno y bajar su promedio el mismo mes. No es un error
—son dos cosas que importan— pero es un argumento para que, cuando haya historia suficiente, el
incentivo mire el retorno y no solo el número de cabezas.

Lo demás del tablero, en orden de utilidad:

- Asistentes por clase, con la serie en el tiempo.
- Alumnas distintas en el mes.
- **Alumnas que se fueron:** cuya última clase fue hace más de 30 días. Es la señal más honesta de
  retención y hoy nadie la ve.
- **Recompra:** cuántas de sus alumnas compraron un segundo pack. Es el número que vale plata, y es
  lento: con créditos de 30 días, la primera lectura útil llega recién a los dos meses.

Sobre cada serie, marcados, los períodos de la bitácora.

### 4.4. Quién ve qué

- **La profesora:** lo suyo. Sus cursos, sus clases, sus bitácoras.
- **Felipe:** todo, y la comparación entre profesoras — que es el origen del pedido: entender por
  qué a una le va mejor.
- 🔴 **La comparación entre profesoras NO va en la pantalla de la profesora**, al menos al
  principio. Son cinco personas que se conocen; un ranking visible es una decisión de manejo de
  equipo, no una de producto, y se puede agregar después si Felipe lo quiere. Al revés no se puede.
- **Nunca datos de contacto de las alumnas** en el portal de la profesora: ni RUT, ni correo, ni
  teléfono, ni apoderado. Nombres sí, que ya los ve en su lista de inscritas.

## 5. Fuera de alcance

- Pruebas A/B de verdad, con asignación al azar. No tiene sentido con este volumen y además
  significaría darles clases distintas a alumnas que pagaron lo mismo.
- Cualquier cálculo de significancia estadística. Mentiría.
- Que el tablero recomiende qué hacer.
- Que la bitácora o el tablero afecten el pago. Ver PRD-0028 §8.6: la misma regla, por la misma
  razón.

## 6. Casos borde

- **Un curso con 3 asistentes.** La tasa de retorno salta entre 0%, 33%, 66% y 100% sin que haya
  pasado nada. El tablero no muestra porcentaje bajo un mínimo de alumnas: muestra el número crudo.
- **Una clase no dictada en medio del período.** Rompe la serie. Hay que mostrarla como un hueco, no
  interpolarla ni saltarla.
- **La alumna volvió, pero a otro curso de la misma profesora.** ¿Cuenta como retorno? Propuesta:
  sí, y que se pueda ver separado. Retuvo a la alumna, aunque no al curso.
- **La alumna volvió a un curso de otra profesora.** No cuenta para esta, pero **sí cuenta para
  XO**, y esa diferencia es justo lo que a Felipe le interesa. Que el tablero de owner lo distinga.
- **Dos bitácoras solapadas en el mismo curso.** Permitido —la vida es así— pero la pantalla tiene
  que decir que el período tiene dos cambios encima y que no se pueden separar.
- **Una alumna cuyos créditos se vencieron.** No volvió porque no podía, no porque no quisiera. Hay
  que poder distinguirlo o la retención se lee mal.

## 7. Modelo de datos

```sql
create table public.bitacora_cambios (
  id uuid primary key default gen_random_uuid(),
  profesora_id uuid not null references public.profesoras (id) on delete restrict,
  curso_id uuid not null references public.cursos (id) on delete restrict,
  descripcion text not null,
  desde date not null,
  hasta date,
  estado text not null default 'activo' check (estado in ('activo', 'terminado')),
  cierre text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
```

La asistencia **no necesita tabla nueva**: `reservas.estado` ya tiene los valores. Lo que falta es
quién los escribe.

El tablero **no lleva tablas de métricas**: se calcula de `reservas`, `clases` y `creditos`. Con
este volumen no hace falta precalcular nada, y una tabla de agregados es un segundo lugar donde el
número puede estar mal.

RLS: la profesora escribe y lee solo sus bitácoras, verificado con `dicta_la_clase()` o equivalente.
El owner todo. Antes de escribir cualquier política, mirar qué otras tiene la tabla: una permisiva
que ya exista suma acceso y la nueva no restringe nada. Y preguntárselo a la base con la sesión de
cada rol, incluido lo que **no** debe verse.

## 8. Reglas de negocio

1. La asistencia la marca quien dictó la clase. Si fue un reemplazo, la marca el reemplazo.
2. Una clase sin marcar queda **sin dato**. Nunca se asume asistencia completa.
3. El tablero dice siempre **sobre cuántas clases y cuántas alumnas** está calculado.
4. Bajo el mínimo de alumnas, número crudo y no porcentaje.
5. 🔴 Nada de esto entra en el cálculo del pago.
6. La bitácora no se borra. Se cierra.

## 9. Criterios de aceptación

- [ ] La profesora marca asistencia desde el teléfono, en menos de un minuto para 16 alumnas.
- [ ] Una clase sin marcar se ve como sin dato en el tablero, no como cero y no como completa.
- [ ] La tasa de retorno de una cohorte conocida, calculada a mano, coincide con la del tablero.
- [ ] Preguntado a la base con la sesión de una profesora: las bitácoras de otra devuelven cero
      filas, y la asistencia de clases que no dictó también.
- [ ] En el portal de la profesora no aparece ningún correo, teléfono ni RUT de alumna.
- [ ] Una liquidación del mismo mes da el mismo monto con y sin bitácoras cargadas.
- [ ] Un curso con 3 asistentes muestra números crudos y ningún porcentaje.

## 10. Métrica de éxito

**Que una decisión se tome mirando el tablero y quede escrita en la bitácora.** Una, en los primeros
dos meses. Si en dos meses nadie abrió el tablero para decidir algo, el tablero no servía.

## 11. Riesgos y supuestos

**11.1. El riesgo principal es creerle.** Ver §2. Un número con flecha verde al lado de una
dinámica activa se lee como causa aunque diga abajo "sobre 3 clases". Mitigación: que el tamaño de
la muestra esté al lado del número y no en una nota al pie, y que no haya flechas ni colores de
tendencia bajo el mínimo.

**11.2. Noviembre de 2026 no sirve de línea base.** Lanzamiento del sitio, cambio de precios,
capacidad de 18 a 16, una clase cancelada. **La primera línea base limpia es diciembre.** Si se
empieza a probar ahora, hay que escribirlo en la bitácora y leer los resultados sabiendo eso.

**11.3. Marcar asistencia es trabajo para la profesora, todas las clases.** Si es incómodo, se deja
de hacer en dos semanas y el tablero queda vacío y mintiendo. Es el supuesto más frágil del PRD y
hay que probarlo con una profesora antes de construir el tablero.

**11.4. El efecto de ser medida.** Una profesora que sabe que su retención se mira cambia su clase
por eso, no por la dinámica. Es bueno para el negocio y arruina la comparación. Otra razón para no
llamarlo prueba.

**11.5. La causa puede no ser la clase.** La profesora que retiene mejor puede estar retiniendo por
su Instagram, por su horario, por su sala o por el estilo que enseña. Ninguna dinámica dentro de la
sala va a explicar eso, y el tablero lo va a atribuir igual al período de la bitácora. El tablero
de owner debería poder mirar el mismo curso en distintos horarios y salas antes de concluir.

**11.6. Esto y el PRD-0028 son la misma pregunta por los dos lados:** los números dicen si
volvieron, los comentarios dicen por qué. Construir uno sin el otro deja la mitad. Si hay que elegir
cuál primero, el que más rápido cambia algo es **marcar la asistencia**, que es el insumo de los
dos.

## 12. Notas de implementación

Se llena al terminar.
