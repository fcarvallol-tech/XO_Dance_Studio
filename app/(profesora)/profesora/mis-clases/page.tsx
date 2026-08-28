import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { requiereNivel } from "@/lib/sesion";
import { nombreDe } from "@/lib/catalogo";
import { getCatalogoCompleto } from "@/lib/catalogo-consultas";

export const metadata: Metadata = {
  title: "Mis clases — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function MisClases() {
  const perfil = await requiereNivel("profesora", "profesora");

  // El rol `profesora` no puede existir sin identidad: lo garantiza el check
  // `perfiles_profesora_con_identidad`. Un admin o un owner sí llegan acá sin
  // profesora_id, porque entran por jerarquía sin hacer clases.
  const { profesoras } = await getCatalogoCompleto();
  const enElCatalogo = nombreDe(profesoras, perfil.profesoraId);

  return (
    <>
      <TituloPortal
        eyebrow="Portal de profesora"
        titulo="Mis clases"
        bajada="El calendario, la lista de inscritas y las solicitudes de horario llegan con PRD-0006 y PRD-0008. Esta página existe para probar que la protección por rol funciona."
      />

      <p className="text-xo-gris">
        Entraste como <strong className="text-xo-negro">{perfil.nombre ?? perfil.email}</strong>
        {enElCatalogo ? (
          <>
            , enlazada a <strong className="text-xo-negro">{enElCatalogo}</strong> en
            el catálogo.
          </>
        ) : (
          "."
        )}
      </p>
    </>
  );
}
