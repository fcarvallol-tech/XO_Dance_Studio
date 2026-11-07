"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularLiquidacion, cerrarLiquidacion } from "@/lib/acciones-liquidacion";
import { clp } from "@/lib/planes";

const BOTON = "xo-eyebrow rounded-full px-5 py-3 transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40";

/** Cerrar, marcar pagada y anular. El monto no viaja: lo recalcula el servidor. */
export function AccionesLiquidacion({
  nombre,
  profesoraId,
  mes,
  mesLegible,
  huella,
  monto,
  puedeCerrar,
  liquidacionId,
  estado,
}: {
  nombre: string;
  profesoraId: string;
  mes: string;
  mesLegible: string;
  huella: string;
  monto: number;
  puedeCerrar: boolean;
  liquidacionId: string | null;
  estado: "pendiente" | "cerrada" | "pagada";
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [enviando, iniciar] = useTransition();
  const archivo = useRef<HTMLInputElement>(null);

  function cerrar() {
    setFallo(null);
    iniciar(async () => {
      const r = await cerrarLiquidacion({ profesoraId, mes, huella });
      if (!r.ok) setFallo(r.mensaje);
      router.refresh();
    });
  }

  function pagar() {
    const elegido = archivo.current?.files?.[0];
    if (!elegido || !liquidacionId) {
      setFallo("Adjunta el comprobante de la transferencia.");
      return;
    }
    setFallo(null);
    iniciar(async () => {
      const cuerpo = new FormData();
      cuerpo.set("liquidacion_id", liquidacionId);
      cuerpo.set("comprobante", elegido);
      const respuesta = await fetch("/api/liquidaciones/comprobante", { method: "POST", body: cuerpo });
      if (!respuesta.ok) {
        const datos = await respuesta.json().catch(() => null);
        setFallo(datos?.mensaje ?? "No se pudo registrar el pago.");
      }
      router.refresh();
    });
  }

  function anular() {
    if (!liquidacionId) return;
    setFallo(null);
    iniciar(async () => {
      const r = await anularLiquidacion(liquidacionId, motivo);
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setAnulando(false);
      setMotivo("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {estado === "pendiente" ? (
        <button
          type="button"
          disabled={!puedeCerrar || enviando}
          onClick={cerrar}
          className={`${BOTON} bg-xo-rosa text-xo-negro`}
        >
          {enviando ? "Cerrando…" : `Cerrar ${clp(monto)}`}
        </button>
      ) : null}

      {estado === "cerrada" ? (
        <div className="space-y-3">
          <p className="text-sm text-xo-negro">
            Cuando le transfieras {clp(monto)} a {nombre} por {mesLegible}, adjunta el comprobante.
          </p>
          <input
            ref={archivo}
            type="file"
            aria-label={`Comprobante de ${nombre}`}
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="block text-sm text-xo-gris"
          />
          <button type="button" disabled={enviando} onClick={pagar} className={`${BOTON} bg-xo-rosa text-xo-negro`}>
            {enviando ? "Guardando…" : "Marcar pagada"}
          </button>
        </div>
      ) : null}

      {estado !== "pendiente" ? (
        anulando ? (
          <div className="max-w-md space-y-3">
            <label className="block text-sm text-xo-negro">
              Por qué se anula
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
              />
            </label>
            <p className="text-sm text-xo-gris">
              No se borra nada: queda anulada y el mes se puede volver a cerrar.
              {estado === "pagada" ? " También se anula el egreso." : ""}
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={motivo.trim().length < 5 || enviando}
                onClick={anular}
                className={`${BOTON} bg-xo-negro text-xo-blanco`}
              >
                Anular
              </button>
              <button
                type="button"
                onClick={() => setAnulando(false)}
                className={`${BOTON} border border-xo-negro/20 text-xo-negro`}
              >
                Volver
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setAnulando(true)} className="text-sm text-xo-gris underline underline-offset-4">
            {estado === "pagada" ? "Anular este pago" : "Anular el cierre"}
          </button>
        )
      ) : null}

      {fallo ? (
        <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}
