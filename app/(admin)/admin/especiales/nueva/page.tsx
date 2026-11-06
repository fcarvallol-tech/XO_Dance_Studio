import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { FormularioClase } from "@/components/FormularioClase";
import { requiereNivel } from "@/lib/sesion";
import { getOpcionesEspecial } from "@/lib/especiales-admin";
import { getRecuperativas } from "@/lib/recuperativas-consultas";

export const metadata: Metadata = {
  title: "Nueva clase — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function NuevaClase({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string; clase?: string }>;
}) {
  const perfil = await requiereNivel("admin", "admin");
  const [{ categoria, clase }, opciones, recuperativas] = await Promise.all([
    searchParams,
    getOpcionesEspecial(),
    getRecuperativas(),
  ]);

  return (
    <>
      <TituloPortal
        eyebrow="Clases"
        titulo="Nueva"
        bajada="La categoría define con qué paga la alumna y cómo cobra la profesora."
      />

      <Link
        href="/admin/especiales"
        className="xo-eyebrow mb-10 inline-block text-xo-gris underline underline-offset-4"
      >
        ← Todas
      </Link>

      <ErrorDeLectura que="las clases por recuperar" error={recuperativas.error} />

      <FormularioClase
        categoriaInicial={categoria}
        claseInicial={clase}
        porRecuperar={recuperativas.datos.porRecuperar}
        opciones={opciones}
        esOwner={perfil.rol === "owner"}
      />
    </>
  );
}
