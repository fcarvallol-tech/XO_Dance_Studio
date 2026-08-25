import { Portal } from "@/components/Portal";
import { requiereSesion } from "@/lib/sesion";

/**
 * Grupo (cuenta): cualquiera con sesión.
 *
 * Acá está la autorización de verdad. El proxy solo hizo un chequeo optimista
 * leyendo la cookie; esto verifica contra el servidor con getClaims y lee el
 * perfil pasando por RLS.
 *
 * El `"cuenta"` no es decorativo: le dice al guard qué rutas cubre este layout,
 * para que no pueda redirigir hacia adentro de sí mismo. Ver PRD-0004 §12.
 */
/**
 * Nada de esto se prerenderiza: depende de quién pide la página. Explícito y
 * no deducido del uso de cookies(), para que no vuelva a caerse el build si
 * alguien reordena una llamada.
 */
export const dynamic = "force-dynamic";

export default async function LayoutCuenta({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requiereSesion("cuenta");
  return <Portal perfil={perfil}>{children}</Portal>;
}
