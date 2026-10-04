"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { regalarCreditos } from "@/lib/acciones";
import { fechaLegible } from "@/lib/planes";
import { diaEnSantiago, sumarDias } from "@/lib/semana";

/**
 * Regalar clases a una persona, desde su fila en Personas (PRD-0023).
 *
 * Un regalo es plata que no entra —y cada clase regalada que se toma le cuesta
 * $250 a XO, porque la profesora la dictó igual (CONTEXT.md)—, así que el
 * diálogo hace visible qué se va a hacer antes de hacerlo: a quién, cuántas,
 * hasta cuándo valen, y el botón dice la cantidad. El motivo es obligatorio y
 * queda en el registro; la alumna no lo ve.
 */
export function RegalarClases({
  perfilId,
  nombre,
  correo,
  saldo,
  vigenciaDias,
}: {
  perfilId: string;
  nombre: string | null;
  correo: string | null;
  saldo: number;
  vigenciaDias: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cantidad, setCantidad] = useState(1);
  const [motivo, setMotivo] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);
  const primerCampo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) {
      d.showModal();
      primerCampo.current?.focus();
    }
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const valido = Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= 20 && motivo.trim().length >= 5;
  const palabra = cantidad === 1 ? "clase" : "clases";
  // Lo que se le muestra antes de confirmar. La fecha de verdad la pone la base
  // al regalar; esta es la misma cuenta, para que no haya sorpresas.
  const vence = fechaLegible(sumarDias(diaEnSantiago(new Date()), vigenciaDias));

  function regalar() {
    setFallo(null);
    iniciar(async () => {
      const r = await regalarCreditos(perfilId, cantidad, motivo);
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setHecho(
        `Regalaste ${cantidad} ${palabra}. Ahora tiene ${r.saldo}, que valen hasta el ${r.vence}.` +
          (r.correoEnviado ? "" : " El correo para avisarle no salió; queda en Correos y se reintenta."),
      );
      setAbierto(false);
      setCantidad(1);
      setMotivo("");
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm text-xo-negro tabular-nums" data-saldo={saldo}>
        {saldo}
      </span>
      <button
        type="button"
        onClick={() => {
          setHecho(null);
          setFallo(null);
          setAbierto(true);
        }}
        className="xo-eyebrow rounded-full border border-xo-negro/20 px-3 py-1.5 text-xo-negro transition-colors hover:border-xo-negro/50"
      >
        Regalar
      </button>
      {hecho ? (
        <p role="status" className="basis-full text-sm text-xo-gris">
          {hecho}
        </p>
      ) : null}

      <dialog
        ref={dialogo}
        aria-labelledby={`regalar-${perfilId}`}
        onClose={() => setAbierto(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-left text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        <p className="xo-eyebrow text-xo-gris">No es venta</p>
        <h2 id={`regalar-${perfilId}`} className="mt-2 font-display text-3xl leading-none text-xo-negro">
          Regalar clases
        </h2>

        <dl className="mt-6 divide-y divide-xo-negro/10 border-y border-xo-negro/10 text-sm">
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-xo-gris">A</dt>
            <dd className="text-right text-xo-negro">
              {nombre ?? "Sin nombre"}
              {correo && !correo.endsWith(".invalid") ? (
                <span className="block text-xo-gris">{correo}</span>
              ) : null}
            </dd>
          </div>
          <div className="flex justify-between gap-4 py-2.5">
            <dt className="text-xo-gris">Tiene hoy</dt>
            <dd className="text-right text-xo-negro">
              {saldo} {saldo === 1 ? "clase" : "clases"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor={`cantidad-${perfilId}`} className="xo-eyebrow text-xo-gris">
              Cuántas clases (1 a 20)
            </label>
            <input
              ref={primerCampo}
              id={`cantidad-${perfilId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={Number.isNaN(cantidad) ? "" : cantidad}
              onChange={(e) => setCantidad(e.target.valueAsNumber)}
              className="mt-2 w-28 rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
            />
          </div>
          <div>
            <label htmlFor={`motivo-${perfilId}`} className="xo-eyebrow text-xo-gris">
              Por qué (obligatorio, ella no lo ve)
            </label>
            <textarea
              id={`motivo-${perfilId}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Saldo de septiembre, compensación por la clase del 12/10…"
              className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro placeholder:text-xo-gris"
            />
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-xo-gris">
          Valen hasta el <span className="text-xo-negro">{vence}</span>, como un pack. Le llega un correo
          avisándole. No cuenta como venta.
        </p>

        {fallo ? (
          <p role="alert" className="mt-4 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
            {fallo}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!valido || enviando}
            onClick={regalar}
            className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Regalando…" : `Regalar ${Number.isNaN(cantidad) ? "" : cantidad} ${palabra}`}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro transition-colors hover:border-xo-negro/50"
          >
            Volver
          </button>
        </div>
      </dialog>
    </div>
  );
}
