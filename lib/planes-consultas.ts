import { clientePublico } from "./supabase/publico";
import { fechaLegible, type Plan } from "./planes";

/**
 * Los planes, desde la base. **Solo servidor.**
 *
 * Va con el cliente público, sin cookies, para que la sección Planes de la
 * landing siga siendo estática. Mismo criterio que el catálogo.
 */

type Fila = {
  slug: string;
  nombre: string;
  cantidad_clases: number;
  precio_clp: number;
  precio_promocional: number | null;
  promo_hasta: string | null;
  promo_nombre: string | null;
  vigencia_dias: number;
};

export async function getPlanes(): Promise<Plan[]> {
  const supabase = clientePublico();

  const { data, error } = await supabase
    .from("planes")
    .select(
      "slug, nombre, cantidad_clases, precio_clp, precio_promocional, promo_hasta, promo_nombre, vigencia_dias",
    )
    .order("orden");

  if (error) {
    throw new Error(
      `No se pudo leer los planes: ${error.message}. Falta aplicar las ` +
        "migraciones de supabase/migrations/ con `supabase db push`.",
    );
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (data as Fila[]).map((fila) => {
    // La promo se apaga sola al pasar la fecha. Que además haya que editarla
    // en el Table Editor es opcional, no un requisito para que deje de verse.
    const vigente =
      fila.precio_promocional !== null &&
      fila.promo_hasta !== null &&
      fila.promo_hasta >= hoy;

    return {
      slug: fila.slug,
      nombre: fila.nombre,
      clases: fila.cantidad_clases,
      precio: fila.precio_clp,
      promo: vigente ? fila.precio_promocional : null,
      promoNombre: vigente ? fila.promo_nombre : null,
      promoHasta: vigente && fila.promo_hasta ? fechaLegible(fila.promo_hasta) : null,
      vigenciaDias: fila.vigencia_dias,
    };
  });
}
