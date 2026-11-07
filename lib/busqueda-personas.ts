/**
 * Búsqueda del listado de Personas (PRD-0025), sin dependencias: la usa la
 * página de administración y la prueban los tests de `node --test`.
 *
 * El texto llega de la URL y termina dentro de un `or=(…)` de PostgREST, así
 * que pasa por dos escapes, en este orden:
 *
 * 1. **LIKE**: `\`, `%` y `_` se escapan con `\` para que se busquen como
 *    letras y no como comodines.
 * 2. **PostgREST**: el valor va entre comillas dobles —así `,`, `.`, `:` y los
 *    paréntesis no se leen como sintaxis del filtro— y dentro de ellas `\` y
 *    `"` se escapan con `\`.
 *
 * El `*` no se puede escapar: PostgREST lo convierte en `%` antes de llegar a
 * Postgres. Se saca de la búsqueda; ningún nombre ni correo lo necesita.
 */

export const LARGO_MAXIMO_BUSQUEDA = 100;

/** Lo que vino en `?q=`, listo para buscar, o `null` si no hay nada que buscar. */
export function normalizarBusqueda(valor: string | string[] | null | undefined): string | null {
  const crudo = Array.isArray(valor) ? valor[0] : valor;
  if (typeof crudo !== "string") return null;
  const limpio = crudo.replaceAll("*", "").trim().slice(0, LARGO_MAXIMO_BUSQUEDA).trim();
  return limpio === "" ? null : limpio;
}

/** `%texto%`, con los comodines de LIKE escapados. */
export function patronLike(texto: string): string {
  return `%${texto.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

function entreComillas(valor: string): string {
  return `"${valor.replace(/[\\"]/g, (c) => `\\${c}`)}"`;
}

/** El argumento de `.or()`: nombre o correo contienen el texto, sin importar mayúsculas. */
export function filtroDePersonas(texto: string): string {
  const valor = entreComillas(patronLike(texto));
  return `nombre.ilike.${valor},email.ilike.${valor}`;
}
