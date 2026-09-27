# PRD-0021 — La sala nueva: capacidad, duración y clases ya dictadas

| Campo | Valor |
|---|---|
| **Estado** | ✅ **En producción desde el 27/09/2026.** Decisiones de §8 cerradas por Felipe el 26/09; §8.4 corregida ese mismo día tras descubrir que una de sus afirmaciones era falsa |
| **Autor** | Claude, a pedido de Felipe Carvallo |
| **Fecha** | 26 de septiembre de 2026 |
| **Hito** | Hito 1 — Catálogo · toca también Hito 3 (clases) y Hito 5 (liquidación, de lejos) |
| **PRDs relacionados** | PRD-0016 (sedes y horarios) · PRD-0018 (clases especiales: duración y cupo) · PRD-0010 §8.5 (liquidación y costos de sala) · PRD-0008 (grilla de la profesora) |

> **Reemplaza PRD-0018 §9.8.** Esa regla decía *"El cupo por defecto es 22. Owner puede bajarlo;
> no subirlo."* Pasa a ser: **el cupo por defecto es la capacidad de la sala**, se puede bajar y no
> se puede subir por encima de ella. El 22 deja de ser una regla del sistema.

---

## 1. Problema

Hay una sala nueva —**EB Dance Studio**, Chucre Manzur 7, Providencia, sector Bellavista— que es
la más grande que tiene la academia: **40 personas** contra las 22 de las otras dos. Y hay dos
clases de un intensivo que **ya se dictaron** ahí, con una coreografía de *"What you need"* de Omar
Courtz, de **hora y media**, a $8.000, cobradas por transferencia **fuera del sistema**.

Cargar eso destapó tres supuestos que estaban escritos como si fueran reglas del negocio:

1. **El 22 está como constante, no como propiedad de la sala.** `sedes` no tiene capacidad, y
   `crear_especial` rechaza cualquier cupo mayor que 22 con un mensaje que dice *"El cupo va de 1 a
   22"*. `generar_clases` no setea cupo: usa el default de la columna. Así que hoy **una clase de 40
   personas no se puede crear**, y el número de la sala no vive en la sala.
2. **La duración variable funciona por dentro y no se ve por fuera.** `solape_de_especial` usa el
   `fin` real de la clase, así que los 90 minutos se validan bien; el supuesto de una hora solo
   aplica a la parrilla, que no tiene `fin`. Pero **ninguna pantalla muestra la hora de término**:
   `ClaseDeProfesora` y `ClaseDelCalendario` no traen `fin`. Carli ve *"18:00 · Girly"* y no puede
   saber que termina a las 19:30, así que no puede planificar lo que viene después. Con duraciones
   variables eso deja de ser un detalle.
3. **No hay forma de registrar una clase que ya ocurrió sin inventar datos.** `reservas` exige
   `credito_id` **o** `compra_id`: no se puede anotar que fueron 35 personas sin fabricar 35
   compras que nunca existieron.

## 2. Usuario y contexto de uso

| Quién | Desde dónde | Cuándo | Qué necesita |
|---|---|---|---|
| **Owner** | Computador | Al abrir una sala o agendar un intensivo | Que el cupo salga de la sala y no tener que pelear con un tope escrito en el código |
| **Owner / admin** | Computador | Después de un intensivo cobrado por fuera | Dejar constancia de que la clase ocurrió y cuánta gente fue, sin inventar compras |
| **Profesora** | Teléfono, mirando su semana | Antes de comprometer otra cosa esa tarde | Ver que la clase de las 18:00 **termina 19:30** |
| **Alumna** | Teléfono, al reservar | Antes de apretar | Saber que está comprometiendo hora y media, no una hora |

## 3. Alcance

1. **`sedes.capacidad`** y **`sedes.costo_hora_clp`**. Las dos existentes quedan en 22; EB en 40.
2. **El cupo de una clase no puede superar la capacidad de su sala**, y **por defecto es** esa
   capacidad. Se valida en `crear_especial`, en `editar_especial` y al generar la parrilla.
3. **`generar_clases` copia la capacidad de la sala** en cada clase que materializa, en vez de
   depender del default de la columna.
4. **Registro de una clase ya dictada, con asistencia agregada**: cuántas personas fueron, si el
   número es exacto o aproximado, y una nota de procedencia. Sin compras y sin reservas.
5. **La hora de término se muestra donde hoy solo se ve la de inicio**, y solo cuando la clase dura
   distinto de una hora: la grilla de la profesora, el detalle de su clase y el calendario de la
   alumna.
6. **Los datos cargados**: la sede EB Dance Studio y las dos clases del intensivo, con su Reel, su
   precio, su duración y su asistencia.

## 4. Fuera de alcance

- **Asistencia con nombres.** No existe la lista de ninguna de las dos clases, y sin nombres no hay
  nada que guardar por persona. Cuando haya registro de asistencia de verdad —que es su propio PRD,
  el que PRD-0010 §8.5 anticipa— esto no estorba: son dos hechos distintos y pueden convivir.
- **Que la asistencia registrada entre al tablero.** Está decidido que lo de septiembre no entra
  (`CONTEXT.md`, 09/09/2026). Se anota la consecuencia en §12 y no se construye.
- **Cobrar o registrar plata de esas clases.** Se cobró por transferencia fuera del sistema y así
  queda dicho. No se crea ninguna compra.
- **La tabla de finanzas de PRD-0010 parte 2.** `sedes.costo_hora_clp` es una propiedad de la sala;
  cuando exista la tabla, la toma de ahí.
- **Horarios recurrentes en la sala nueva.** La sede queda activa y disponible, pero este PRD no
  crea ningún horario.
- **Publicar las dos clases.** Ya ocurrieron: `publicar_especial` exige fecha futura y está bien que
  la exija. Ver §8.4.

## 5. Flujo principal

No hay interfaz nueva. El flujo es el de siempre, con dos diferencias:

1. Owner abre **Nueva clase especial**, elige EB Dance Studio y el campo de cupo **nace en 40**, no
   en 22. Si escribe 45, la base lo rechaza diciendo que la sala tiene 40.
2. Pone duración 90. La clase se guarda de 18:00 a 19:30, el solape la respeta, y **la grilla de
   Carli muestra "18:00–19:30"**.
3. Para el intensivo que ya pasó, admin registra la asistencia: *35 personas, aproximado, cobrado
   por transferencia fuera del sistema*. Queda en la clase, no en `compras`.

## 6. Casos borde y errores

| Caso | Qué pasa |
|---|---|
| Se crea una clase con cupo mayor que la sala | Se rechaza: "El cupo no puede superar la capacidad de la sala (40)" |
| Se baja la capacidad de una sala por debajo del cupo de clases ya creadas | **No se toca nada retroactivamente.** La regla se aplica al crear y al editar una clase, no a las que ya existen: una clase que ya se dictó con 40 personas no puede volverse inválida porque después se remidió la sala |
| Se edita una clase para bajarle el cupo por debajo de sus reservas | Ya falla hoy con "Hay más reservas que ese cupo". No cambia |
| Una sala sin capacidad cargada | No puede pasar: la columna es `not null` y la migración llena las dos existentes. Si igual quedara en null, el cupo caería al default de la columna y el tope no aplicaría: por eso es `not null` |
| Una clase de exactamente 60 minutos | La grilla muestra solo "18:00". Agregar "–19:00" a todas las clases normales es ruido en la pantalla que más se mira |
| Una clase de parrilla, que no tiene `fin` | Se asume una hora, como hoy, y se muestra solo la hora de inicio. Si algún día un horario recurrente dura distinto, ese es otro cambio |
| Registrar asistencia en una clase futura | Se rechaza: una clase que no ocurrió no tiene asistentes |
| Registrar asistencia dos veces | Sobreescribe, no suma. Es un dato observado, no un contador |
| Registrar asistencia mayor que el cupo | Se permite **con la nota**: en la vida real entró más gente que el cupo declarado, y negarlo haría que el registro mienta. Lo que no se permite es superar la capacidad de la sala |

## 7. Modelo de datos

```sql
-- 1. La sala sabe cuánta gente le cabe y cuánto cuesta.
alter table public.sedes
  add column if not exists capacidad smallint not null default 22
    check (capacidad between 1 and 200),
  add column if not exists costo_hora_clp int
    check (costo_hora_clp is null or costo_hora_clp >= 0);

-- Las dos que ya existen miden 22. Es el número que hasta hoy estaba en el
-- código como si fuera del sistema.
update public.sedes set capacidad = 22
  where slug in ('seduccion-latina', 'diaguitas');

-- 2. Una clase que ya se dictó, con su asistencia observada.
alter table public.clases
  add column if not exists asistentes_registrados smallint
    check (asistentes_registrados is null or asistentes_registrados >= 0),
  -- "~35" y "20" no son el mismo tipo de dato, y el tablero que algún día los
  -- lea tiene que poder distinguirlos.
  add column if not exists asistentes_aproximados boolean not null default false,
  -- De dónde salió el número y cómo se cobró. Es la trazabilidad.
  add column if not exists registro_nota text;
```

**Lo que NO se agrega, y por qué:** ninguna fila en `compras` ni en `reservas`. La plata se cobró
por transferencia fuera del sistema y las personas no reservaron por la web. Inventar 35 compras
para que los números cuadren sería exactamente lo contrario de trazabilidad.

**RLS:** no cambia. `sedes` y `clases` ya tienen sus políticas; las columnas nuevas viajan con
ellas. `capacidad` y `costo_hora_clp` quedan visibles para `anon` porque `sedes` es público — la
capacidad no es un secreto y el costo… ver §12.

## 8. Decisiones — cerradas por Felipe el 26/09/2026

### 8.1 El cupo sale de la sala

`sedes.capacidad`, y el cupo de una clase no puede superarla. Por defecto **es** la capacidad.
El 22 pasa a ser lo que miden Diaguitas y Seducción Latina, no una regla.

Esto **reemplaza PRD-0018 §9.8**. No se cambia esa línea en silencio: queda dicho arriba y en el
propio PRD-0018.

### 8.2 El costo por hora vive en la sala

$27.000/hora en EB. Es una propiedad de la sala, como la dirección. La tabla de finanzas de
PRD-0010 parte 2 lo va a leer de ahí en vez de tener su propia copia.

### 8.3 La asistencia se registra agregada, con su procedencia

Un número, si es aproximado o exacto, y una nota. No hay lista de nombres de ninguna de las dos
clases, así que no hay nada por persona que guardar. **El dato que existe es "cuánta gente fue", y
se guarda tal cual: aproximado cuando es aproximado.**

### 8.4 Las clases dictadas no se publican — corregido el 26/09/2026

`publicar_especial` exige fecha futura, así que estas dos quedan sin publicar. Dos consecuencias se
verificaron y son las que se buscaban:

- **No entran a `metricas_demanda`**, que filtra `parrilla or publicada_at is not null`. Así no
  aparecen como dos clases con 0 reservas arruinando la ocupación del tablero. ✅ Verificado.
- **No se ven públicamente**: `clases_lectura_publica` pide lo mismo. ✅ Verificado.

🔴 **Y una tercera era falsa.** Este PRD decía, y Felipe lo aprobó así:

> *"Sí aparecen en la grilla de la profesora, que no filtra por publicada."*

**No aparecían.** La consulta no filtra, pero **RLS sí**: `clases` tenía dos políticas de select
—`clases_lectura_publica` (parrilla o publicada) y `clases_admin_todo` (admin)— y una profesora no
es admin, así que lo único que la cubría era la primera. Preguntado con su sesión el 26/09/2026: la
base tenía **2** clases suyas y ella veía **0**.

Y eso tiraba abajo el sentido de cargar el intensivo: **la trazabilidad quedaba solo para admin**, y
para Carli no servía de nada.

**Arreglado con una política nueva** (`20260927120000_la_profesora_ve_sus_clases.sql`): la profesora
ve las clases que dicta, publicadas o no. Suma acceso **solo a sus propias filas**
—`profesora_id = mi_profesora_id()`—, así que no abre la tabla, y se verificó preguntándole a la
base con cada sesión: Carli ve sus 2, otra profesora ve 0, una alumna 0, sin sesión 0, admin las 2,
y Carli **no** ve los borradores de otras. Lo público sigue público.

**La lección, que es lo que hay que llevarse de acá:** afirmar cómo se comporta una política
leyéndola no vale. Es la tercera vez en este repo que las políticas sorprenden. Cuando se escriba
que algo "sí aparece" o "no aparece", tiene que venir de una consulta con la sesión
correspondiente. Quedó como regla en `CLAUDE.md` y como verificador en
`scripts/verificar-rls-clases.mjs`.

### 8.5 La hora de término se muestra cuando la duración no es de una hora

Pedido de Felipe: *"Carli viendo 18:00 sin saber que termina a las 19:30 no puede planificar lo que
viene después."*

Se muestra **solo cuando difiere de 60 minutos**. La alternativa —mostrar siempre el rango— se
descarta: la grilla es la pantalla que más se mira y llenarla de "19:00" redundantes la vuelve más
difícil de barrer con la vista. El rango aparece justamente cuando hay algo que no se puede
suponer.

## 9. Reglas de negocio

1. `cupo_maximo` de una clase **≤** `capacidad` de su sede, siempre que se cree o se edite.
2. Sin cupo explícito, el cupo **es** la capacidad de la sala.
3. Bajar la capacidad de una sala **no invalida** clases ya creadas.
4. La asistencia registrada solo se puede anotar en una clase cuya hora de inicio **ya pasó**.
5. Registrar asistencia **no crea** compras, reservas ni créditos. Nunca.
6. La asistencia se sobreescribe, no se acumula.
7. Solo `admin` o superior registra asistencia, y queda quién y cuándo.

## 10. Criterios de aceptación

- [ ] `sedes` tiene `capacidad` y `costo_hora_clp`; las dos salas viejas en 22 y EB en 40 con
      $27.000.
- [ ] Crear una especial en EB **sin pasar cupo** la deja en 40.
- [ ] Crear una especial en EB con cupo 45 se rechaza nombrando la capacidad de la sala.
- [ ] Crear una especial en Diaguitas con cupo 30 se rechaza; con 22 pasa.
- [ ] `generar_clases` materializa las clases de EB con cupo 40 y las de las otras con 22.
- [ ] Las dos clases del intensivo existen, de 90 minutos, con su Reel, $8.000, Girly, Carli, EB, y
      **sin compras ni reservas asociadas**.
- [ ] Cada una tiene su asistencia: 35 aproximado y 20 exacto, con la nota de que se cobró por
      transferencia fuera del sistema.
- [ ] `metricas_demanda` **no** las cuenta, y la ocupación del tablero no se movió.
- [ ] La grilla de Carli muestra **"18:00–19:30"** en esas dos, y sigue mostrando solo "18:00" en
      una clase de una hora.
- [ ] El calendario de la alumna muestra el rango en una clase de 90 minutos futura.
- [ ] Registrar asistencia en una clase futura se rechaza; una alumna no puede registrar ninguna.
- [ ] `npm run build` y `npm test` en verde.

## 11. Métrica de éxito

**Que la próxima clase que dure distinto de una hora, o que se haga en una sala de otro tamaño, no
requiera ninguna decisión nueva ni ningún cambio de código.** Hoy requiere las dos cosas.

## 12. Riesgos y supuestos

- **El costo de la sala queda legible para `anon`**, porque `sedes` es una tabla pública y la
  política deja pasar todas sus columnas. No es un dato sensible —cualquiera puede preguntar cuánto
  cobra una sala— pero **es información de costos de la academia en una tabla pública**, y conviene
  decidirlo a propósito: la alternativa es moverlo a la tabla de finanzas de PRD-0010, que nace con
  RLS de solo `owner`. Propuesta: dejarlo acá ahora y moverlo cuando esa tabla exista, sabiendo que
  hasta entonces es público.
- **La asistencia registrada no llega a ninguna pantalla todavía.** Este PRD la guarda; mostrarla
  —y decidir si cuenta como "clase dictada" para la liquidación— es PRD-0010 §8.5. El riesgo es que
  quede un dato que nadie mira; se mitiga anotándolo ahí.
- **`ARCHITECTURE.md` §5.3 describe `estado (programada|realizada|cancelada)` y el esquema solo
  tiene dos**: `programada` y `cancelada`. Una clase pasada queda `programada` con fecha vieja, que
  es como el sistema ya representa "ya ocurrió" —las métricas derivan `dictada` de la fecha—. Se
  corrige la documentación, no el esquema.
- **Supuesto: la capacidad de una sala es un número.** Si alguna sala tuviera capacidad distinta
  según el tipo de clase, esto no alcanza. Hoy no pasa.

## 13. Notas de implementación

Hecho entre el 26 y el 27/09/2026, en siete fases. Lo que se desvió, y las cosas que solo
aparecieron al construirlo:

### El costo por hora no necesitó una tabla aparte

Felipe pidió que `costo_hora_clp` no fuera público —no es el precio de lista de la sala, es lo que
él paga, y junto al precio por clase deja calcular el margen— y que se evaluara dejarlo en `sedes`
fuera de lo que la API expone antes de crear otra tabla.

**Se pudo:** PostgREST respeta los permisos por columna, y todas las lecturas públicas de `sedes`
piden columnas explícitas (`CAMPOS_SEDE`), nunca `*`. Se revocó el `select` de tabla a `anon` y
`authenticated` y se les devolvió columna por columna. Verificado en producción: pedir
`costo_hora_clp` con la llave publishable da **401**, pedir lo público devuelve los datos, y
`select=*` da 401.

**Contrapartida, escrita también en `ARCHITECTURE.md` §5.2:** una columna nueva en `sedes` no la ve
`anon` hasta que alguien la agregue a ese grant. Falla fuerte, no en silencio, y el escenario
compara la lista de columnas legibles contra la esperada.

### La regla del cupo es un trigger, no las funciones

Un check de tabla no puede consultar otra tabla, y poner la validación solo en `crear_especial` deja
fuera los **inserts directos** — que son justamente los que hace una migración de datos como la de
la fase 4. Así que la garantía es `clases_cupo_cabe_en_la_sala`, y el escenario lo comprueba
intentando un insert directo con cupo 50 en una sala de 40.

### Tres cosas que solo aparecieron al abrir la pantalla

1. **`getSemana` tiene su propia lista de campos**, aparte de `CAMPOS_CLASE`. Había actualizado una
   y no la otra, así que el rango horario no llegaba a la grilla. Quedó comentado en las dos.
2. **La grilla llamaba a una especial por el nombre de su curso.** Lo pedía PRD-0018 §7.7 y estaba
   sin hacer: las dos clases del intensivo aparecían las dos como "Girly", que con dos clases del
   mismo estilo el mismo día no distingue nada.
3. 🔴 **La profesora no veía sus propias especiales sin publicar.** Ver §8.4: es el hallazgo que
   corrigió una decisión ya aprobada, y dejó una regla nueva en `CLAUDE.md`.

### Pendiente, anotado

- **La asistencia registrada no llega a ninguna pantalla.** Este PRD la guarda; mostrarla y decidir
  si cuenta como "clase dictada" para la liquidación es PRD-0010 §8.5.
- **`ARCHITECTURE.md` decía `estado (programada|realizada|cancelada)`** y el esquema solo tiene dos.
  Una clase pasada queda `programada` con fecha vieja, que es como el sistema ya representa "ya
  ocurrió". No se tocó el esquema.
- **La sala nueva no tiene horarios recurrentes.** Queda activa y disponible; programar ahí es una
  decisión aparte, y `CONTEXT.md` explica por qué conviene pensarla: en EB una clase de 90 minutos
  cuesta $40.500 de sala.
