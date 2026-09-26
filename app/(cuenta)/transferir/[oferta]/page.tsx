import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { FormularioTransferencia } from "@/components/FormularioTransferencia";
import { requiereSesion } from "@/lib/sesion";
import { getDatosTransferencia } from "@/lib/compras-consultas";
import { resolverOferta } from "@/lib/ofertas-consultas";
import { clp } from "@/lib/planes";

type Props = { params: Promise<{ oferta: string }> };

export const metadata: Metadata = {
  title: "Transferir — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * `/transferir/<oferta>` — el paso con sesión.
 *
 * Vive en una raíz distinta de `/comprar` y no debajo de ella, porque el guard
 * compara **por prefijo**: con `/comprar` público, cualquier excepción para
 * cerrar una hija sería la clase de lógica que ya produjo un bucle de
 * redirección (PRD-0004 §12). Dos raíces, nada que afinar.
 *
 * Quien llega sin sesión pasa por `/entrar` con `?volver=` puesto por el proxy y
 * vuelve **a esta misma oferta**, porque va en la ruta y no en la query.
 */
export default async function Transferir({ params }: Props) {
  await requiereSesion("cuenta");
  const { oferta: slug } = await params;

  const [oferta, transferencia] = await Promise.all([
    resolverOferta(slug),
    getDatosTransferencia(),
  ]);

  if (!oferta) notFound();

  return (
    <>
      <TituloPortal
        eyebrow="Comprar clases"
        titulo={oferta.titulo}
        bajada={`${clp(oferta.precioClp)} por transferencia. Cuando confirmemos el abono te acreditamos las clases y puedes reservar.`}
      />

      <ErrorDeLectura que="los datos de transferencia" error={transferencia.error} />

      {transferencia.error ? null : transferencia.datos.completos ? (
        <FormularioTransferencia oferta={oferta} datos={transferencia.datos} />
      ) : (
        <div className="max-w-xl border-l-2 border-xo-negro pl-5">
          <p className="text-lg leading-relaxed text-xo-negro">
            Todavía no están cargados los datos de transferencia, así que no
            podemos pedirte que transfieras a ninguna parte.
          </p>
          <p className="mt-4 leading-relaxed text-xo-gris">
            Escríbenos por WhatsApp y coordinamos tu pack a mano mientras tanto.
          </p>
          <Link
            href="/mis-clases"
            className="xo-eyebrow mt-8 inline-block text-xo-negro underline underline-offset-4"
          >
            Volver a mis clases
          </Link>
        </div>
      )}
    </>
  );
}
