# Assets

Material **crudo**: fotos y videos tal como llegan, en su resolución original. **No se sirve**:
nada de esta carpeta llega al sitio.

Lo que se publica vive en `public/`, **ya comprimido**. El camino es siempre de acá hacia allá:
se toma el original de `Assets/`, se comprime y la versión liviana se deja en `public/`.

| Carpeta | Qué va |
|---|---|
| `Logos/` | El logo en su versión original |
| `Fotos/profesoras/` | Fotos de las profesoras. **Está en `.gitignore`**: no sube a git y no viaja entre computadores |
| `Videos/originales/` | Videos sin comprimir. **Está en `.gitignore`**: no sube a git y no viaja entre computadores |

**Los originales de fotos y videos viven fuera del repo**, y no es por peso: **el repositorio es
público**, y son fotos de personas reales en alta resolución. Lo que sí está en git es lo que el
sitio ya publica, recortado y comprimido en `public/`. Para pasarlos de un computador a otro se usa
otra vía (Drive, un disco), no git.

Las fotos de profesoras se publican con `node scripts/fotos-profesoras.mjs`, que toma de acá y deja
en `public/profesoras/`. Las medidas de cada foto están anotadas en el script: si se cambia un
original, hay que volver a medirlo.

Sin stock photos. Menores identificables, solo con autorización firmada confirmada.
