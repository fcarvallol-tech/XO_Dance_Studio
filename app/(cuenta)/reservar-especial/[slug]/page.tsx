import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { FormularioReservaEspecial } from "@/components/FormularioReservaEspecial";
import { requiereSesion } from "@/lib/sesion";
import { getDatosTransferencia } from "@/lib/compras-consultas";
import { getEspecialPorSlug } from "@/lib/especiales-consultas";
import { cuandoLegible } from "@/lib/compras";

export const metadata: Metadata = {
  title: "Reservar clase especial — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * Reservar una especial. Quien llega sin sesión pasa por `/entrar` con
 * `?volver=` puesto por el proxy y vuelve **a esta misma clase**.
 */
export default async function ReservarEspecial({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  await requiereSesion("cuenta");
  const { slug } = await params;

  const [dato, transferencia] = await Promise.all([
    getEspecialPorSlug(slug),
    getDatosTransferencia(),
  ]);

  if (!dato) notFound();
  const { especial, lugaresLibres } = dato;

  return (
    <>
      <TituloPortal
        eyebrow="Clase especial"
        titulo={especial.titulo}
        bajada={`${cuandoLegible(especial.inicio)} · con ${especial.profesora} · ${especial.sede}, ${especial.comuna}`}
      />

      <ErrorDeLectura que="los datos de transferencia" error={transferencia.error} />

      {lugaresLibres <= 0 ? (
        <div className="max-w-xl border-l-2 border-xo-negro pl-5">
          <p className="text-lg leading-relaxed text-xo-negro">
            Esta clase se llenó mientras mirabas.
          </p>
          <p className="mt-4 leading-relaxed text-xo-gris">
            No alcanzamos a guardarte el cupo. Escríbenos por Instagram y te
            avisamos si se libera un lugar o si la repetimos.
          </p>
          <Link
            href="/clases-especiales"
            className="xo-eyebrow mt-8 inline-block text-xo-negro underline underline-offset-4"
          >
            Ver las otras clases especiales
          </Link>
        </div>
      ) : transferencia.error ? null : transferencia.datos.completos ? (
        <>
          <p className="mb-8 text-xo-gris">
            Quedan <strong className="text-xo-negro">{lugaresLibres}</strong> de{" "}
            {especial.cupoMaximo} lugares.
          </p>
          <FormularioReservaEspecial
            especial={especial}
            datos={transferencia.datos}
          />
        </>
      ) : (
        <div className="max-w-xl border-l-2 border-xo-negro pl-5">
          <p className="text-lg leading-relaxed text-xo-negro">
            Todavía no están cargados los datos de transferencia, así que no
            podemos pedirte que transfieras a ninguna parte.
          </p>
          <p className="mt-4 leading-relaxed text-xo-gris">
            Escríbenos por WhatsApp y coordinamos tu cupo a mano mientras tanto.
          </p>
        </div>
      )}
    </>
  );
}
