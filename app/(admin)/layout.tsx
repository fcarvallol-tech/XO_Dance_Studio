import { Portal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";
import { contarEnviosFallidos } from "@/lib/envios-consultas";
import { contarComprasPendientes } from "@/lib/compras-consultas";

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
  // Segundo argumento: el grupo que cubre este layout, para que el guard no
  // pueda redirigir a una ruta suya. Ver PRD-0004 §12.
  const perfil = await requiereNivel("admin", "admin");
  // Dos llamadas más por página de admin, y se pagan a propósito: son las que
  // hacen que alguien entre a mirar los correos que no salieron (PRD-0019 §3.5)
  // y las transferencias que esperan (PRD-0017 §19). En paralelo, para que
  // cuesten una vuelta y no dos.
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
