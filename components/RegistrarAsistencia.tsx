"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { registrarAsistenciaPasada } from "@/lib/acciones";

/**
 * Registrar que una alumna bailó en una clase pasada sin reserva (PRD-0030).
 * **Solo se dibuja para el owner**, y la base lo vuelve a verificar.
 *
 * Si ese día no tenía crédito vigente, la base no inventa uno: el diálogo lo
 * dice con la fecha de la clase y le deja al owner la decisión —usar una de
 * las clases que tiene hoy, o no registrar—. La deuda automática es la parte 2.
 */
export function RegistrarAsistencia({
  perfilId,
  claseId,
  nombre,
  clase,
}: {
  perfilId: string;
  claseId: string;
  nombre: string | null;
  /** "jueves 5 de noviembre · Reggaeton Femme con Pau". */
  clase: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [sinCredito, setSinCredito] = useState<number | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      campo.current?.focus();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const valido = motivo.trim().length >= 5;

  function registrar(usarHoy: boolean) {
    setFallo(null);
    iniciar(async () => {
      const r = await registrarAsistenciaPasada(perfilId, claseId, motivo, usarHoy);
      if (r.ok) {
        setHecho(
          r.creditoDe === "hoy"
            ? "Registrada, con una de las clases que tiene hoy."
            : r.loteVencidoHoy
              ? "Registrada, con el crédito que tenía ese día (hoy ya venció)."
              : "Registrada, con el crédito que tenía ese día.",
        );
        setAbierto(false);
        setSinCredito(null);
        setMotivo("");
        return;
      }
      if (r.sinCreditoEseDia) {
        setSinCredito(r.vigentesHoy);
        return;
      }
      setFallo(r.mensaje);
    });
  }

  if (hecho) {
    return (
      <p role="status" className="text-sm text-xo-gris" data-asistencia-registrada>
        {hecho}
      </p>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFallo(null);
          setSinCredito(null);
          setAbierto(true);
        }}
        className="xo-eyebrow rounded-full border border-xo-negro/20 px-3 py-1.5 text-xo-negro transition-colors hover:border-xo-negro/50"
      >
        Fue a esta clase
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={`asistencia-${perfilId}`}
        onClose={() => setAbierto(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-left text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        <p className="xo-eyebrow text-xo-gris">Solo owner · queda registrado</p>
        <h2 id={`asistencia-${perfilId}`} className="mt-2 font-display text-3xl leading-none text-xo-negro">
          Registrar asistencia
        </h2>

        <dl className="mt-6 divide-y divide-xo-negro/10 border-y border-xo-negro/10 text-sm">
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-xo-gris">Quién</dt>
            <dd className="text-right text-xo-negro">{nombre ?? "Sin nombre"}</dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-xo-gris">Clase</dt>
            <dd className="text-right text-xo-negro">{clase}</dd>
          </div>
        </dl>

        <p className="mt-4 text-sm text-xo-gris">
          Se descuenta del crédito que tenía vigente el día de la clase, aunque hoy esté vencido. El
          cupo no se revisa: si fueron más de los que caben, fueron.
        </p>

        <div className="mt-6">
          <label htmlFor={`asistencia-motivo-${perfilId}`} className="xo-eyebrow text-xo-gris">
            Por qué (queda en el registro)
          </label>
          <textarea
            id={`asistencia-motivo-${perfilId}`}
            ref={campo}
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="Llegó sin reserva, no alcanzó a reservar"
            className="mt-2 w-full rounded-md border border-xo-negro/20 bg-xo-blanco px-3 py-2 text-xo-negro"
          />
        </div>

        {sinCredito !== null ? (
          <div role="alert" className="mt-5 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro" data-sin-credito-ese-dia>
            <p>
              <strong>No tenía crédito vigente el día de la clase.</strong>{" "}
              {sinCredito > 0
                ? `Hoy tiene ${sinCredito} ${sinCredito === 1 ? "clase" : "clases"}. Puedes registrarla con una de esas, o no registrar nada.`
                : "Tampoco tiene clases hoy, así que no hay de dónde descontarla."}
            </p>
          </div>
        ) : null}

        {fallo ? (
          <p role="alert" className="mt-5 text-sm text-xo-negro">
            {fallo}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-2.5 text-xo-negro"
          >
            {sinCredito !== null ? "No registrar" : "Cancelar"}
          </button>
          {sinCredito === null ? (
            <button
              type="button"
              disabled={!valido || enviando}
              onClick={() => registrar(false)}
              className="xo-eyebrow rounded-full bg-xo-negro px-5 py-2.5 text-xo-blanco disabled:opacity-40"
            >
              {enviando ? "Registrando…" : "Registrar"}
            </button>
          ) : sinCredito > 0 ? (
            <button
              type="button"
              disabled={!valido || enviando}
              onClick={() => registrar(true)}
              className="xo-eyebrow rounded-full bg-xo-negro px-5 py-2.5 text-xo-blanco disabled:opacity-40"
            >
              {enviando ? "Registrando…" : "Usar una de hoy"}
            </button>
          ) : null}
        </div>
      </dialog>
    </>
  );
}
