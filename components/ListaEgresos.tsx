"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularEgreso } from "@/lib/acciones";
import { clp } from "@/lib/planes";
import type { EgresoFila } from "@/lib/finanzas-consultas";

/**
 * Los egresos del mes, con dos acciones por fila: anular y adjuntar el
 * comprobante.
 *
 * Anular pide motivo porque la fila no se borra: queda con `deleted_at`, quién
 * la anuló y por qué, como un asiento del libro de créditos. Editar no existe
 * a propósito: se anula y se registra de nuevo.
 *
 * El comprobante se sube por Route Handler y no por Server Action, porque el
 * bucket es privado y escribe la service role (igual que las portadas de las
 * clases especiales). "Ver" pasa por la misma ruta, que firma una URL corta.
 */
export function ListaEgresos({ egresos }: { egresos: EgresoFila[] }) {
  const router = useRouter();
  const [anulando, setAnulando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  function anular(id: string) {
    setFallo(null);
    setOcupada(id);
    iniciar(async () => {
      const resultado = await anularEgreso(id, motivo);
      if (!resultado.ok) setFallo(resultado.mensaje);
      else {
        setAnulando(null);
        setMotivo("");
      }
      setOcupada(null);
      router.refresh();
    });
  }

  return (
    <div>
      {fallo ? (
        <p role="alert" className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}

      <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        {egresos.map((e) => (
          <li key={e.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-lg text-xo-negro">
                  {e.descripcion} ·{" "}
                  <strong className="font-semibold">{clp(e.monto_clp)}</strong>
                </p>
                <p className="text-sm text-xo-gris">
                  {fechaDia(e.fecha)} · {e.categoria_nombre}
                  {e.sede ? ` · ${e.sede}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Comprobante egreso={e} onListo={() => router.refresh()} onFallo={setFallo} />
                <button
                  type="button"
                  disabled={ocupada === e.id}
                  onClick={() => setAnulando(anulando === e.id ? null : e.id)}
                  className="xo-eyebrow rounded-full border border-xo-negro/30 px-5 py-2.5 whitespace-nowrap text-xo-gris transition-colors hover:border-xo-negro hover:text-xo-negro disabled:opacity-50"
                >
                  Anular
                </button>
              </div>
            </div>

            {anulando === e.id ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-3"
                onSubmit={(ev) => {
                  ev.preventDefault();
                  anular(e.id);
                }}
              >
                <label className="block grow">
                  <span className="xo-eyebrow text-xo-gris">Por qué se anula *</span>
                  <input
                    value={motivo}
                    onChange={(ev) => setMotivo(ev.target.value)}
                    required
                    maxLength={200}
                    placeholder="Se registró dos veces"
                    className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro focus:border-xo-negro focus:outline-none"
                  />
                </label>
                <button
                  type="submit"
                  disabled={ocupada === e.id || motivo.trim() === ""}
                  className="xo-eyebrow rounded-full bg-xo-negro px-5 py-3 text-xo-blanco transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  {ocupada === e.id ? "…" : "Confirmar anulación"}
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "6 de septiembre", a partir de un `YYYY-MM-DD` que es un día y no un instante. */
function fechaDia(fecha: string): string {
  return new Intl.DateTimeFormat("es-CL", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
  }).format(new Date(`${fecha}T12:00:00Z`));
}

function Comprobante({
  egreso,
  onListo,
  onFallo,
}: {
  egreso: EgresoFila;
  onListo: () => void;
  onFallo: (mensaje: string) => void;
}) {
  const archivo = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);

  if (egreso.tiene_comprobante) {
    return (
      <a
        href={`/api/egresos/comprobante?id=${egreso.id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="xo-eyebrow text-xo-gris underline underline-offset-4 hover:text-xo-negro"
      >
        Ver comprobante
      </a>
    );
  }

  async function subir() {
    const elegido = archivo.current?.files?.[0];
    if (!elegido) return;
    setSubiendo(true);
    try {
      const cuerpo = new FormData();
      cuerpo.set("egreso_id", egreso.id);
      cuerpo.set("comprobante", elegido);
      const respuesta = await fetch("/api/egresos/comprobante", { method: "POST", body: cuerpo });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        onFallo(datos.mensaje ?? "No se pudo subir el comprobante.");
        return;
      }
      onListo();
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <label className="xo-eyebrow cursor-pointer rounded-full border border-xo-negro/30 px-5 py-2.5 whitespace-nowrap text-xo-gris transition-colors hover:border-xo-negro hover:text-xo-negro">
      {subiendo ? "Subiendo…" : "Adjuntar comprobante"}
      <input
        ref={archivo}
        type="file"
        accept="application/pdf,image/jpeg,image/webp"
        className="sr-only"
        onChange={subir}
        disabled={subiendo}
      />
    </label>
  );
}
