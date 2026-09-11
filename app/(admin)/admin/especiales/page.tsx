import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { clp } from "@/lib/planes";
import { getEspecialesAdmin } from "@/lib/especiales-admin";

export const metadata: Metadata = {
  title: "Clases especiales — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Todas las especiales, borradores incluidos. Lo público solo muestra publicadas. */
export default async function EspecialesAdmin() {
  await requiereNivel("admin", "admin");
  const especiales = await getEspecialesAdmin();

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Clases especiales"
        bajada="Coreografías puntuales, fuera de la parrilla. Se crean una a una, se guardan como borrador y se publican cuando tienen Reel y portada."
      />

      <Link
        href="/admin/especiales/nueva"
        className="xo-eyebrow inline-block rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
      >
        Nueva clase especial
      </Link>

      <ErrorDeLectura que="las clases especiales" error={especiales.error} />

      {especiales.error ? null : especiales.datos.length === 0 ? (
        <p className="mt-10 text-xo-gris">Todavía no hay ninguna.</p>
      ) : (
        <ul className="mt-10 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {especiales.datos.map((especial) => (
            <li key={especial.id} className="flex flex-wrap justify-between gap-4 py-4">
              <div>
                <Link
                  href={`/admin/especiales/${especial.id}`}
                  className="font-semibold text-xo-negro underline-offset-4 hover:underline"
                >
                  {especial.titulo}
                </Link>
                <p className="mt-1 text-sm text-xo-gris">
                  {cuandoLegible(especial.inicio)} · {especial.profesora} ·{" "}
                  {especial.sede}
                  {especial.precioClp !== null ? ` · ${clp(especial.precioClp)}` : ""}
                </p>
              </div>
              <p className="xo-eyebrow self-center text-xo-gris">
                {especial.estado === "cancelada"
                  ? "Cancelada"
                  : especial.publicada
                    ? "Publicada"
                    : "Borrador"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
