/**
 * Los packs de clases. Fuente única de precios del sitio público.
 *
 * El precio dejó de ser por curso cuando el negocio pasó a paquetes: es el
 * mismo para todos. Por eso vive acá y no en `cursos.ts`.
 * Ver `context/CONTEXT.md` §5.b.
 */

export type Plan = {
  id: string;
  nombre: string;
  clases: number;
  /** Precio de lista en CLP. Entero, sin decimales ni floats. */
  precio: number;
  /** Precio de la promo vigente, o `null` si ese plan no está en promoción. */
  promo: number | null;
};

export const PLANES: Plan[] = [
  { id: "suelta", nombre: "1 clase", clases: 1, precio: 8500, promo: null },
  { id: "pack-2", nombre: "2 clases", clases: 2, precio: 16000, promo: null },
  { id: "pack-4", nombre: "4 clases", clases: 4, precio: 28000, promo: 20000 },
  { id: "pack-8", nombre: "8 clases", clases: 8, precio: 48000, promo: 36000 },
];

/**
 * La promo de lanzamiento.
 *
 * ⚠️ Se apaga a mano. La landing es estática: sin un deploy nuevo, el 1 de
 * septiembre la promo sigue en pantalla. Poner los `promo` en `null` y borrar
 * este bloque cuando venza. Automatizarlo es justo lo que resuelve PRD-0012,
 * que todavía no existe.
 *
 * El flyer dice "hasta el lunes 31 a las 00:00", que leído literal termina el
 * domingo. Lo confirmado es el **final** del lunes 31, así que acá se escribe
 * "hasta el lunes 31 de agosto" y no se menciona una hora que se presta para
 * confusión. Ver `context/prds/0012-precios-promocionales.md`.
 */
export const PROMO = {
  nombre: "Promo de lanzamiento",
  hasta: "lunes 31 de agosto",
};

/** El valor por clase más barato a precio de lista. Sin contar la promo. */
export const DESDE_POR_CLASE = Math.min(
  ...PLANES.map((plan) => plan.precio / plan.clases),
);

/** Lo que se cobra hoy por ese plan: la promo si la hay, si no la lista. */
export function precioVigente(plan: Plan): number {
  return plan.promo ?? plan.precio;
}

export function porClase(plan: Plan): number {
  return precioVigente(plan) / plan.clases;
}

/**
 * Pesos chilenos: entero, con punto de miles. Sin `toLocaleString` a propósito,
 * para que el servidor y el navegador escriban exactamente lo mismo.
 */
export function clp(monto: number): string {
  return `$${Math.round(monto).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".")}`;
}
