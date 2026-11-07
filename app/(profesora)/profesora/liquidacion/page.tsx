import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { DetalleLiquidacion } from "@/components/DetalleLiquidacion";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { nombreDeMes } from "@/lib/dominio/liquidacion";
import { getMiLiquidacion } from "@/lib/liquidacion-consultas";

export const metadata: Metadata = {
  title: "Mi liquidación — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Su liquidación, solo lectura (ADR-0008). Si ve algo mal, avisa antes del pago. */
export default async function MiLiquidacion({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requiereNivel("profesora", "profesora");
  const { mes: pedido } = await searchParams;
  const lectura = await getMiLiquidacion(pedido);
  const datos = lectura.datos;

  return (
    <>
      <TituloPortal
        eyebrow="Tu portal"
        titulo="Mi liquidación"
        bajada="Lo que te corresponde por tus clases del mes. Si ves algo que no calza, avísanos antes del pago."
      />

      <ErrorDeLectura que="tu liquidación" error={lectura.error} />

      {datos ? (
        <>
          <nav aria-label="Mes" className="mb-8 flex flex-wrap gap-3">
            {datos.meses.map((m) => (
              <Link
                key={m}
                href={`/profesora/liquidacion?mes=${m}`}
                aria-current={m === datos.mes ? "page" : undefined}
                className={`xo-eyebrow rounded-full border px-4 py-2 ${m === datos.mes ? "border-xo-negro bg-xo-negro text-xo-blanco" : "border-xo-negro/20 text-xo-negro"}`}
              >
                {nombreDeMes(m)}
              </Link>
            ))}
          </nav>

          <p role="status" className="mb-8 text-sm text-xo-gris">
            {datos.pagadaAt
              ? `Pagada el ${cuandoLegible(datos.pagadaAt)}.`
              : datos.estado === "cerrada"
                ? "Cerrada: falta la transferencia."
                : datos.mes === datos.hoy.slice(0, 7)
                  ? "En curso: puede cambiar hasta que termine el mes."
                  : "Todavía no se cierra."}
          </p>

          <DetalleLiquidacion liquidacion={datos.foto} />
        </>
      ) : null}
    </>
  );
}
