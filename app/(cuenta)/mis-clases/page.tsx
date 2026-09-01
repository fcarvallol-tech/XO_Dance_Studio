import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { MisReservas } from "@/components/MisReservas";
import { requiereSesion } from "@/lib/sesion";
import { clp } from "@/lib/planes";
import { NOMBRE_ESTADO, cuandoLegible, type EstadoCompra } from "@/lib/compras";
import {
  getMisCompras,
  getMisReservas,
  getProximoVencimiento,
  getSaldo,
} from "@/lib/compras-consultas";

export const metadata: Metadata = {
  title: "Mis clases — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function MisClases() {
  const perfil = await requiereSesion("cuenta");

  const [saldo, vence, reservas, compras] = await Promise.all([
    getSaldo(perfil.id),
    getProximoVencimiento(perfil.id),
    getMisReservas(perfil.id),
    getMisCompras(perfil.id),
  ]);

  const proximas = reservas.filter(
    (r) => r.estado === "confirmada" && r.inicio > new Date().toISOString(),
  );
  const pasadas = reservas.filter((r) => !proximas.includes(r));

  return (
    <>
      <TituloPortal
        eyebrow="Tu cuenta"
        titulo="Mis clases"
        bajada="Tu saldo, lo que tienes reservado y el estado de tus compras."
      />

      <div className="mb-12 flex flex-wrap items-end gap-x-10 gap-y-4 border-y border-xo-negro/15 py-6">
        <div>
          <p className="xo-eyebrow text-xo-gris">Clases disponibles</p>
          <p className="mt-1 font-display text-4xl leading-none text-xo-negro">
            {saldo}
          </p>
        </div>
        {vence ? (
          <div>
            <p className="xo-eyebrow text-xo-gris">Vencen</p>
            <p className="mt-1 text-xo-negro">{cuandoLegible(vence).split(",")[0]}</p>
          </div>
        ) : null}
        <div className="flex gap-3">
          {saldo > 0 ? (
            <Link
              href="/reservar"
              className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 text-xo-negro transition-opacity hover:opacity-80"
            >
              Reservar
            </Link>
          ) : null}
          <Link
            href="/comprar"
            className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-2.5 text-xo-negro transition-colors hover:border-xo-negro/50"
          >
            Comprar más
          </Link>
        </div>
      </div>

      <MisReservas proximas={proximas} pasadas={pasadas} />

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Tus compras</h2>
      {compras.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no has comprado ningún pack.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {compras.map((compra) => (
            <li key={compra.id} className="flex flex-wrap justify-between gap-3 py-4">
              <div>
                <p className="text-xo-negro">
                  {compra.planNombre} · {clp(compra.monto)}
                </p>
                <p className="text-sm text-xo-gris">
                  {cuandoLegible(compra.declaradaAt)}
                </p>
                {compra.motivoRechazo ? (
                  <p className="mt-1 text-sm text-xo-negro">
                    Motivo: {compra.motivoRechazo}
                  </p>
                ) : null}
              </div>
              <p className="xo-eyebrow self-center text-xo-gris">
                {NOMBRE_ESTADO[compra.estado as EstadoCompra]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
