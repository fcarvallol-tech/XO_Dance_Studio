/**
 * Qué clases caídas quedan por recuperar (PRD-0027). Sin dependencias de
 * servidor: la lista la arma `recuperativas-consultas.ts`, las reglas viven acá.
 */

import type { Causa } from "./liquidacion.ts";

/** Hasta dónde mira la pantalla. Una clase caída hace más de dos meses ya no se recupera. */
export const DIAS_HACIA_ATRAS = 60;

/**
 * Las que faltan por recuperar: las que no tienen una recuperativa en pie.
 *
 * `cambio_de_parrilla` no se ofrece: esa clase nunca estuvo en su semana y no
 * hay nada que recuperar (CONTEXT.md §5.b, decisión 1). Una sin causa sí se
 * ofrece, porque todavía no se sabe por qué cayó.
 */
export function porRecuperar<T extends { id: string; causa: Causa | null }>(
  caidas: T[],
  vivas: { recuperaClaseId: string }[],
): T[] {
  const recuperadas = new Set(vivas.map((v) => v.recuperaClaseId));
  return caidas.filter((c) => c.causa !== "cambio_de_parrilla" && !recuperadas.has(c.id));
}

/**
 * Cuántas ya no pueden reservar con la clase que se les devolvió.
 *
 * `reservar()` mira el vencimiento **al reservar**, no la fecha de la clase: una
 * clase del 10 se puede reservar el 2 con un lote que vence el 3. Lo que corta es
 * que el lote ya haya vencido hoy, y esa alumna necesita que se le regale la
 * clase, porque el correo le va a decir que la tiene de vuelta.
 */
export function conCreditoVencido(afectadas: { vence: string }[], ahora: Date): number {
  return afectadas.filter((a) => new Date(a.vence).getTime() <= ahora.getTime()).length;
}
