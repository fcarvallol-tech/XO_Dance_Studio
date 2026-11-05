"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { revocarCreditos } from "@/lib/acciones";

/**
 * Quitar clases a una persona, desde su fila en Personas (PRD-0024). **Solo se
 * dibuja para el owner**, y la base lo vuelve a verificar.
 *
 * Le quita algo que puede haber pagado, así que el diálogo dice qué va a pasar
 * antes de que pase: a quién, cuántas tiene, de dónde salen —las que vencen
 * primero— y el botón lleva la cantidad. Si pide más de lo que hay, no se
 * quita nada: el motivo se escribió para esa cantidad.
 */
export function QuitarClases({
  perfilId,
  nombre,
  correo,
  saldo,
}: {
  perfilId: string;
  nombre: string | null;
  correo: string | null;
  saldo: number;
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

  const valido =
    Number.isInteger(cantidad) && cantidad >= 1 && cantidad <= saldo && motivo.trim().length >= 5;
  const palabra = cantidad === 1 ? "clase" : "clases";

  function quitar() {
    setFallo(null);
    iniciar(async () => {
      const r = await revocarCreditos(perfilId, cantidad, motivo);
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setHecho(`Quitaste ${cantidad} ${palabra}. Ahora tiene ${r.saldo}.`);
      setAbierto(false);
      setCantidad(1);
      setMotivo("");
    });
  }

  // Sin saldo vigente no hay nada que quitar: el botón ni aparece.
  if (saldo < 1 && !hecho) return null;

  return (
    <>
      {saldo >= 1 ? (
        <button
          type="button"
          onClick={() => {
            setHecho(null);
            setFallo(null);
            setAbierto(true);
          }}
          className="xo-eyebrow rounded-full border border-xo-negro/20 px-3 py-1.5 text-xo-negro transition-colors hover:border-xo-negro/50"
        >
          Quitar
        </button>
      ) : null}
      {hecho ? (
        <p role="status" className="basis-full text-sm text-xo-gris">
          {hecho}
        </p>
      ) : null}

      <dialog
        ref={dialogo}
        aria-labelledby={`quitar-${perfilId}`}
        onClose={() => setAbierto(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-left text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        <p className="xo-eyebrow text-xo-gris">Solo owner · queda registrado</p>
        <h2 id={`quitar-${perfilId}`} className="mt-2 font-display text-3xl leading-none text-xo-negro">
          Quitar clases
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
            <dt className="text-xo-gris">Tiene vigentes</dt>
            <dd className="text-right text-xo-negro">
              {saldo} {saldo === 1 ? "clase" : "clases"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 space-y-5">
          <div>
            <label htmlFor={`quitar-cantidad-${perfilId}`} className="xo-eyebrow text-xo-gris">
              Cuántas (1 a {saldo})
            </label>
            <input
              ref={primerCampo}
              id={`quitar-cantidad-${perfilId}`}
              type="number"
              inputMode="numeric"
              min={1}
              max={saldo}
              value={Number.isNaN(cantidad) ? "" : cantidad}
              onChange={(e) => setCantidad(e.target.valueAsNumber)}
              className="mt-2 w-28 rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
            />
          </div>
          <div>
            <label htmlFor={`quitar-motivo-${perfilId}`} className="xo-eyebrow text-xo-gris">
              Por qué (obligatorio, ella no lo ve)
            </label>
            <textarea
              id={`quitar-motivo-${perfilId}`}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Regalé 3 en vez de 2 el 04/11…"
              className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro placeholder:text-xo-gris"
            />
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-xo-gris">
          Salen de las que vencen primero. No se borra nada: queda un movimiento con tu nombre y el
          motivo. No le llega correo; ve su saldo nuevo en Mis reservas.
        </p>
        <p className="mt-3 text-sm leading-relaxed text-xo-gris">
          Si fue a una clase sin reservar, esto no es lo que corresponde: la profesora no cobraría
          esa clase.
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
            onClick={quitar}
            className="xo-eyebrow rounded-full bg-xo-negro px-5 py-3 text-xo-blanco transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Quitando…" : `Quitar ${Number.isNaN(cantidad) ? "" : cantidad} ${palabra}`}
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
    </>
  );
}
