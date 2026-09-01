import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { FormularioCompra } from "@/components/FormularioCompra";
import { requiereSesion } from "@/lib/sesion";
import { getPlanes } from "@/lib/planes-consultas";
import { getDatosTransferencia } from "@/lib/compras-consultas";

export const metadata: Metadata = {
  title: "Comprar clases — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * Comprar por transferencia.
 *
 * No hay pasarela todavía: la alumna transfiere en su banco y vuelve a declarar
 * que lo hizo. La compra queda pendiente hasta que un admin la confirme contra
 * la cuenta. Ver PRD-0017 §5.
 */
export default async function Comprar() {
  await requiereSesion("cuenta");
  const [planes, datos] = await Promise.all([getPlanes(), getDatosTransferencia()]);

  return (
    <>
      <TituloPortal
        eyebrow="Comprar clases"
        titulo="Elige tu pack"
        bajada="Transfieres desde tu banco y nos avisas acá. Cuando confirmemos el pago te acreditamos las clases y puedes reservar."
      />

      {datos.completos ? (
        <FormularioCompra planes={planes} datos={datos} />
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
