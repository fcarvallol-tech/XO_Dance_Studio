# Plan de implementación — PRD-0018 Clases especiales

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso
> quedó bien**. Se lee junto a `0018-clases-especiales.md`.
>
> Rama: `horario-pau-y-prd-0018` mientras no se mergee la migración de Pau; después,
> `prd-0018-clases-especiales`. Nada se mezcla a `main` hasta que pase la fase 7.
> **PRD aprobado por Felipe el 10/09/2026.** Se puede escribir código desde la fase 1.

---

## Fase 0 — Lo que la migración necesita ✅ cerrado

Recortada el 10/09/2026 a las decisiones que cambian el esquema o las funciones. Lo que no toca
la migración salió de acá (ver abajo).

| # | Decisión | Estado |
|---|---|---|
| 1 | ¿Créditos o compra aparte? | ✅ **Compra aparte** (Felipe, 09/09) |
| 2 | ¿Se retiene cupo mientras se aprueba la transferencia? | ✅ **Sí** (Felipe, 09/09). Expiración `min(declarada + retención, inicio − 2 h)`, perezosa más barrido. La retención es el parámetro `especial_retencion_horas`, que nace en 24 h como propuesta editable |
| 3 | Cancelación: ¿devolución automática? | ✅ **No** (Felipe, 09/09). Columnas de reembolso, estados `expirada` y `por_reembolsar`, `registrar_reembolso()` |
| 4 | Quién crea y quién fija precio | ✅ Admin y owner crean; solo owner fija `precio_clp` (Felipe, 09/09). Sin default cargado, admin no puede crear |
| 5 | Video | ✅ Iframe a `/embed/` sin `embed.js`, más **portada** propia obligatoria (PRD §8.7, 10/09) |

**Lo que salió de esta fase el 10/09/2026** porque no cambia ni una columna: el **valor** del
precio por defecto, el **variable** de la profesora y el **sueldo base**. Viven en **PRD-0009 §8**
y se confirman ahí. El nombre público ("Clases especiales") ya está decidido y es copy, no esquema.

**Checkpoint:** ✅ Felipe aprobó el PRD el 10/09/2026. Nada bloquea la fase 1.

---

## El orden no es arbitrario

Lo que decide plata se prueba **con datos** antes de que exista la interfaz, y la interfaz se
prueba **con el artefacto real** —el link, el Reel en el teléfono, el correo— antes de dar nada
por hecho. La regla del magic link: si una prueba no puede fallar por lo mismo que fallaría en
producción, no es una prueba.

Hay una novedad respecto de PRD-0017 que ordena este plan: **el cupo ahora cuenta reservas
pendientes**, y ese conteo vive en cinco lugares. Se cambia en todos en la misma fase (2), con un
test que los compare, o no se cambia en ninguno.

---

## Fase 1 — Las funciones puras, con sus tests primero

**Archivos:** `lib/dominio/especiales.ts` · `lib/dominio/especiales.test.ts`

| Función | Qué resuelve |
|---|---|
| `desdePrecio(especiales)` | El "desde $X" de Planes: mínimo de las publicadas futuras; `null` si no hay |
| `seSolapan(a, b)` | Dos bloques `[inicio, fin)` se pisan. Fija el contrato que después replica el SQL |
| `puedePublicar(especial)` | Reel, portada, profesora, sede, fecha futura, precio. Devuelve qué falta |
| `codigoDeReel(url)` | Extrae el código de `instagram.com/reel/<c>` y `/p/<c>`, rechaza todo lo demás. Sin él no hay embed |
| `urlDeEmbed(codigo)` | Arma `https://www.instagram.com/reel/<c>/embed/`. Es lo único de Instagram que el sitio construye, y solo se usa después del toque |
| `expiraAt(declaradaAt, inicioClase, retencionHoras)` | La regla de §8.2, incluido el caso de clase en menos de 26 h |
| `cupoTomado(reservas, ahora)` | Confirmadas + asistió + pendientes vigentes. **Es la función que los cinco lugares tienen que usar o replicar** |
| `montoAtribuible(reserva)` | Con crédito: regla de PRD-0010 §7.1. Con compra: `monto_clp` entero, neto de reembolso |
| `alumnasParaIgualarBase(precio, sala, base)` | Desde cuántas alumnas la profesora iguala una clase normal. Es el número que el formulario muestra al lado de `minimo_alumnas` (PRD-0009 §8.3) |

El variable de la profesora (`variableEspecial`) **no va acá**: se define en PRD-0009 §8 y se
implementa con la liquidación de PRD-0010 parte 3.

**Checkpoint:** ✅ 10/09/2026. `npm test` 72/72 (35 de este módulo) con los bordes: URL de
Instagram con parámetros de tracking y dominios parecidos, pendiente vencida hace un segundo y
otra que vence exactamente ahora, clase en menos de 26 h y en menos de 2 h, sin especiales
publicadas, precio $0, reembolso mayor que el monto. Hecho con el test escrito antes que el
código: el corredor falló por módulo inexistente y después pasó.

---

## Fase 2 — La migración

**Archivo:** `supabase/migrations/2026MMDDHHMMSS_clases_especiales.sql`

0. **Antes de nada:** `cat supabase/.temp/project-ref` tiene que decir **staging**
   (`ybopuahlzbjkkwumkllk`). Re-enlazada el 10/09/2026; verificar igual, porque un `link` a
   producción para otra cosa la cambia sin avisar.
1. `clases`: columnas de §7.1, `horario_id` nullable, checks, índice de slug.
2. `compras`: `plan_id` nullable, `clase_id`, columnas de reembolso, estados `expirada` y
   `por_reembolsar`, check plan-o-clase.
3. `reservas`: `credito_id` nullable, `compra_id`, `expira_at`, estados `pendiente_pago` y
   `expirada`, check crédito-o-compra.
4. `parametros`: `especial_retencion_horas` = 24. **No se inserta `especial_precio_default_clp`**:
   lo carga owner en la fase 7 (confirmado el 10/09: 12000, PRD-0009 §8).
5. Política `clases_lectura_publica` reescrita: borradores no son públicos. **Mirar qué otras
   políticas tiene `clases`** antes, porque se suman con OR.
6. Funciones de §7.5, cada una con `revoke ... from public, anon` y `grant execute ... to
   authenticated, service_role` escrito. `reservar_especial` comparte con `reservar` el bloqueo
   de la fila y el conteo de cupo: se extrae una función `cupo_tomado(clase_id)` y la usan las dos.
7. `reservas_de_mis_clases`, `inscritas_de_clase` y las funciones de métricas: cuentan pendientes
   vigentes donde corresponde (cupo sí, inscritas no).
8. Bucket `portadas-especiales` **privado**: sin política de `select` para `anon` ni
   `authenticated`. Solo la service role lee y escribe; el sitio sirve URLs firmadas (PRD §7.6).

**Checkpoint:** `db push --dry-run` contra staging muestra solo esta migración. Push a staging
**con aprobación**.

---

## Fase 3 — Escenario en staging, sin interfaz

Se extiende `scripts/sembrar-escenario.mjs`: dos especiales (una publicada con precio en Los
Leones, un borrador), tres alumnas con cuenta. Sin la fila `especial_precio_default_clp`, para
probar el camino de "admin no puede crear".

Por SQL, en transacciones revertidas:

| Caso | Esperado |
|---|---|
| `reservar_especial()` | compra `pendiente` con `clase_id`, reserva `pendiente_pago`, `expira_at` según regla, cupo −1 |
| Cupo en 1 con una pendiente vigente, otra alumna reserva | "La clase está llena" |
| Se adelanta `expira_at`, otra alumna reserva | La pendiente pasa a `expirada` y la nueva entra |
| `acreditar_compra()` de la pendiente | reserva `confirmada`, compra `pagada`, **cero lotes y cero movimientos** de crédito |
| `acreditar_compra()` de una ya expirada, con cupo | La reactiva |
| `acreditar_compra()` de una expirada, sin cupo | compra `pagada` sin reserva, marcada para devolver |
| `cancelar_reserva()` de una confirmada con compra | cupo liberado, compra sigue `pagada`, nada de dinero |
| `registrar_reembolso()` | compra `reembolsada` con monto, autor, fecha; admin sí, alumna no |
| `update clases set estado = 'cancelada'` | pagadas → `por_reembolsar`; pendientes → `expirada`; las de parrilla siguen devolviendo crédito |
| `anon` consulta `clases` por REST | ve la publicada, no el borrador |
| `crear_especial()` Diaguitas jueves 20:00 | rechazo por solape con 19:30 |
| Admin crea sin default cargado | rechazo con "Falta el precio por defecto" |
| Se carga el default; admin manda `precio_clp` | se ignora, queda el default; owner sí lo fija |
| `metricas_*` | ingresos y atribución incluyen la compra; `conciliacion` de créditos cuadra porque no la toca |

**Checkpoint:** tabla con resultado real al lado del esperado, pegada en PRD §13.

---

## Fase 4 — El formulario de admin

**Archivos:** `app/(admin)/admin/especiales/page.tsx` · `app/(admin)/admin/especiales/[id]/page.tsx`
· `components/FormularioEspecial.tsx` · `components/ReelFachada.tsx` ·
`app/api/especiales/portada/route.ts` · `lib/especiales-consultas.ts` · acciones en `lib/acciones.ts`

- El campo de Reel valida con `codigoDeReel` en el cliente y **otra vez en el servidor**; guarda
  solo el código.
- La portada sube por Route Handler con la service role al bucket privado: tipo y tamaño
  validados en el servidor; se guarda `portada_path`. La vista previa la muestra con URL firmada.
- Vista previa antes de publicar usa `ReelFachada`, el mismo componente que verá la visitante:
  si el Reel es privado, se ve el error de Instagram acá y no en producción.
- Precio: campo editable para owner, bloqueado con el default visible para admin. Si no hay
  default cargado, admin ve el aviso y no puede guardar.
- Al lado de "mínimo de alumnas": "Con este precio y esta sala, la profesora iguala una clase
  normal desde N alumnas" (`alumnasParaIgualarBase`). Se recalcula al cambiar precio o sede.
- Aviso de "hay N reservas" al editar fecha u hora.
- Bandeja de compras: la clase al lado cuando `clase_id` no es null; botón "Registrar reembolso"
  para pagadas con reserva cancelada y para `por_reembolsar`.

**Checkpoint:** en staging, crear una especial con un Reel real de @XO.dancestudioo, guardar,
publicar, ver la vista previa. Con rol admin, el precio está bloqueado.

---

## Fase 5 — Lo público: lista, página propia y fila en Planes

**Archivos:** `app/clases-especiales/page.tsx` · `app/clases-especiales/[slug]/page.tsx` ·
`app/clases-especiales/[slug]/opengraph-image.tsx` · `components/Especiales.tsx` ·
`components/Planes.tsx` · `app/api/revalidar/route.ts` · `app/privacidad/page.tsx`

- `ReelFachada`: portada propia (URL firmada de 30 días, generada en el servidor al renderizar)
  con el botón **"Ver el Reel en Instagram"** y la línea "Se carga desde Instagram"; al tocar,
  monta el iframe a `urlDeEmbed(código)` en un contenedor de proporción fija. **Nada de instagram.com se carga antes del toque.** Sin `embed.js`, nunca.
  Opcional: escuchar el `postMessage` de tipo `MEASURE` desde `https://www.instagram.com` para
  ajustar la altura, como hace `embed.js`.
- Open Graph desde la portada propia: `opengraph-image.tsx` descarga el objeto con la service
  role (sin URL) y compone 1200×630 con satori, con título, profesora y fecha, como
  `app/opengraph-image.tsx`.
- Fila en Planes: "Clases especiales · desde $X · **Ver clases especiales**". Desaparece sola sin
  publicadas futuras. El texto "los mismos valores para todos los cursos" pasa a hablar de la
  parrilla.
- El botón dice lo que pasa: "Reservar por $12.000". Nunca "Reservar" a secas.
- `/privacidad`: ✅ ya hecho el 10/09/2026 (fila de Meta en §5, párrafo en §9). Solo revisar
  que el texto del botón coincida con lo que dice la política.
- Colores solo de tokens `xo-*`; rosa nunca como texto sobre claro; copy en español de Chile.
  Leer `BRAND.md` §7 antes de escribir una frase.

**Checkpoint:** desde un **teléfono real**, sin sesión, en staging: landing → fila → lista →
página propia; la pestaña de red no muestra `instagram.com` hasta tocar; tocar reproduce; el link
pegado en WhatsApp muestra la portada; la URL de la portada lleva token y sin token responde
error.

---

## Fase 6 — Reservar, aprobar y cancelar desde la interfaz

**Archivos:** `components/FormularioCompra.tsx` (variante para clase) · `components/Calendario.tsx`
· `components/MisReservas.tsx` · `components/BandejaCompras.tsx` · `components/GrillaSemanal.tsx`
· `lib/correo.ts` (plantillas: pendiente con hora de expiración, confirmada)

**Checkpoint,** el flujo entero con el artefacto real, en staging:

1. Visitante sin cuenta → "Reservar por $X" → `/entrar` → **abre el enlace del correo** → vuelve
   a la especial → declara la transferencia → ve "tu cupo queda tomado hasta …" y recibe el correo.
2. Otra alumna intenta el último cupo y ve "llena".
3. Admin aprueba desde la bandeja; la alumna recibe el comprobante y **lo abre**.
4. La alumna cancela desde "Mis clases"; ve que el cupo se liberó y que el dinero se pide por
   WhatsApp. Admin registra el reembolso.
5. Admin cancela la clase con motivo; la compra queda por reembolsar en la bandeja.
6. La profesora ve la especial en su grilla con su título y sus inscritas, sin las pendientes.

---

## Fase 7 — Producción

1. `npm run build` y `npm test` en verde en la rama.
2. `cat supabase/.temp/project-ref` dice producción. `db push --dry-run` muestra solo esta migración.
3. **`db push` con aprobación de Felipe en ese mensaje.**
4. Owner carga `especial_precio_default_clp` = **12000** (confirmado el 10/09/2026, PRD-0009 §8).
   Crear la primera especial real con Carla.
5. Repetir el checkpoint de la fase 5 contra producción, desde un teléfono.
6. Actualizar PRD §13 y estado, `ROADMAP.md`, `ARCHITECTURE.md` §5.3 (clases sin horario, compras
   por clase, reservas pendientes) y `CONTEXT.md` §5.b si hace falta (ya dice "de la parrilla").

---

## Resumen de fases

| Fase | Estado |
|---|---|
| 0 — Decisiones | ✅ Cerrada. PRD aprobado el 10/09/2026; PRD-0009 §8 confirmado el mismo día |
| 1 — Funciones puras y tests | ✅ **Hecha el 10/09/2026**: 9 funciones, 35 tests, `npm test` 72/72 |
| 2 — Migración | **Lista para partir.** CLI ya en staging |
| 3 — Escenario en staging | Depende de la 2 y de aprobación del push a staging |
| 4 — Formulario y bandeja | Depende de la 2 |
| 5 — Público, Planes y privacidad | Depende de la 4 |
| 6 — Reservar, aprobar, cancelar | Depende de la 3 y la 5 |
| 7 — Producción | Depende de todo, y de aprobación del push |
