/**
 * Qué ofrece el calendario del portal de alumna en cada clase (PRD-0007 §8).
 *
 * **No valida nada.** Cupos y saldo los valida `reservar()` en la base, en una
 * sola transacción; esto decide qué botón se muestra. Pero un error acá no es
 * inocuo: es dejarla apretar algo que la base le rechaza, o no mostrarle algo
 * que sí puede hacer. Por eso tiene tests.
 */

export type EstadoParaAlumna = "reservada" | "especial" | "llena" | "sin-saldo" | "reservable";

/**
 * El orden es de precedencia:
 *
 * 1. **Reservada** antes que todo: es la que puede cancelar, y si se viera como
 *    "llena" o "sin saldo" no encontraría cómo.
 * 2. **Especial** antes que lo demás: se paga aparte (PRD-0018), así que ni
 *    el saldo ni los lugares del pack dicen nada de ella. Su cupo y su precio
 *    los resuelve su propia página.
 * 3. **Llena** antes que sin saldo: decirle "compra clases" para una clase sin
 *    lugar es mandarla a pagar por algo que igual no va a poder reservar.
 * 4. **Sin saldo**: lo dice en vez de dejarla apretar.
 */
export function estadoParaAlumna(
  clase: { cupoMaximo: number; tomados: number; reservaId: string | null; especial: unknown },
  saldo: number,
): EstadoParaAlumna {
  if (clase.reservaId !== null) return "reservada";
  if (clase.especial) return "especial";
  if (clase.tomados >= clase.cupoMaximo) return "llena";
  if (saldo <= 0) return "sin-saldo";
  return "reservable";
}

export type Destaque = "normal" | "destacada" | "atenuada";

/** Con una profesora elegida, la suya se destaca y el resto se atenúa. */
export function destaque(profesoraSlug: string, filtro: string | null): Destaque {
  if (filtro === null) return "normal";
  return profesoraSlug === filtro ? "destacada" : "atenuada";
}
