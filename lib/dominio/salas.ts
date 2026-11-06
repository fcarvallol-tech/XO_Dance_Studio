/**
 * Lo que se calcula de una sala arrendada (PRD-0027 §7.5). La comparación por
 * dirección vive en la base, en `direccion_comparable()`, para que la regla
 * exista en un solo lugar.
 */

/** Lo que devuelve `crear_sala_ocasional()`. Sin costo, a propósito. */
export type SalaCreada = {
  /** `false`: la dirección ya existía y esta es la sala que hay que ofrecer. */
  creada: boolean;
  id: string;
  nombre: string;
  direccion: string;
  comuna: string;
  capacidad: number;
  ocasional: boolean;
};

/** Cuánto cuesta la sala en esa clase: el precio es por hora, como la columna. */
export function costoDeSalaEnClase(costoHoraClp: number, duracionMin: number): number {
  return Math.round((costoHoraClp * duracionMin) / 60);
}
