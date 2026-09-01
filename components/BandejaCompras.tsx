"use client";

import { useState, useTransition } from "react";
import { aprobarCompra, rechazarCompra } from "@/lib/acciones";
import { clp } from "@/lib/planes";
import { cuandoLegible, type Compra } from "@/lib/compras";

/**
 * Aprobar o rechazar transferencias declaradas.
 *
 * Aprobar es un botón porque el trabajo de verdad ya se hizo afuera: mirar la
 * cuenta. Rechazar pide motivo porque del otro lado hay alguien que transfirió
 * plata y necesita saber qué pasó — la base tampoco deja rechazar sin él.
 */
export function BandejaCompras({ pendientes }: { pendientes: Compra[] }) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  if (pendientes.length === 0) {
    return (
      <p className="text-xo-gris">
        No hay transferencias esperando. Cuando alguien declare un pago, aparece
        acá y llega un correo.
      </p>
    );
  }

  function correr(
    fn: () => Promise<{ ok: true } | { ok: false; mensaje: string }>,
    id: string,
  ) {
    setFallo(null);
    setOcupada(id);
    iniciar(async () => {
      const resultado = await fn();
      if (!resultado.ok) setFallo(resultado.mensaje);
      else {
        setRechazando(null);
        setMotivo("");
      }
      setOcupada(null);
    });
  }

  return (
    <div>
      {fallo ? (
        <p
          role="alert"
          className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}

      <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        {pendientes.map((compra) => (
          <li key={compra.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg text-xo-negro">
                  {compra.alumna ?? "Sin nombre"} ·{" "}
                  <strong className="font-semibold">{clp(compra.monto)}</strong>
                </p>
                <p className="text-sm text-xo-gris">
                  {compra.planNombre} · declarada {cuandoLegible(compra.declaradaAt)}
                </p>
                {compra.correoAlumna &&
                !compra.correoAlumna.endsWith(".invalid") ? (
                  <p className="text-sm text-xo-gris">{compra.correoAlumna}</p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupada === compra.id}
                  onClick={() => correr(() => aprobarCompra(compra.id), compra.id)}
                  className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 whitespace-nowrap text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {ocupada === compra.id ? "…" : "Aprobar"}
                </button>
                <button
                  type="button"
                  disabled={ocupada === compra.id}
                  onClick={() =>
                    setRechazando(rechazando === compra.id ? null : compra.id)
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </div>

            {rechazando === compra.id ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor={`motivo-${compra.id}`} className="sr-only">
                  Motivo del rechazo
                </label>
                <input
                  id={`motivo-${compra.id}`}
                  type="text"
                  value={motivo}
                  onChange={(evento) => setMotivo(evento.target.value)}
                  placeholder="Motivo: se lo mandamos a ella"
                  className="min-w-64 flex-1 rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-2.5 text-sm text-xo-negro placeholder:text-xo-gris"
                />
                <button
                  type="button"
                  disabled={!motivo.trim() || ocupada === compra.id}
                  onClick={() =>
                    correr(() => rechazarCompra(compra.id, motivo), compra.id)
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro px-5 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-40"
                >
                  Confirmar rechazo
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
