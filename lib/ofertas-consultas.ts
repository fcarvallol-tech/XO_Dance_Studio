import { ofertaDePlan, type Oferta } from "./dominio/ofertas";
import { getPlanes } from "./planes-consultas";

/**
 * Qué se compra con un link de compra. **Solo servidor.**
 *
 * Es la única pieza que hay que cambiar cuando una oferta deje de ser siempre un
 * plan: si mañana `/comprar/verano-2x1` sale de una tabla de promociones
 * (PRD-0012) o de un código (PRD-0013), se resuelve acá y **ni la vitrina ni el
 * paso de transferir se tocan** (PRD-0020 §8.1).
 *
 * Va con el cliente público, sin cookies, para que `/comprar` y
 * `/comprar/<oferta>` se sigan prerenderizando: son páginas de catálogo y no
 * muestran datos de nadie.
 */

export async function getOfertas(): Promise<Oferta[]> {
  return (await getPlanes()).map(ofertaDePlan);
}

/**
 * La oferta de ese slug, o `null` si no existe. `null` termina en un 404 con
 * salida a todos los planes, no en una página con un precio en blanco.
 */
export async function resolverOferta(slug: string): Promise<Oferta | null> {
  const limpio = slug.trim().toLowerCase();
  return (await getOfertas()).find((oferta) => oferta.slug === limpio) ?? null;
}
