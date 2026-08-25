import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Métricas — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function Metricas() {
  await requiereNivel("owner", "owner");

  return (
    <>
      <TituloPortal
        eyebrow="Portal de dueña"
        titulo="Métricas"
        bajada="Lo único que un admin no ve. El dashboard es PRD-0010; por ahora esta página solo prueba que el nivel owner se distingue del de admin."
      />
    </>
  );
}
