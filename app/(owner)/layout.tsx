import { Portal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";
import { contarEnviosFallidos } from "@/lib/envios-consultas";
import { contarComprasPendientes } from "@/lib/compras-consultas";

/** Grupo (owner): lo único que no ve admin. Métricas y plata. */
/**
 * Nada de esto se prerenderiza: depende de quién pide la página. Explícito y
 * no deducido del uso de cookies(), para que no vuelva a caerse el build si
 * alguien reordena una llamada.
 */
export const dynamic = "force-dynamic";

export default async function LayoutOwner({
  children,
}: {
  children: React.ReactNode;
}) {
  // Segundo argumento: el grupo que cubre este layout, para que el guard no
  // pueda redirigir a una ruta suya. Ver PRD-0004 §12.
  const perfil = await requiereNivel("owner", "owner");
  // Los mismos contadores que en admin: el menú de owner incluye el de
  // administración, y un número que aparece en unas páginas y desaparece en
  // otras se lee como "ya no hay nada" (PRD-0017 §19).
  const [correosFallidos, transferenciasPendientes] = await Promise.all([
    contarEnviosFallidos(),
    contarComprasPendientes(),
  ]);
  return (
    <Portal
      perfil={perfil}
      correosFallidos={correosFallidos}
      transferenciasPendientes={transferenciasPendientes}
    >
      {children}
    </Portal>
  );
}
