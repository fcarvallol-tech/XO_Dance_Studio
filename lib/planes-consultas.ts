import { clientePublico } from "./supabase/publico";
import { fechaLegible, type Plan } from "./planes";
import { promoVigente } from "./dominio/ofertas";
import { hoyEnSantiago } from "./semana";

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
  // Un minuto y no la hora del resto del catálogo: un precio que dura un día
  // —la preventa del 03/11/2026— no puede tardar una hora en aparecer, ni el
  // precio de lista en volver. Pasó en el primer ensayo: la página siguió
  // mostrando $28.000 con la preventa ya cargada, por la caché de datos.
  const supabase = clientePublico({ revalidarSegundos: 60 });

  const { data, error } = await supabase
    .from("planes")
    .select(
      "slug, nombre, cantidad_clases, precio_clp, precio_promocional, promo_hasta, promo_nombre, vigencia_dias",
    )
    // Defensa en profundidad: la política de `planes` ya filtra
    // `activo and deleted_at is null` para anon, y la consulta lo filtra igual.
    // Confiar solo en RLS deja el sistema a merced de haber razonado bien sobre
    // la composición de políticas, que en este proyecto ya falló una vez.
    .eq("activo", true)
    .is("deleted_at", null)
    .order("orden");

  if (error) {
    throw new Error(
      `No se pudo leer los planes: ${error.message}. Falta aplicar las ` +
        "migraciones de supabase/migrations/ con `supabase db push`.",
    );
  }

  // El día en Santiago, no en UTC: ver `promoVigente`.
  const hoy = hoyEnSantiago();

  return (data as Fila[]).map((fila) => {
    // La promo se apaga sola al pasar la fecha. Que además haya que editarla
    // en el Table Editor es opcional, no un requisito para que deje de verse.
    const vigente = promoVigente(fila.precio_promocional, fila.promo_hasta, hoy);

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
