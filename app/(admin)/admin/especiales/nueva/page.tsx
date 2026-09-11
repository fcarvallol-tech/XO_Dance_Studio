import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { FormularioEspecial } from "@/components/FormularioEspecial";
import { requiereNivel } from "@/lib/sesion";
import { getOpcionesEspecial } from "@/lib/especiales-admin";

export const metadata: Metadata = {
  title: "Nueva clase especial — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function NuevaEspecial() {
  const perfil = await requiereNivel("admin", "admin");
  const opciones = await getOpcionesEspecial();

  return (
    <>
      <TituloPortal
        eyebrow="Clases especiales"
        titulo="Nueva"
        bajada="Se guarda como borrador. Después le subes la portada, miras la vista previa y recién ahí la publicas."
      />

      <Link
        href="/admin/especiales"
        className="xo-eyebrow mb-10 inline-block text-xo-gris underline underline-offset-4"
      >
        ← Todas
      </Link>

      <FormularioEspecial
        especial={null}
        opciones={opciones}
        esOwner={perfil.rol === "owner"}
      />
    </>
  );
}
