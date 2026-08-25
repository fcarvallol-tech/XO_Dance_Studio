import { Portal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";

/** Grupo (profesora): nivel profesora o más. Admin y owner entran por jerarquía. */
/**
 * Nada de esto se prerenderiza: depende de quién pide la página. Explícito y
 * no deducido del uso de cookies(), para que no vuelva a caerse el build si
 * alguien reordena una llamada.
 */
export const dynamic = "force-dynamic";

export default async function LayoutProfesora({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segundo argumento: el grupo que cubre este layout, para que el guard no
  // pueda redirigir a una ruta suya. Ver PRD-0004 §12.
  const perfil = await requiereNivel("profesora", "profesora");
  return <Portal perfil={perfil}>{children}</Portal>;
}
