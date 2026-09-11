import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TituloPortal } from "@/components/Portal";
import { FormularioEspecial } from "@/components/FormularioEspecial";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { getEspecialAdmin, getOpcionesEspecial } from "@/lib/especiales-admin";

export const metadata: Metadata = {
  title: "Editar clase especial — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function EditarEspecial({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const perfil = await requiereNivel("admin", "admin");
  const { id } = await params;
  const [especial, opciones] = await Promise.all([
    getEspecialAdmin(id),
    getOpcionesEspecial(),
  ]);

  if (!especial.error && !especial.datos) notFound();

  return (
    <>
      <TituloPortal
        eyebrow="Clases especiales"
        titulo={especial.datos?.titulo ?? "Clase especial"}
        bajada={
          especial.datos?.publicada
            ? "Publicada. Lo que cambies acá se ve en el sitio en cuanto guardes."
            : "Borrador: no se ve en ninguna parte todavía."
        }
      />

      <Link
        href="/admin/especiales"
        className="xo-eyebrow mb-10 inline-block text-xo-gris underline underline-offset-4"
      >
        ← Todas
      </Link>

      <ErrorDeLectura que="esta clase especial" error={especial.error} />

      {especial.datos ? (
        <FormularioEspecial
          especial={especial.datos}
          opciones={opciones}
          esOwner={perfil.rol === "owner"}
        />
      ) : null}
    </>
  );
}
