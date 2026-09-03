import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { MisReservas } from "@/components/MisReservas";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
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
  title: "Mis reservas — XO Dance Studio",
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

  const ahora = new Date().toISOString();
  // Una clase que la academia canceló va arriba aunque la reserva figure como
  // cancelada: es una noticia que ella todavía no vio y que cambia su semana.
  // Antes caía entre las pasadas, o directamente no aparecía.
  const proximas = reservas.datos.filter(
    (r) =>
      r.inicio > ahora &&
      (r.estado === "confirmada" || (r.claseCancelada && r.creditoDevuelto)),
  );
  const pasadas = reservas.datos.filter((r) => !proximas.includes(r));

  return (
    <>
      <TituloPortal
        eyebrow="Tu cuenta"
        titulo="Mis reservas"
        bajada="Tu saldo, lo que tienes reservado y el estado de tus compras."
      />

      <ErrorDeLectura que="tu saldo de clases" error={saldo.error ?? vence.error} />

      {/* Sin saldo confiable, ofrecer "Reservar" sería mandarla a un error. */}
      {saldo.error ? null : (
        <div className="mb-12 flex flex-wrap items-end gap-x-10 gap-y-4 border-y border-xo-negro/15 py-6">
          <div>
            <p className="xo-eyebrow text-xo-gris">Clases disponibles</p>
            <p className="mt-1 font-display text-4xl leading-none text-xo-negro">
              {saldo.datos}
            </p>
          </div>
          {vence.datos ? (
            <div>
              <p className="xo-eyebrow text-xo-gris">Vencen</p>
              <p className="mt-1 text-xo-negro">
                {cuandoLegible(vence.datos).split(",")[0]}
              </p>
            </div>
          ) : null}
          <div className="flex gap-3">
            {saldo.datos > 0 ? (
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
      )}

      <ErrorDeLectura que="tus reservas" error={reservas.error} />
      {reservas.error ? null : (
        <MisReservas proximas={proximas} pasadas={pasadas} />
      )}

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Tus compras</h2>
      <ErrorDeLectura que="tus compras" error={compras.error} />

      {compras.error ? null : compras.datos.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no has comprado ningún pack.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {compras.datos.map((compra) => (
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
