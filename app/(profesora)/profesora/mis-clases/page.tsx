import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";

export const metadata: Metadata = {
  title: "Mis clases — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function MisClases() {
  const perfil = await requiereNivel("profesora", "/profesora/mis-clases");

  return (
    <>
      <TituloPortal
        eyebrow="Portal de profesora"
        titulo="Mis clases"
        bajada="El calendario, la lista de inscritas y las solicitudes de horario llegan con PRD-0006 y PRD-0008. Esta página existe para probar que la protección por rol funciona."
      />

      <p className="text-xo-gris">
        Entraste como <strong className="text-xo-negro">{perfil.nombre ?? perfil.email}</strong>.
        {perfil.profesoraId ? null : (
          <>
            {" "}
            Todavía no estás enlazada a una profesora del catálogo: eso lo hace
            administración.
          </>
        )}
      </p>
    </>
  );
}
