/**
 * La oferta: qué se compra cuando alguien abre un link de compra.
 *
 * **Por qué existe este concepto y no se usa "plan" a secas** (PRD-0020 §8.1):
 * un link tiene que poder ser el de un pack —`/comprar/pack-4`— o el de una
 * promoción —`/comprar/verano-2x1`— sin que la página que lo muestra cambie. Si
 * la URL dijera "plan", mandar el link de una promoción obligaría a escribir
 * otra página, y eso es exactamente lo que Felipe pidió evitar.
 *
 * Hoy toda oferta resuelve a un plan y `slug` coincide con `planSlug`. Cuando
 * lleguen los períodos de PRD-0012 o los códigos de PRD-0013, lo que cambia es
 * **quién resuelve** —`ofertas-consultas.ts`—, no este contrato ni la vitrina.
 *
 * Sin nada de servidor: lo usan componentes cliente. Dinero en enteros CLP.
 */

import type { Plan } from "../planes";

export type Oferta = {
  /** Lo que va en la URL. */
  slug: string;
  /** Cómo se llama en pantalla: el plan, o la promoción si hay una vigente. */
  titulo: string;
  clases: number;
  /** Lo que se cobra hoy, con la promoción ya aplicada. */
  precioClp: number;
  /** El precio de lista, **solo si difiere**: es lo que se tacha. */
  precioNormalClp: number | null;
  /** Hasta cuándo dura esta oferta, en texto legible. `null` si no vence. */
  vigenteHasta: string | null;
  /** Cuántos días duran las clases compradas. */
  vigenciaDias: number;
  /** Qué se compra de verdad. Lo usa el servidor al declarar la transferencia. */
  planSlug: string;
};

/**
 * La oferta que corresponde a un plan del catálogo.
 *
 * `precioNormalClp` queda en `null` cuando la promoción vale lo mismo que la
 * lista: tachar $28.000 y escribir $28.000 al lado se lee como un error del
 * sitio, no como una oferta.
 */
export function ofertaDePlan(plan: Plan): Oferta {
  const vigente = plan.promo ?? plan.precio;
  const hayDescuento = plan.promo !== null && plan.promo !== plan.precio;

  return {
    slug: plan.slug,
    titulo: hayDescuento ? (plan.promoNombre ?? plan.nombre) : plan.nombre,
    clases: plan.clases,
    precioClp: vigente,
    precioNormalClp: hayDescuento ? plan.precio : null,
    vigenteHasta: hayDescuento ? plan.promoHasta : null,
    vigenciaDias: plan.vigenciaDias,
    planSlug: plan.slug,
  };
}

/** Cuánto sale cada clase con esta oferta. */
export function porClaseDeOferta(oferta: Oferta): number {
  if (oferta.clases <= 0) return oferta.precioClp;
  return oferta.precioClp / oferta.clases;
}
