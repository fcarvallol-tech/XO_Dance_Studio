# Plan de implementación — PRD-0018 Clases especiales

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso
> quedó bien**. Se lee junto a `0018-clases-especiales.md`.
>
> Rama: `prd-0018-clases-especiales`. Nada se mezcla a `main` hasta que pase la fase 7.
> **No se escribe código hasta que el PRD esté aprobado y la fase 0 cerrada.**

---

## Lo que necesito de ti antes de partir (fase 0)

Sin esto la migración no se puede escribir completa, y el resto depende de la migración.

| # | Decisión | Dónde está explicada | Default si no dices nada |
|---|---|---|---|
| 1 | ~~¿A, B o C?~~ ✅ **B, compra aparte** (Felipe, 09/09/2026) | PRD §8 | Resuelto |
| 2 | ¿Se retiene cupo mientras se aprueba la transferencia? | PRD §8, fila "cupo y transferencia" | No hay default: bloquea |
| 3 | Cancelación a tiempo, ¿devolución en plata o crédito de compensación? Y si cancela la academia | PRD §8, fila "cancelación" | No hay default: bloquea |
| 4 | Variable de la profesora por especial | PRD §8, fila "liquidación" | Se registra en la liquidación como $0 hasta que se defina, con el motivo en pantalla |
| 5 | **Nombre público** (no puede ser "clase suelta") | PRD, nota inicial | "Clase especial" en la interfaz hasta que Carla decida |
| 6 | **Precio por defecto** en pesos (o costo en créditos si es A) | PRD §7, `parametros` | No hay default: el formulario nace con el campo vacío y obligatorio |
| 7 | ¿Admin puede crear especiales o solo owner? | PRD §2 | Admin crea, owner fija precio |

**Checkpoint:** las decisiones quedan escritas en PRD §8 como resueltas, con fecha. Si alguna
cambia una regla ya decidida (créditos sin `curso_id`, cupo no retenido), se escribe el ADR antes
de la migración.

---

## El orden no es arbitrario

La lección de PRD-0010 aplica entera: lo que decide plata se prueba **con datos** antes de que
exista la interfaz, y la interfaz se prueba **con el artefacto real** —el link, el video en el
teléfono, el correo— antes de dar nada por hecho. Y la lección del magic link: si una prueba no
puede fallar por lo mismo que fallaría en producción, no es una prueba.

---

## Fase 1 — Las funciones puras, con sus tests primero

**Archivos:** `lib/dominio/especiales.ts` · `lib/dominio/especiales.test.ts`

Lo que divide, compara o decide, sin tocar la base:

| Función | Qué resuelve |
|---|---|
| `desdePrecio(especiales)` | El "desde $X" de la fila de Planes: mínimo de las publicadas futuras; `null` si no hay |
| `seSolapan(a, b)` | Dos bloques `[inicio, fin)` se pisan. Es la regla que después se escribe en SQL; el test fija el contrato (19:30–20:30 pisa 20:00–21:00; 19:00–20:00 no pisa 20:00–21:00) |
| `puedePublicar(especial)` | Video, profesora, sede, fecha futura, precio. Devuelve qué falta, no un booleano |
| `costoEnCreditos(especial)` (solo A) | N entero ≥ 1 |
| `lotesParaDescontar(lotes, n)` (solo A) | Qué lotes y cuánto de cada uno, FIFO por vencimiento. Es la función que después replica `reservar()` en SQL y la más fácil de romper |
| `montoAtribuible(reserva)` | Con A: `monto_compra / clases_compra × n`. Con B: `precio_clp`. Extiende la regla de PRD-0010 §7.1 |

**Checkpoint:** `npm test` en verde con los bordes: sin especiales publicadas, N mayor que el
saldo, lotes que vencen el mismo día, especial de 90 minutos.

---

## Fase 2 — La migración

**Archivo:** `supabase/migrations/2026MMDDHHMMSS_clases_especiales.sql`

Lo del PRD §7 más lo que decida §8:

1. Columnas nuevas en `clases`, `horario_id` nullable, checks de coherencia, índices.
2. Política `clases_lectura_publica` reescrita: borradores no son públicos. **Mirar qué otras
   políticas tiene `clases` antes**, porque se suman con OR.
3. Funciones `security definer`, con sus grants explícitos:
   - `crear_especial(...)` y `editar_especial(...)`: validan rol, solape y coherencia. Solo owner
     toca el precio.
   - `publicar_especial(id)` y `cancelar` reutiliza `cancelar_clase`.
   - `reservar()` extendida según §8. Con A: descuenta N cruzando lotes y escribe N movimientos.
     Con B: crea la compra y la reserva en la misma transacción.
   - `cancelar_reserva()` y `devolver_creditos_de_clase()` extendidas para devolver N, o para
     registrar la devolución en plata.
4. Bucket `videos-especiales` con sus políticas.
5. `parametros`: precio por defecto.

**Checkpoint:** `npx supabase db push --dry-run` contra staging muestra solo esta migración. El
push a staging **con tu aprobación**.

---

## Fase 3 — Escenario en staging, sin interfaz

Se siembra con `scripts/sembrar-escenario.mjs` extendido: dos especiales (una publicada, un
borrador), una alumna con un lote de 3 créditos y otra sin nada.

Se ejercita **por SQL**, en transacciones revertidas, igual que PRD-0010 fase 3:

| Caso | Esperado |
|---|---|
| `reservar()` la publicada con saldo suficiente | reserva `confirmada`, cupo −1, cobro registrado en la misma transacción |
| `reservar()` sin saldo (A) o sin compra (B) | rechazo con el mensaje de la regla |
| Dos `reservar()` concurrentes al último cupo | una entra, la otra "La clase está llena" |
| `cancelar_reserva()` a tiempo y tarde | cupo liberado en ambos; devolución solo en el primero, al lote original (A) o como se haya decidido (B) |
| `update clases set estado = 'cancelada'` | el trigger devuelve todo, sin mirar ventana |
| `anon` consulta `clases` por la API REST | ve la publicada, **no ve el borrador** |
| `crear_especial()` en Diaguitas jueves 20:00 | rechazo por solape con Reggaeton Femme 19:30 |
| Admin llama `editar_especial()` cambiando precio | rechazo; owner sí puede |
| `metricas_*` del período | ocupación y atribución incluyen la especial; `conciliacion` cuadra |

**Checkpoint:** tabla de casos con resultado real al lado del esperado, pegada en PRD §13.

---

## Fase 4 — El formulario de admin y la subida del video

**Archivos:** `app/(admin)/admin/especiales/page.tsx` · `app/(admin)/admin/especiales/[id]/page.tsx`
· `components/FormularioEspecial.tsx` · `app/api/especiales/video/route.ts` · `lib/especiales-consultas.ts`
· acciones en `lib/acciones.ts`

- Formulario mobile-first aunque se use desde computador; mismo patrón que `FormularioSolicitud`.
- La subida pasa por el Route Handler con la service role: valida tipo y tamaño **en el servidor**,
  sube al bucket, guarda `video_url`. Nunca con la llave desde el navegador.
- Vista previa antes de publicar: el mismo componente que verá la visitante.
- Aviso de "hay N reservas" al editar fecha u hora.

**Checkpoint:** en staging, desde el computador, crear una especial con un video real de 20 MB,
guardarla, publicarla y verla en la vista previa. Con rol admin, el campo precio está bloqueado.

---

## Fase 5 — Lo público: lista, página propia y fila en Planes

**Archivos:** `app/clases-especiales/page.tsx` · `app/clases-especiales/[slug]/page.tsx` ·
`app/clases-especiales/[slug]/opengraph-image.tsx` · `components/Especiales.tsx` ·
`components/Planes.tsx` (una fila más) · `app/api/revalidar/route.ts` (revalidar las rutas nuevas)

- Video `muted loop playsInline`, con `poster` de la miniatura, como `Lineup`. En la lista solo
  reproduce el que está en pantalla (`IntersectionObserver`, sin librerías).
- Colores solo de tokens `xo-*`; rosa nunca como texto sobre claro; copy en español de Chile
  desde el lado de la alumna. Cargar `BRAND.md` §7 antes de escribir una sola frase.
- El botón dice lo que pasa: "Reservar por 2 clases de tu pack" (A) o "Reservar · $12.000" (B).
  Nunca "Reservar" a secas cuando hay que pagar aparte.
- La fila en Planes desaparece sola cuando no hay especiales publicadas futuras.

**Checkpoint:** desde un **teléfono real**, sin sesión, en staging: abrir la landing, ver la fila,
llegar a la lista, ver el video, abrir la página propia, pegar el link en WhatsApp y ver la
miniatura.

---

## Fase 6 — Reservar y cancelar desde la interfaz

**Archivos:** `components/Calendario.tsx` (las especiales en el calendario de la alumna, con su
marca) · `components/MisReservas.tsx` · acciones de reservar/cancelar reutilizadas ·
`components/GrillaSemanal.tsx` (título en vez de curso)

**Checkpoint:** el flujo entero, con el artefacto real, en staging:

1. Visitante sin cuenta aprieta Reservar → `/entrar` → **abre el enlace del correo** → vuelve a la
   especial → reserva.
2. Recibe el comprobante por correo y **lo abre**.
3. Cancela desde "Mis clases" y ve lo que le devolvieron.
4. Admin cancela la clase con motivo; la alumna lo ve en "Mis clases".
5. La profesora ve la especial en su grilla y sus inscritas.

---

## Fase 7 — Producción

1. `npm run build` y `npm test` en verde en la rama.
2. `cat supabase/.temp/project-ref` dice producción. `npx supabase db push --dry-run` muestra solo
   esta migración.
3. **`db push` con tu aprobación en ese mensaje.**
4. Cargar el precio real en `parametros`. Crear la primera especial real con Carla.
5. Repetir el checkpoint de la fase 5 contra producción, desde un teléfono.
6. Actualizar PRD §13 y estado, `ROADMAP.md` changelog, `ARCHITECTURE.md` §5.3 (clases sin
   horario) y proponer a Felipe la línea de `CONTEXT.md` §5.b sobre la promesa de los créditos.

---

## Resumen de fases

| Fase | Estado |
|---|---|
| 0 — Decisiones | **Bloqueada** hasta que Felipe cierre PRD §8 y el nombre |
| 1 — Funciones puras y tests | Lista para partir tras la 0 |
| 2 — Migración | Depende de la 0 |
| 3 — Escenario en staging | Depende de la 2 y de aprobación del push a staging |
| 4 — Formulario y video | Depende de la 2 |
| 5 — Público y fila en Planes | Depende de la 4 |
| 6 — Reservar y cancelar | Depende de la 3 y la 5 |
| 7 — Producción | Depende de todo, y de aprobación del push |
