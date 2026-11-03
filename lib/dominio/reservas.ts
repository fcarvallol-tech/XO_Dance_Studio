/**
 * Qué ofrece el calendario del portal de alumna en cada clase (PRD-0007 §8).
 *
 * **No valida nada.** Cupos y saldo los valida `reservar()` en la base, en una
 * sola transacción; esto decide qué botón se muestra. Pero un error acá no es
 * inocuo: es dejarla apretar algo que la base le rechaza, o no mostrarle algo
 * que sí puede hacer. Por eso tiene tests.
 */

export type EstadoParaAlumna =
  | "pasada"
  | "reservada"
  | "especial"
  | "llena"
  | "sin-saldo"
  | "reservable";

/**
 * El orden es de precedencia:
 *
 * 0. **Pasada** antes que todo (PRD-0006 §13): ya empezó, así que no se reserva
 *    ni se cancela, aunque haya sido suya. Se ve, pero no se selecciona.
 * 1. **Reservada**: es la que puede cancelar, y si se viera como "llena" o "sin
 *    saldo" no encontraría cómo.
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
  pasada = false,
): EstadoParaAlumna {
  if (pasada) return "pasada";
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

/**
 * Hasta cuántas horas antes de que empiece se cancela recuperando la clase
 * (Felipe, 02/11/2026; antes eran 30 minutos). Después se puede cancelar igual,
 * pero la clase se consume.
 *
 * Quien aplica la regla es `cancelar_reserva()` en la base, con el parámetro
 * `cancelacion_minutos`. Esto es lo que dicen los textos y lo que decide si se
 * le advierte antes de cancelar: si no coinciden, el sitio promete algo que la
 * base no cumple. La migración 20261102150000 deja el parámetro en 720 y lo
 * comprueba.
 */
export const HORAS_PARA_CANCELAR = 12;

export const AVISO_CANCELACION = `Puedes cancelar hasta ${HORAS_PARA_CANCELAR} horas antes y recuperas tu clase.`;

/** Lo mismo que `v_a_tiempo` en `cancelar_reserva()`: estricto, como allá. */
export function cancelaATiempo(inicio: string, ahora: Date): boolean {
  return ahora.getTime() < new Date(inicio).getTime() - HORAS_PARA_CANCELAR * 60 * 60 * 1000;
}
