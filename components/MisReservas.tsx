"use client";

import { useState, useTransition } from "react";
import { cancelarReserva } from "@/lib/acciones";
import { cuandoLegible, type ReservaPropia } from "@/lib/compras";

/**
 * Sus reservas.
 *
 * **Una clase que la academia canceló se muestra, no se esconde.** Antes
 * desaparecía —y con ella la reserva— porque RLS ocultaba las clases canceladas
 * y la consulta descartaba las reservas sin clase. A alguien que pagó le
 * desaparecía de la pantalla algo que había reservado, sin explicación.
 *
 * Que se vea tachada, con el motivo y con el aviso de que le devolvieron la
 * clase, es peor que nada solo si uno cree que la mala noticia es el problema.
 * El problema era la desaparición.
 */
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
                <p
                  className={
                    reserva.claseCancelada ? "text-xo-gris line-through" : "text-xo-negro"
                  }
                >
                  {reserva.cursoNombre} con {reserva.profesoraNombre}
                </p>
                <p
                  className={`text-sm text-xo-gris ${
                    reserva.claseCancelada ? "line-through" : ""
                  }`}
                >
                  {cuandoLegible(reserva.inicio)}
                </p>
                <p
                  className={`text-sm text-xo-gris ${
                    reserva.claseCancelada ? "line-through" : ""
                  }`}
                >
                  {reserva.sedeNombre} · {reserva.sedeDireccion}
                </p>

                {reserva.claseCancelada ? (
                  <div className="mt-2 border-l-2 border-xo-negro pl-3">
                    <p className="text-sm font-medium text-xo-negro">
                      Cancelamos esta clase.
                      {reserva.creditoDevuelto
                        ? " Te devolvimos la clase a tu saldo."
                        : ""}
                    </p>
                    {reserva.motivoCancelacion ? (
                      <p className="mt-1 text-sm text-xo-gris">
                        {reserva.motivoCancelacion}
                      </p>
                    ) : null}
                    <p className="mt-1 text-sm text-xo-gris">
                      Puedes reservar otro horario cuando quieras.
                    </p>
                  </div>
                ) : null}
              </div>

              {/* Cancelar una clase que ya está cancelada no tiene sentido, y
                  ofrecerlo haría pensar que todavía hay algo que soltar. */}
              {reserva.claseCancelada ? null : (
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
              )}
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
                <p className="text-sm text-xo-gris">{quePaso(reserva)}</p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}

/**
 * Qué pasó con una reserva vieja.
 *
 * Distingue quién canceló: no es lo mismo que ella soltara el cupo a que la
 * academia le cancelara la clase, y antes las dos decían "Cancelada".
 */
function quePaso(reserva: ReservaPropia): string {
  if (reserva.claseCancelada) {
    return reserva.creditoDevuelto
      ? "La cancelamos nosotras · clase devuelta"
      : "La cancelamos nosotras";
  }
  if (reserva.estado === "cancelada") {
    return reserva.creditoDevuelto
      ? "Cancelaste · clase devuelta"
      : "Cancelaste fuera de plazo";
  }
  return "Asististe";
}
