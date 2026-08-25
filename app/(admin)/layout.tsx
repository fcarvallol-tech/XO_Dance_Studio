import { Portal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";

/**
 * Grupo (admin): nivel admin o más.
 *
 * `requiereNivel("admin")` deja pasar a `owner` sin nombrarlo: es el mismo
 * criterio aritmético que usa `tiene_nivel('admin')` en las políticas RLS.
 */
/**
 * Nada de esto se prerenderiza: depende de quién pide la página. Explícito y
 * no deducido del uso de cookies(), para que no vuelva a caerse el build si
 * alguien reordena una llamada.
 */
export const dynamic = "force-dynamic";

export default async function LayoutAdmin({
  children,
}: {
  children: React.ReactNode;
}) {
  const perfil = await requiereNivel("admin");
  return <Portal perfil={perfil}>{children}</Portal>;
}
