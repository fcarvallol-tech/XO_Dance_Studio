/**
 * De dónde sale la URL pública del sitio, en orden.
 *
 * El fallback a localhost solo, sin la variable puesta, dejó el Open Graph roto
 * 18 días sin que nadie se enterara. `VERCEL_PROJECT_PRODUCTION_URL` es
 * variable de sistema y siempre está en Vercel, así que el peor caso pasa de
 * "URL inválida en producción" a "el dominio de Vercel en vez del propio".
 *
 * Se descartan las cadenas vacías: una variable creada y sin valor es
 * exactamente el escenario del incidente, y `??` la dejaría pasar.
 */
export function sitio(): string {
  const propio = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (propio) return propio;

  // Viene sin protocolo, por diseño de Vercel.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}
