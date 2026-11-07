import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { AccionesLiquidacion } from "@/components/AccionesLiquidacion";
import { ClasificarClase } from "@/components/ClasificarClase";
import { DetalleLiquidacion } from "@/components/DetalleLiquidacion";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { clp } from "@/lib/planes";
import { nombreDeMes } from "@/lib/dominio/liquidacion";
import { getLiquidaciones, type LiquidacionDeProfesora } from "@/lib/liquidacion-consultas";

export const metadata: Metadata = {
  title: "Liquidaciones — XO Dance Studio",
  robots: { index: false, follow: false },
};

function rotulo(p: LiquidacionDeProfesora): string {
  if (p.estado === "pagada" && p.fila?.pagadaAt) return `Pagada el ${cuandoLegible(p.fila.pagadaAt)}`;
  if (p.estado === "cerrada") return "Cerrada, falta pagar";
  return "Pendiente";
}

/** Lo que se le debe a cada profesora en un mes (PRD-0010 parte 3, paso E). */
export default async function Liquidaciones({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  await requiereNivel("owner", "owner");
  const { mes: pedido } = await searchParams;
  const lectura = await getLiquidaciones(pedido);
  const { mes, meses, profesoras } = lectura.datos;

  // Lo cerrado se muestra congelado: es lo que se transfiere.
  const totalMes = profesoras.reduce((t, p) => t + (p.fila?.monto ?? p.calculo.totalClp), 0);

  return (
    <>
      <TituloPortal
        eyebrow="Owner"
        titulo="Liquidaciones"
        bajada="Lo que se le debe a cada profesora, y lo que no entra en este pago. Se cierra, se transfiere y se marca pagada."
      />

      <ErrorDeLectura que="las liquidaciones" error={lectura.error} />

      {lectura.error ? null : (
        <>
          <nav aria-label="Mes" className="mb-8 flex flex-wrap gap-3">
            {meses.map((m) => (
              <Link
                key={m}
                href={`/owner/liquidaciones?mes=${m}`}
                aria-current={m === mes ? "page" : undefined}
                className={`xo-eyebrow rounded-full border px-4 py-2 ${m === mes ? "border-xo-negro bg-xo-negro text-xo-blanco" : "border-xo-negro/20 text-xo-negro"}`}
              >
                {nombreDeMes(m)}
              </Link>
            ))}
          </nav>

          <p className="mb-8 text-xo-negro">
            Total de {nombreDeMes(mes)}: <strong>{clp(totalMes)}</strong>
          </p>

          <div className="space-y-4">
            {profesoras.map((p) => {
              const foto = p.fila?.detalle ?? p.calculo;
              const cambio = p.fila !== null && p.fila.huella !== p.huella;
              return (
                <details
                  key={p.profesoraId}
                  data-profesora={p.nombre}
                  className="rounded-lg border border-xo-negro/15 p-4 sm:p-6"
                >
                  <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <span className="font-display text-2xl leading-none text-xo-negro">{p.nombre}</span>
                    <span className="text-xo-negro">
                      <strong>{clp(foto.totalClp)}</strong> · {rotulo(p)}
                    </span>
                  </summary>

                  <div className="mt-6 space-y-8">
                    {cambio ? (
                      <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
                        Hoy este mes daría {clp(p.calculo.totalClp)}. Esto es lo que se cerró. Si hay que corregirlo,
                        se anula y se cierra de nuevo.
                      </p>
                    ) : null}

                    <DetalleLiquidacion
                      liquidacion={foto}
                      accionDeLinea={
                        p.fila
                          ? undefined
                          : (l) => (
                              <ClasificarClase
                                claseId={l.claseId}
                                causa={l.causa}
                                etiqueta={l.tipo === "dictada" ? "No se dictó" : l.causa ? "Cambiar la causa" : "Decir por qué"}
                              />
                            )
                      }
                    />

                    {p.fila?.tieneComprobante ? (
                      <a
                        href={`/api/liquidaciones/comprobante?id=${p.fila.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-xo-negro underline underline-offset-4"
                      >
                        Ver comprobante
                      </a>
                    ) : null}

                    <AccionesLiquidacion
                      nombre={p.nombre}
                      profesoraId={p.profesoraId}
                      mes={mes}
                      mesLegible={nombreDeMes(mes)}
                      huella={p.huella}
                      monto={foto.totalClp}
                      puedeCerrar={foto.bloqueos.length === 0 && foto.totalClp > 0}
                      liquidacionId={p.fila?.id ?? null}
                      estado={p.estado}
                    />
                  </div>
                </details>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
