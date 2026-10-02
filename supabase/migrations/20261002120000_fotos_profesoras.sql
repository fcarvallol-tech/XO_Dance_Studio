-- Las fotos de las cuatro profesoras activas.
--
-- Qué resuelve: las páginas de profesoras mostraban un placeholder porque
-- `foto_url` estaba vacío en las cinco filas. Las fotos llegaron el 02/10/2026,
-- se recortaron todas al mismo encuadre 4:5 con `scripts/fotos-profesoras.mjs`
-- y viven en `public/profesoras/<slug>.webp`, así que la URL es una ruta del
-- propio sitio y no un bucket.
--
-- Maida no va: está inactiva desde que K-Pop salió del catálogo.
--
-- Idempotente: se puede volver a correr sin daño.

update public.profesoras
set foto_url = '/profesoras/' || slug || '.webp',
    updated_at = now()
where slug in ('carli', 'pau', 'drimy', 'lina')
  and foto_url is distinct from '/profesoras/' || slug || '.webp';
