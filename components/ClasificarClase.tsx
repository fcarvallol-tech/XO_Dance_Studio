"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { clasificarClase } from "@/lib/acciones-liquidacion";
import { CAUSAS, NOMBRE_CAUSA, type Causa } from "@/lib/dominio/liquidacion";

const CAMPO = "mt-1 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro";

/**
 * Decir por qué una clase no se dictó, o cambiarlo. Sin esto una clase sin causa
 * traba el mes entero y no habría cómo destrabarlo desde el sitio. Si la clase
 * estaba como dictada, la base la pasa a no dictada y devuelve los créditos.
 */
export function ClasificarClase({
  claseId,
  causa,
  etiqueta,
}: {
  claseId: string;
  causa: Causa | null;
  etiqueta: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [elegida, setElegida] = useState<string>(causa ?? "");
  const [detalle, setDetalle] = useState("");
  const [sePresento, setSePresento] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mt-2 text-sm text-xo-gris underline underline-offset-4"
      >
        {etiqueta}
      </button>
    );
  }

  function guardar() {
    setFallo(null);
    iniciar(async () => {
      const r = await clasificarClase({
        claseId,
        causa: elegida,
        detalle,
        seHabiaPresentado: elegida === "sala_no_disponible" && sePresento,
      });
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setAbierto(false);
      router.refresh();
    });
  }

  return (
    <div className="mt-3 max-w-md space-y-3 border-l-2 border-xo-negro/20 pl-4">
      <label className="block text-sm text-xo-negro">
        Causa
        <select value={elegida} onChange={(e) => setElegida(e.target.value)} className={CAMPO}>
          <option value="">Elige</option>
          {CAUSAS.map((c) => (
            <option key={c} value={c}>
              {NOMBRE_CAUSA[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm text-xo-negro">
        Qué pasó
        <input value={detalle} onChange={(e) => setDetalle(e.target.value)} className={CAMPO} />
      </label>
      {elegida === "sala_no_disponible" ? (
        <label className="flex items-start gap-3 text-sm text-xo-negro">
          <input type="checkbox" checked={sePresento} onChange={(e) => setSePresento(e.target.checked)} className="mt-1" />
          <span>La profesora llegó y no había sala: se le paga la base aunque se recupere.</span>
        </label>
      ) : null}
      {fallo ? (
        <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={elegida === "" || detalle.trim().length < 5 || enviando}
          onClick={guardar}
          className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
