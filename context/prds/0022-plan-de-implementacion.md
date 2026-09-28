# Plan de implementación — PRD-0022 De una landing a un sitio

> El PRD dice **qué** y **por qué**. Esto dice **en qué orden** y **cómo se sabe que cada paso quedó
> bien**. Se lee junto a `0022-sitio-con-paginas-propias.md`.
>
> Se trabaja sobre `main`, como los últimos tres PRD. Nada de esto toca la base: **no hay
> migraciones**, así que no hay nada que aplicar ni aprobar hasta el despliegue.
>
> **Estado: propuesta.** §8.6 bloquea la fase 1.

---

## Fase 0 — Una decisión que falta

| # | Decisión | Estado |
|---|---|---|
| 1 | Ayuda es página propia, con lo legal enlazado | ✅ Felipe, 28/09 |
| 2 | Las sedes dentro de Nosotros, sin ser el tema | ✅ Felipe, 28/09 |
| 3 | Calendario sin sesión | ✅ Felipe, 28/09 |
| 4 | Portada mínima | ✅ Felipe, 28/09 |
| 5 | El logo sobresale, a la izquierda | ✅ Felipe, 28/09 |
| 6 | 🔴 **¿Qué pasa con la captación de leads?** | **Falta.** PRD §8.6 |

**Por qué la 6 bloquea:** decide si la portada lleva un formulario de 424 líneas, si nace
`/clase-de-prueba`, o si se retira una pieza entera del sitio —y en ese caso hay que actualizar
`CLAUDE.md`, que declara la captación como **el** objetivo del sitio público—. Las tres salidas dan
portadas distintas, así que la fase 1 no puede empezar sin eso.

⚠️ **Dos textos que no puedo escribir yo**, y que conviene ir pidiendo desde ya porque no bloquean
las fases pero sí el despliegue: el de **Nosotros** (§8.2) y tres **preguntas frecuentes** (§8.1,
las marcadas ⚠️). Van con relleno evidente hasta que lleguen.

---

## El orden no es arbitrario

- **La barra y el pie van primero**, antes que cualquier página nueva. Son lo único que toca
  **todas** las páginas: hacerlos al final significa tocar cada página dos veces.
- **Mover antes que crear.** Profesoras, sedes y cursos ya existen como componentes que funcionan.
  Primero se mudan tal cual a su página —cambia el contenedor, no el contenido— y recién después se
  escribe lo que no existe. Así, si algo se rompe, se sabe que fue la mudanza.
- **La portada se vacía al final.** Mientras las páginas nuevas no existan, quitar secciones de la
  portada deja contenido sin ningún lugar donde vivir.
- **El calendario público al final de lo funcional**, porque es el único que **cambia
  comportamiento** —una ruta que hoy exige sesión pasa a ser pública— y eso toca `lib/rutas.ts`,
  que es la pieza que ya produjo un bucle de redirección.

Y la regla que hereda todo este plan: **abrir cada ruta privada sin sesión y ver a dónde llega**,
no dar por buena una compilación (PRD-0020).

---

## Fase 1 — La cabecera nueva, con el logo que sobresale

**Archivos:** `components/BarraSitio.tsx` (nuevo) · `components/MenuMovil.tsx` (nuevo) ·
`components/Footer.tsx` · `lib/navegacion.ts` (nuevo)

- `lib/navegacion.ts`: los seis enlaces en un solo lugar, para que la barra, el pie y el menú móvil
  no se puedan desincronizar.
- La barra: logo sobresaliendo a la izquierda, seis enlaces al centro, **Mi Cuenta** a la derecha.
- **El contenido arranca debajo del logo, no de la barra.** Se resuelve con el espaciado del
  contenedor, no con un `margin` puesto a mano en cada página.
- **Móvil**: menú desplegable. El logo se achica sin dejar de sobresalir.
- `Mi Cuenta` apunta a `/entrar`, que ya manda a cada rol a su inicio si hay sesión.

**Checkpoint:** con Chromium a **375, 768 y 1280**: el logo sobresale y no tapa el primer texto de
la página; los seis enlaces se alcanzan; "Mi Cuenta" también; y **no hay scroll horizontal** en
ninguno de los tres anchos.

---

## Fase 2 — Nuestras Profes y Nosotros: mudar lo que ya existe

**Archivos:** `app/nuestras-profes/page.tsx` · `app/nosotros/page.tsx`

- `Lineup` y `Sedes` se mudan **tal cual**. Lo que cambia es el contenedor.
- `Nosotros` recibe el texto de qué transmitimos y qué nos motiva —provisional y evidente hasta que
  llegue— y las sedes **abajo, como dato**, con sus tres direcciones.
- Las dos son estáticas con revalidación, como el resto del catálogo.

**Checkpoint:** las dos páginas se ven sin sesión, las cinco profesoras llevan a su perfil, y las
**tres** sedes aparecen con dirección.

---

## Fase 3 — Ayuda

**Archivos:** `app/ayuda/page.tsx` · `lib/ayuda.ts` (las preguntas, en código)

- Preguntas frecuentes: las doce de §8.1, con las tres de Felipe marcadas como provisionales.
- Contacto: WhatsApp e Instagram, que ya están en `lib/contacto.ts`.
- **Reclamos**: cómo se hace uno y qué esperar. ⚠️ Necesita el compromiso de respuesta de Felipe
  —"te contestamos en X días"— o va sin plazo.
- Enlaces a `/privacidad` y `/terminos`, sin duplicar el texto.

**Checkpoint:** las respuestas que salen del proyecto coinciden con lo que hace el sistema. Las que
dependen de Felipe se ven **evidentemente** provisionales.

---

## Fase 4 — El calendario público

**Archivos:** `app/calendario/page.tsx` · `app/(cuenta)/reservar/[id]/page.tsx` ·
`lib/compras-consultas.ts` · `lib/rutas.ts`

Es la fase con riesgo, y por eso va sola:

1. `getCalendarioPublico(dias)`: la misma consulta sin `perfilId` y sin "ya reservaste esta".
2. `/calendario` público, con horarios, profesora, sede y cupos. **Sin datos de nadie.**
3. **`/reservar/<id>`**, con sesión: la clase concreta, para que `?volver=` devuelva a la clase y no
   al calendario. Mismo patrón que `/reservar-especial/<slug>` y `/transferir/<oferta>`.
4. `lib/rutas.ts`: `/reservar` sigue exigiendo sesión y `/calendario` no. **Ojo:** el guard compara
   por prefijo, así que hay que verificar que `/calendario` no quede cubierto por nada.

**Checkpoint, el de PRD-0020 y no otro:** se abre **cada** ruta privada sin sesión y se mira a
dónde llega; se abre cada pública y se confirma que responde 200; y se recorre con Chromium el
camino entero —calendario sin sesión → Reservar → entrar con el enlace del correo → **volver a esa
clase** → reservar—.

---

## Fase 5 — La portada mínima y los enlaces viejos

**Archivos:** `app/page.tsx` · `app/comprar/page.tsx` · redirecciones

- La portada queda con el hero y los packs. Lo demás sale.
- **Las anclas viejas redirigen**: `/#planes` → `/comprar`, `/#profesoras` → `/nuestras-profes`,
  `/#cursos` → `/calendario`, `/#sedes` → `/nosotros`.
  ⚠️ **Una ancla no llega al servidor**: el navegador no manda lo que va después del `#`. Así que
  esto **no se puede resolver con una redirección de servidor**; hay que dejar en la portada un
  componente cliente que lea `location.hash` y redirija. Es feo y es la única forma.
- Lo que resuelva §8.6 se aplica acá.

**Checkpoint:** `/#planes` termina en los packs; la portada no tiene profesoras, sedes ni cursos; y
el hero sigue siendo lo primero.

---

## Fase 6 — Repasar el sitio entero

No es relleno: es donde aparece lo que cada fase no podía ver sola.

- Las tres cabeceras viejas —`Barra`, `CabeceraPublica` y la del perfil de profesora— reemplazadas
  por una.
- Las ocho páginas públicas a 375 y 1280, con Chromium: sin scroll horizontal, el logo sin tapar
  nada, la barra igual en todas.
- Ninguna referencia muerta a componentes o rutas que se movieron.
- `npm run build` y `npm test`.

---

## Fase 7 — Producción

1. Todo en verde.
2. **Parar y avisar.** El despliegue cambia el sitio público entero: no va sin que Felipe lo mire
   primero en local o en un preview.
3. Actualizar `ARCHITECTURE.md` §3 (la estructura de rutas) y `ROADMAP.md`.
4. ⚠️ **Antes de publicar**: los textos de Nosotros y las tres preguntas frecuentes tienen que
   estar. Publicar con relleno es peor que no publicar.

---

## Resumen de fases

| Fase | Estado |
|---|---|
| 0 — Decisiones | ✅ Cerrada el 28/09. Camino **C**: la captación se retira y el objetivo del sitio cambia |
| 1 — Cabecera y logo | ✅ `MarcoSitio`, `BarraSitio` y `lib/navegacion.ts` |
| 2 — Nuestras Profes y Nosotros | ✅ Con el borrador de Nosotros marcado en pantalla |
| 3 — Ayuda | ✅ Doce preguntas, contacto, reclamos y lo legal enlazado |
| 4 — Calendario público | ✅ `/calendario` sin sesión y `/reservar/<id>` |
| 5 — Portada mínima y enlaces viejos | ✅ Y la captación retirada entera |
| 6 — Repaso | ✅ **19/19** con Chromium en tres anchos |
| 7 — Producción | ⏸ **Espera a Felipe**: su visto bueno y dos textos suyos |
