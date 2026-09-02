# PRD-0008 — Portal de la profesora

| Campo | Valor |
|---|---|
| **Estado** | **Implementado** (02/09/2026). Migración escrita, **sin aplicar** |
| **Fecha** | 21 de agosto de 2026 |
| **Hito** | Hito 4 |
| **Relacionados** | PRD-0004 (roles) · PRD-0009 (admin) · PRD-0016 (horarios) · PRD-0017 (clases y reservas) |

## 1. Problema

Las profesoras necesitan saber qué clases tienen, quién viene y poder proponer horarios nuevos,
sin depender de que alguien se lo mande por WhatsApp.

> **Lo que cambió desde que se escribió esto (21/08).** Cuando se redactó, nada de esto existía y
> el portal habría mostrado listas inventadas. Hoy hay `horarios` y `sedes` (PRD-0016), y `clases`,
> `reservas` y `creditos` (PRD-0017): la profesora ve **clases reales con inscritas reales**.
> Tres de las cuatro profesoras ya tienen cuenta y rol, así que se puede probar con datos de
> verdad.

## 2. Usuario

La profesora, casi siempre desde el teléfono, mirando la clase de hoy minutos antes de entrar a
la sala.

## 3. Alcance

1. **Mis clases:** las suyas, agrupadas por día, con el conteo de inscritas de cada una. Una
   semana hacia atrás y sesenta hacia adelante — la misma ventana que ven las alumnas.
2. **Detalle de una clase:** quiénes vienen, con el conteo sobre 22.
3. **Solicitar horario:** día, hora, curso —del catálogo o uno nuevo que proponga—, sala opcional
   y mensaje. Va a la bandeja de administración.
4. **Estado de sus solicitudes**, con la respuesta escrita.
5. **La bandeja de administración para resolverlas.** Es alcance de PRD-0009, pero se adelanta
   solo esa parte: una solicitud que cae en un buzón que nadie abre no sirve de nada.

Los cursos que dicta ya no son una sección aparte: se derivan de sus clases, que es donde el dato
vive desde PRD-0016.

## 4. Fuera de alcance

- Ver ingresos, precios, créditos o cualquier dato financiero. **Restricción explícita**, y la
  que más condiciona el diseño. Ver §6.
- **Tomar asistencia.** Queda para después.
- Crear o cancelar clases por su cuenta: eso pasa por administración.
- Editar el listado de inscritas.
- **Crear el bloque al aprobar una solicitud.** Aprobar registra la decisión y responde; crear el
  horario toca la parrilla, los cupos y el calendario de las alumnas, y se hace a la vista en el
  catálogo.

## 5. Casos borde

- **Reemplazo:** una profesora cubre la clase de otra. La clase tiene su propia `profesora_id`,
  que puede diferir de la del horario recurrente, y debe aparecer en el calendario de quien la
  dicta ese día.
- **Solicitud que choca con un horario existente** en la misma sala: se muestra el conflicto al
  administrador al momento de resolverla.
- Profesora que además es alumna: ve los dos portales sin mezclarlos.

## 6. Reglas de negocio

1. Una profesora ve solo sus clases y sus alumnas, nunca las de otra.
   ⚠️ **Corregido el 03/09/2026:** de estas dos cosas, solo la segunda es de seguridad. Las
   clases son públicas por diseño y no pueden dejar de serlo; mostrarle solo las suyas es
   presentación. Lo que sí vive en la base es quién está inscrito. Ver §12.
2. **Del listado de inscritas ve el nombre y nada más.** Ni RUT, ni correo, ni teléfono, ni fecha
   de nacimiento, ni datos del apoderado. **Tampoco para clases pasadas.** Si necesita contactar a
   una alumna, pasa por administración.
3. El tope de 22 se muestra siempre como contexto (por ejemplo, 14/22).
4. No ve ningún monto, en ninguna vista: ni precios, ni lo que pagó una alumna, ni su saldo de
   clases.

## 7. Criterios de aceptación

- [x] Una profesora ve solo **a sus alumnas**, comprobado por API directa.
- [x] En el portal ve solo sus clases (filtrado en la consulta; las clases son públicas).
- [x] La lista de inscritas es legible en teléfono y muestra el conteo sobre 22.
- [x] Una solicitud de horario llega a administración y su estado se refleja de vuelta.
- [x] En ninguna vista aparece un monto.
- [x] **Pedir el correo o el teléfono de una inscrita es imposible por API**, no solo por
      interfaz: la función que devuelve el listado no tiene esas columnas.
- [x] Una clase con reemplazo aparece en el calendario de quien la dicta ese día.
- [x] Rechazar una solicitud sin respuesta es imposible.

## 8. Métrica de éxito

Que las profesoras dejen de preguntar por WhatsApp cuántas alumnas tienen ese día.

## 9. Cómo quedó implementado

| Pieza | Dónde |
|---|---|
| Esquema, funciones y RLS | `supabase/migrations/20260902120000_portal_profesora.sql` |
| Consultas | `lib/profesora-consultas.ts` |
| Sus clases | `app/(profesora)/profesora/mis-clases/` |
| Detalle con inscritas | `app/(profesora)/profesora/clases/[id]/` |
| Pedir horario y estado | `app/(profesora)/profesora/solicitudes/` · `components/FormularioSolicitud.tsx` |
| Bandeja de admin | `app/(admin)/admin/solicitudes/` · `components/BandejaSolicitudes.tsx` |

### RLS filtra filas, no columnas — y eso decide el diseño

La restricción de §6.2 no se puede cumplir con una política. Darle a la profesora un `select`
sobre `perfiles` para las alumnas de sus clases le entregaría **la fila entera**: correo,
teléfono, fecha de nacimiento, y cualquier columna sensible que se agregue después sin que nadie
se acuerde de este PRD.

Por eso **no se le da ningún acceso a `perfiles`**. Los nombres salen de una función:

```sql
create function public.inscritas_de_clase(p_clase_id uuid)
returns table (reserva_id uuid, nombre text, estado text)
```

El conjunto de columnas **es la firma**, no una promesa de la interfaz. Nadie puede pedirle un
correo porque no lo devuelve, y exponer un dato sensible exigiría editar esta función a propósito.
Adentro verifica que la clase sea suya y levanta `42501` si no.

### La cadena de identidad tenía un salto de tipo

`perfiles.profesora_id` es un **slug** con FK a `profesoras(slug)`; `clases.profesora_id` es un
**uuid** con FK a `profesoras(id)`. Responder "las clases de esta profesora" exige recorrer
perfil → slug → `profesoras.id` → clases. Se encapsuló en `mi_profesora_id()`, hermana de
`mi_rol()`, para no repetir ese join en cada política ni arriesgar que una lo escriba distinto.

### El reemplazo ya funcionaba; solo faltaba hacerlo legible

`clases.profesora_id` se **copia** del horario al generar, no se lee por join, y `generar_clases`
usa `on conflict do nothing`. Así que cambiar la profesora de una clase puntual ya hacía que
apareciera en el calendario de quien la dicta ese día — sin columnas nuevas.

Lo que se agregó es derivado: comparando `clases.profesora_id` con `horarios.profesora_id` se sabe
si esa clase es un reemplazo, y la pantalla dice "cubres a Pau". Sin dato nuevo que mantener.

### Las solicitudes: dos decisiones con la lección de PRD-0017 encima

- **`profesora_id → profesoras` y `resuelta_por → perfiles`**, a tablas distintas a propósito. Si
  ambas apuntaran a `perfiles`, PostgREST no podría resolver el embed y devolvería `PGRST201` sin
  ninguna fila — que es exactamente lo que dejó la bandeja de transferencias vacía. Ver
  PRD-0017 §17.
- **Todas las consultas devuelven `Lectura<T>`** y las páginas muestran el error. Un fallo de
  lectura no puede verse como "no tienes clases".

Además `conflictos_de_solicitud` le muestra a admin qué choca —misma sala y hora, o la profesora
ya dictando a esa hora— como contexto para decidir. No bloquea: los índices únicos de `horarios`
ya impiden crear el bloque conflictivo si igual se intentara.

## 10. La fuga que este PRD tuvo que cerrar

`saldo_creditos(uuid)` es `security definer` —salta RLS— y estaba concedida a `authenticated`:
cualquiera con sesión que conociera un `perfil_id` ajeno podía consultar cuántas clases tiene esa
persona.

Hasta ahora era difícil de explotar porque nadie veía `perfil_id` de otros. **Este PRD se los
entrega a la profesora**, porque para contar inscritas necesita leer `reservas`. Es decir, este
cambio convertía una debilidad teórica en alcanzable, y el saldo de clases es justo el dato
financiero que §6.4 prohíbe.

Se revocó a `authenticated`, dejándola solo para `service_role`. **No rompió nada:** la interfaz de
la alumna nunca la llamó —`getSaldo` consulta `creditos` con su propia sesión y RLS— y las tres
funciones que la usan por dentro son `security definer`. El único consumidor real era la vista
`duplicados_probables`, que se reescribió con un subquery sobre `creditos`: `creditos_admin_lee` ya
le permite a admin leer todos los lotes, así que el saldo sale igual, ahora pasando por RLS en vez
de saltándola.

## 11. Notas de implementación

⚠️ **Migración escrita y sin aplicar.** Al aplicarla conviene verificar, con una sesión de
profesora real —tres de las cuatro ya tienen cuenta—:

- Que ve sus clases y **ninguna** de otra profesora, pidiendo `/rest/v1/clases` directo.
- Que `inscritas_de_clase` sobre una clase ajena responde `42501`.
- Que `select` sobre `perfiles` le devuelve **solo su propia fila**.
- Que `saldo_creditos` le responde `42501` a cualquier perfil.
- Que la vista `duplicados_probables` sigue funcionando para admin.

## 12. Nota de implementación — la política que no restringía (03/09/2026)

**Síntoma:** una profesora reportó que veía horarios de clases que no eran suyos.

**Confirmado con una sesión real.** Lina tiene 10 clases de 73; `/rest/v1/clases` con su sesión
devolvía **73**, repartidas entre las cuatro profesoras.

### La causa: las políticas permisivas se suman

`clases_de_la_profesora` se escribió creyendo que limitaba. No hacía nada:

```sql
-- ya existía desde PRD-0017
create policy clases_lectura_publica on public.clases
  for select to anon, authenticated using (estado = 'programada');
```

**Las políticas permisivas de Postgres se combinan con OR.** La nueva no restaba: sumaba un
camino al que ya existía. Sin ninguna sesión, `anon` también ve las 73 — que es lo correcto y lo
que necesita la landing.

Y lo agravé en el código: `getMisClases` **no filtraba a propósito**, con un comentario que decía
que lo hacía RLS. Quité la única defensa que sí funcionaba para apoyarme en una que solo lo
parecía.

### No se arregla restringiendo: se arregla entendiendo qué es público

`clases` **tiene que** ser pública. Las alumnas necesitan la parrilla completa para reservar, y
una profesora que además toma clases —el caso borde de §5— también: una política que la limitara
a sus clases le rompería `/reservar`.

Así que la conclusión honesta es que **"solo sus clases" es presentación, no seguridad**. La
restricción de seguridad de este PRD siempre fue sobre las **inscritas**, y esa sí está en la
base y funciona.

Se borró la política en vez de dejarla: **una que no restringe es peor que ninguna**, porque la
próxima persona que lea el esquema va a creer que la protección existe. Y la consulta ahora
filtra con `mi_profesora_id()`.

### Lo que NO estaba expuesto, verificado con sesión real

| Prueba | Resultado |
|---|---|
| `inscritas_de_clase` de una clase ajena | 🟢 `42501: Esa clase no es tuya` |
| `select` sobre `perfiles` | 🟢 1 fila, la suya |
| `saldo_creditos` de otro perfil | 🟢 `42501` |
| `creditos`, `compras` | 🟢 sin acceso |

**Ninguna alumna quedó expuesta.** Fue la decisión correcta resolver los nombres con una función
`security definer` en vez de una política sobre `perfiles`: con una política, este mismo error de
OR habría filtrado datos de menores.

⚠️ `reservas` no tenía datos al auditar (0 filas), así que su política no está probada **con
datos**. Sí se verificó la expresión que la gobierna —`mi_profesora_id()` y `dicta_la_clase()`
responden correcto—, pero conviene repetir la prueba en cuanto exista la primera reserva real.

### La auditoría completa

Se revisó **todo lo que la API expone**, no solo lo que sospechaba: la lista salió del OpenAPI de
PostgREST —17 tablas y vistas, 20 funciones— para no depender de acordarme de alguna. El
inventario completo está en §14.

El error estaba en dos lugares:

1. `clases` — lo de arriba.
2. **`parametros` — y este era peor.** Ver §13.

Todo lo demás está bien: las tablas privadas no tienen política pública debajo, y en el catálogo
(`cursos`, `profesoras`, `sedes`, `horarios`, `planes`) el OR es justo lo que se quiere, porque
admin ve lo público **más** lo inactivo.

## 13. Hallazgo aparte: los datos bancarios estaban expuestos

Buscando el error de OR apareció otro del mismo tipo, más serio, en una tabla que no tiene nada
que ver con este PRD:

```sql
create policy parametros_lectura on public.parametros
  for select to anon, authenticated using (true);
```

Con la llave publishable —que viaja en el bundle del navegador, o sea que es pública de hecho—
**cualquiera sin cuenta podía leer la tabla entera**, y ahí viven los datos de transferencia que
se cargaron el 31/08:

- nombre completo del titular
- **su RUT**
- el número de cuenta
- su correo personal

No es la cuenta de la SpA: es una cuenta personal. Nombre y RUT de una persona identificada son
datos personales bajo la Ley 19.628, y estaban legibles sin sesión.

**Y revocar la tabla no alcanzaba.** `parametros_como_json` es `security definer` —salta RLS— y
tenía `grant execute to anon`: cualquiera sin sesión podía pedir
`POST /rest/v1/rpc/parametros_como_json` y recibir los diez parámetros igual. Lo verifiqué después
de escribir el primer arreglo, y devolvía todo.

> **Una tabla protegida con una función `security definer` que la expone es una tabla
> desprotegida.** Es el mismo error de fondo que las políticas permisivas: cerrar un camino no
> sirve si queda otro abierto. Por eso la auditoría de §14 se hizo sobre *todo* lo que la API
> expone, funciones incluidas, y no solo sobre las tablas.

**Arreglado:** `revoke all on public.parametros from anon` **más** revocar la función. Con sesión
se sigue leyendo —quien va a transferir necesita ver a dónde— y ninguna página pública los usa.

⚠️ **Esto estuvo expuesto desde el 31/08.** No hay forma de saber si alguien lo leyó. Vale la pena
que Carla lo sepa, y decidir si conviene mover el cobro a una cuenta de la SpA cuando exista.

## 14. Inventario: qué es público hoy

Verificado sin sesión, con la llave publishable —la que viaja en el bundle del navegador—, contra
**todo** lo que expone la API. La lista se sacó del OpenAPI de PostgREST, no de memoria.

### Tablas y vistas

| Recurso | Sin sesión | ¿Correcto? |
|---|---|---|
| `cursos` | 4 de 8 filas | ✅ los activos. El catálogo es público |
| `profesoras` | 4 de 5 | ✅ las activas |
| `sedes` | 2 | ✅ con dirección, desde PRD-0016 |
| `horarios` | 7 | ✅ la parrilla es pública |
| `planes` | 4 | ✅ los precios se publican |
| `clases` | 73 | ✅ **a propósito**: las alumnas necesitan la parrilla para reservar |
| `parametros` | 10 | 🔴 **NO.** Ver §13 — corregido |
| `perfiles` | bloqueada | ✅ |
| `leads` | bloqueada | ✅ |
| `cambios_rol` | bloqueada | ✅ |
| `compras` | bloqueada | ✅ |
| `creditos` | bloqueada | ✅ |
| `movimientos_credito` | bloqueada | ✅ |
| `reservas` | bloqueada | ✅ |
| `solicitudes_horario` | bloqueada | ✅ |
| `duplicados_probables` | bloqueada | ✅ la vista respeta el RLS de `perfiles` |
| `perfiles_sin_actividad` | bloqueada | ✅ ídem |

Las dos vistas no las había auditado antes y salieron acá: `security_invoker = true` hizo lo suyo.

### Funciones

Las que `anon` **podía ejecutar** antes de este arreglo:

| Función | Devolvía | ¿Correcto? |
|---|---|---|
| `parametros_como_json` | **los diez parámetros, RUT y cuenta incluidos** | 🔴 **NO.** Ver §13 |
| `parametro_int` | valores de configuración | ⚠️ innecesario |
| `mi_rol`, `mi_profesora_id` | `null` | ⚠️ inofensivo pero innecesario |
| `tiene_nivel`, `dicta_la_clase` | `false` | ⚠️ ídem |
| `conflictos_de_solicitud` | `[]` | ⚠️ ídem |
| `nivel_rol`, `normalizar_nombre` | funciones puras | ⚠️ ídem |
| `saldo_creditos`, `inscritas_de_clase`, `generar_clases` | `42501` | ✅ bloqueadas |
| `crear_lead`, `reservar`, `cancelar_reserva`, `acreditar_compra`, `rechazar_compra`, `cambiar_rol`, `resolver_solicitud` | no existen para `anon` | ✅ |

**Todas se le revocaron a `anon`.** Ninguna página pública llama una RPC —la landing lee tablas y
los leads se guardan desde el servidor— y se verificó que ninguna política `to anon` invoca
funciones, así que revocar no rompe la lectura del catálogo.

### La regla que deja este inventario

**Público debe ser una decisión, no un resto.** Lo que está abierto hoy —catálogo, parrilla,
precios— lo está porque la landing lo necesita. Todo lo demás se cierra, y si mañana algo público
hace falta, se abre esa cosa y no la tabla entera.
