"use client";

import { useState, useTransition } from "react";
import { cancelarReserva } from "@/lib/acciones";
import { cuandoLegible, type ReservaPropia } from "@/lib/compras";

export function MisReservas({
  proximas,
  pasadas,
}: {
  proximas: ReservaPropia[];
  pasadas: ReservaPropia[];
}) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  return (
    <>
      <h2 className="xo-eyebrow text-xo-gris">Tus próximas clases</h2>

      {fallo ? (
        <p
          role="alert"
          className="mt-3 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}

      {proximas.length === 0 ? (
        <p className="mt-3 text-xo-gris">No tienes clases reservadas.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {proximas.map((reserva) => (
            <li key={reserva.id} className="flex flex-wrap justify-between gap-3 py-4">
              <div>
                <p className="text-xo-negro">
                  {reserva.cursoNombre} con {reserva.profesoraNombre}
                </p>
                <p className="text-sm text-xo-gris">{cuandoLegible(reserva.inicio)}</p>
                <p className="text-sm text-xo-gris">
                  {reserva.sedeNombre} · {reserva.sedeDireccion}
                </p>
              </div>
              <button
                type="button"
                disabled={ocupada === reserva.id}
                onClick={() => {
                  setFallo(null);
                  setOcupada(reserva.id);
                  iniciar(async () => {
                    const resultado = await cancelarReserva(reserva.id);
                    if (!resultado.ok) setFallo(resultado.mensaje);
                    setOcupada(null);
                  });
                }}
                className="xo-eyebrow self-center rounded-full border border-xo-negro/20 px-4 py-2 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-50"
              >
                {ocupada === reserva.id ? "…" : "Cancelar"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {pasadas.length > 0 ? (
        <>
          <h2 className="xo-eyebrow mt-12 text-xo-gris">Antes</h2>
          <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {pasadas.slice(0, 20).map((reserva) => (
              <li
                key={reserva.id}
                className="flex flex-wrap justify-between gap-3 py-3"
              >
                <p className="text-sm text-xo-gris">
                  {reserva.cursoNombre} · {cuandoLegible(reserva.inicio)}
                </p>
                <p className="text-sm text-xo-gris">
                  {reserva.estado === "cancelada"
                    ? reserva.creditoDevuelto
                      ? "Cancelada, clase devuelta"
                      : "Cancelada fuera de plazo"
                    : "Asististe"}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
