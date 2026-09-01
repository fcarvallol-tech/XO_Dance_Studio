/**
 * Tipos y formato de los packs de clases.
 *
 * **Los precios ya no están acá.** Viven en la tabla `planes` desde PRD-0017
 * parte 2, porque tenerlos en el código y en la base a la vez es tener dos
 * fuentes del mismo dato — que es exactamente como se produjo la incoherencia
 * del catálogo en agosto. Las consultas están en `planes-consultas.ts`.
 *
 * Este archivo no importa nada de servidor: lo usan componentes cliente.
 */

export type Plan = {
  slug: string;
  nombre: string;
  clases: number;
  /** Precio de lista en CLP. Entero, sin decimales ni floats. */
  precio: number;
  /** Precio promocional vigente, o `null` si no hay o ya venció. */
  promo: number | null;
  /** Cómo se llama la promoción, si hay una vigente. */
  promoNombre: string | null;
  /** Hasta cuándo, en texto ya legible: "lunes 31 de agosto". */
  promoHasta: string | null;
  vigenciaDias: number;
};

/** Lo que se cobra hoy por ese plan: la promo si la hay, si no la lista. */
export function precioVigente(plan: Plan): number {
  return plan.promo ?? plan.precio;
}

export function porClase(plan: Plan): number {
  return precioVigente(plan) / plan.clases;
}

/** El valor por clase más barato a precio de lista. Sin contar promociones. */
export function desdePorClase(planes: Plan[]): number {
  if (planes.length === 0) return 0;
  return Math.min(...planes.map((plan) => plan.precio / plan.clases));
}

export function hayPromo(planes: Plan[]): boolean {
  return planes.some((plan) => plan.promo !== null);
}

/** El nombre de la promoción vigente, si todos los que la tienen comparten uno. */
export function nombrePromo(planes: Plan[]): string | null {
  return planes.find((plan) => plan.promo !== null)?.promoNombre ?? null;
}

export function hastaPromo(planes: Plan[]): string | null {
  return planes.find((plan) => plan.promo !== null)?.promoHasta ?? null;
}

/**
 * Pesos chilenos: entero, con punto de miles. Sin `toLocaleString` a propósito,
 * para que el servidor y el navegador escriban exactamente lo mismo.
 */
export function clp(monto: number): string {
  return `$${Math.round(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * "lunes 31 de agosto". Sin hora, a propósito: nombrar una hora en un aviso
 * comercial solo invita a discutir si alcanzó. Ver PRD-0012.
 */
export function fechaLegible(iso: string): string {
  const [anio, mes, dia] = iso.split("-").map(Number);
  // Mediodía UTC para que el desfase horario no corra el día.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia, 12));
  return `${DIAS[fecha.getUTCDay()]} ${dia} de ${MESES[mes - 1]}`;
}
