# Plan de implementación — PRD-0021 La sala nueva

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso quedó
> bien**. Se lee junto a `0021-sala-nueva-capacidad-y-clases-dictadas.md`.
>
> Se trabaja sobre `main`, como PRD-0019 y PRD-0020: no hay nada que aislar y una migración sin
> aplicar no cambia el comportamiento de nada. Lo que se aísla es **aplicarla**.
>
> **Estado: propuesta.** Las decisiones de §8 están cerradas; falta que Felipe apruebe este orden.

---

## Fase 0 — Decisiones ✅ cerradas el 26/09/2026

| # | Decisión | Estado |
|---|---|---|
| 1 | Estilo de la coreo | ✅ **Girly** |
| 2 | El cupo sale de la sala, con `sedes.capacidad`, y no puede superarla | ✅ Sí. El 22 deja de ser regla del sistema |
| 3 | Cómo se cobró | ✅ Transferencia **fuera del sistema**, y el registro lo dice |
| 4 | Lista de nombres | ✅ No existe en ninguna de las dos. Va el dato agregado |
| 5 | Slug y estado de la sede | ✅ `eb-dance-studio`, **activa para todo**, referencia "Bellavista" |
| 6 | Dificultad | ✅ Intermedio |
| 7 | Dónde va el costo por hora | ✅ `sedes.costo_hora_clp`; la tabla de finanzas lo toma después |
| 8 | La hora de término en la grilla | ✅ Sí, **cuando la duración difiere de una hora** |

---

## El orden no es arbitrario

Dos razones para este orden y no otro:

- **Las reglas antes que los datos.** Si se carga EB con capacidad 40 y recién después se arregla el
  tope de `crear_especial`, queda una ventana en la que la sala existe y no se puede usar. Peor: si
  se cargan las clases antes de que exista la columna de asistencia, hay que volver a tocarlas.
- **La parte pura antes que la pantalla.** El rango horario se formatea en el servidor y en el
  navegador, y una diferencia entre los dos es un error de hidratación. Este proyecto ya decidió
  formatear fechas a mano por eso mismo (`lib/compras.ts`), así que el rango va como función pura
  con tests antes de que ningún componente lo use.

Y una regla que este plan hereda: **la prueba tiene que poder fallar por lo mismo que falla en
producción.** Que el cupo no pueda superar la sala se prueba intentándolo, no leyendo la función.

---

## Fase 1 — El rango horario, función pura con tests primero

**Archivos:** `lib/dominio/horarios.ts` · `lib/dominio/horarios.test.ts`

| Función | Qué resuelve |
|---|---|
| `rangoHorario(inicio, fin, ahora?)` | `"18:00"` si dura una hora o no hay `fin`; `"18:00–19:30"` si dura distinto. Hora de Santiago, formateada a mano |
| `duracionMin(inicio, fin)` | Los minutos entre los dos, o `null` sin `fin` |

**Checkpoint:** `npm test` en verde con los bordes escritos antes que el código: exactamente 60
minutos (no muestra rango), 90, 45, `fin` nulo, `fin` antes del inicio (dato roto: se ignora y se
muestra solo el inicio), y una clase que cruza el cambio de horario de Chile.

---

## Fase 2 — La migración de reglas

**Archivo:** `supabase/migrations/2026MMDDHHMMSS_capacidad_de_sala_y_asistencia.sql`

0. **Antes de nada:** `cat supabase/.temp/project-ref` tiene que decir staging.
1. `sedes`: `capacidad` (not null, default 22, check 1–200) y `costo_hora_clp`. Las dos existentes
   quedan explícitamente en 22.
2. `clases`: `asistentes_registrados`, `asistentes_aproximados`, `registro_nota`.
3. **`crear_especial` y `editar_especial`**: el tope pasa de `> 22` a `> (capacidad de la sede)`, y
   el default de cupo pasa de 22 a la capacidad. El mensaje de error **nombra el número de la sala**:
   "El cupo no puede superar la capacidad de la sala (40)".
4. **`generar_clases`**: copia `s.capacidad` en `cupo_maximo` en vez de depender del default de la
   columna. Sigue siendo idempotente por índice único.
5. **`registrar_asistencia(clase, cantidad, aproximado, nota, actor)`**: admin+, exige que la clase
   ya haya empezado, sobreescribe, y **no toca `compras` ni `reservas`**. Con su `revoke ... from
   public, anon, authenticated` y su `grant execute ... to service_role` escritos.

**Checkpoint:** `db push --dry-run` contra staging muestra solo esta migración. Push **con
aprobación**.

---

## Fase 3 — Escenario por SQL, en transacciones revertidas

**Archivo:** `scripts/escenario-capacidad.mjs`

| Caso | Esperado |
|---|---|
| Especial en EB sin pasar cupo | cupo 40 |
| Especial en EB con cupo 45 | rechazo nombrando la capacidad (40) |
| Especial en Diaguitas con cupo 30 | rechazo nombrando 22 |
| Especial en Diaguitas con cupo 22 | pasa |
| `editar_especial` subiendo el cupo por encima de la sala | rechazo |
| `editar_especial` bajando el cupo por debajo de las reservas | sigue fallando como hoy |
| Bajar la capacidad de una sala con clases de cupo mayor | las clases no se tocan |
| `generar_clases` | las clases de EB con 40, las de las otras con 22 |
| `registrar_asistencia` en una clase pasada | queda el número, el flag y la nota |
| `registrar_asistencia` en una clase futura | rechazo |
| `registrar_asistencia` dos veces | sobreescribe, no suma |
| `registrar_asistencia` como alumna | 42501 |
| Después de registrar asistencia | **cero compras y cero reservas nuevas** |

**Checkpoint:** tabla con el real al lado del esperado, pegada en el PRD §13.

---

## Fase 4 — La carga de datos, como migración

**Archivo:** `supabase/migrations/2026MMDDHHMMSS_sede_eb_e_intensivo_septiembre.sql`

Va como migración y no como script **para que quede trazabilidad**: se revisa en el diff, corre
primero en staging y después en producción, y en seis meses se puede leer por qué existen esas dos
clases.

1. La sede: `eb-dance-studio`, EB Dance Studio, Chucre Manzur 7, Providencia, referencia
   "Bellavista", capacidad 40, $27.000/hora, activa.
2. Las dos clases, con `tipo = 'especial'`, `horario_id` null, Girly, Carli, EB, $8.000, dificultad
   intermedio, el código del Reel, 90 minutos, **sin publicar**:
   - viernes 11/09/2026, 18:00–19:30 Santiago · 35 asistentes, **aproximado**
   - viernes 25/09/2026, 17:00–18:30 Santiago · 20 asistentes, exacto
3. La nota de las dos: que se cobró por transferencia fuera del sistema y que no hay lista de
   nombres.

⚠️ **Las filas se insertan directo, no con `crear_especial()`.** La función exige un actor con
sesión y una migración no tiene ninguna. La contrapartida es que se saltan sus validaciones, así que
el escenario de la fase 5 las verifica **sobre las filas cargadas**: solape, cupo ≤ capacidad, slug
único y coherencia de `clases_tipo_coherente`.

⚠️ **Las horas se calculan en UTC desde la hora de Santiago.** En septiembre Chile está en −03:00
—el reloj se adelanta el primer sábado—, así que 18:00 local es 21:00Z. Se escribe con
`at time zone 'America/Santiago'` y no con un desfase a mano, por lo mismo que
`instanteEnSantiago()` existe.

**Checkpoint:** push a staging **con aprobación**, y después las comprobaciones de la fase 5.

---

## Fase 5 — Verificar la carga

Por SQL sobre las filas reales, no sobre un escenario inventado:

- Las dos clases existen con 90 minutos de duración y su `fin` correcto en hora de Santiago.
- Cupo 40, y 40 ≤ capacidad de EB.
- Cero compras y cero reservas apuntando a ellas.
- La asistencia quedó: 35 aproximado y 20 exacto, con la nota.
- **`metricas_demanda` no las cuenta** y la ocupación del tablero da lo mismo antes y después.
- `verificar-metricas.mjs` sigue dando lo que daba.

---

## Fase 6 — La hora de término en pantalla

**Archivos:** `lib/profesora-consultas.ts` · `components/GrillaSemanal.tsx` ·
`app/(profesora)/profesora/clases/[id]/page.tsx` · `lib/compras-consultas.ts` ·
`components/Calendario.tsx` · `lib/compras.ts`

- `ClaseDeProfesora` y `ClaseDelCalendario` ganan `fin`.
- Donde hoy se muestra una hora de inicio, se muestra `rangoHorario(inicio, fin)`.
- **Solo cambia lo que se ve en una clase que dura distinto de una hora.** Una clase normal sigue
  mostrando "18:00".

**Checkpoint:** con Chromium contra staging, entrando como Carli: su grilla muestra
**"18:00–19:30"** en las dos del intensivo y **"20:00"** a secas en una de parrilla. Y el calendario
de la alumna muestra el rango en una especial de 90 minutos futura.

---

## Fase 7 — Producción

1. `npm run build` y `npm test` en verde.
2. `cat supabase/.temp/project-ref` dice producción. `db push --dry-run` muestra **las dos**
   migraciones de este PRD y nada más.
3. **`db push` con aprobación de Felipe en ese mismo mensaje.**
4. Dejar la CLI de vuelta en staging.
5. Verificar en producción: la sede con su capacidad y su costo, las dos clases con su asistencia,
   cero compras asociadas, y la grilla de Carli mostrando el rango.
6. Actualizar `CONTEXT.md` §—las sedes son tres ahora— **con Felipe**, `ARCHITECTURE.md` §5.2 y
   §5.3, el `ROADMAP.md`, y la línea de PRD-0018 §9.8 que este PRD reemplaza.

---

## Resumen de fases

| Fase | Estado |
|---|---|
| 0 — Decisiones | ✅ Cerradas el 26/09/2026 |
| 1 — Rango horario puro con tests | Se puede empezar ya |
| 2 — Migración de reglas | Necesita staging enlazado y aprobación del push |
| 3 — Escenario por SQL | Depende de la 2 |
| 4 — Carga de datos | Depende de la 2 |
| 5 — Verificar la carga | Depende de la 4 |
| 6 — La hora de término en pantalla | Depende de la 1 y de la 4 para verla con datos reales |
| 7 — Producción | Depende de todo |
