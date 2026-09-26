"use client";

import { useState } from "react";

/**
 * Copiar un link al portapapeles.
 *
 * Existe porque el PRD lo pide por una razón concreta (PRD-0020 §12): si Carla
 * tiene que armar la URL a mano, no va a usar el link. El riesgo de esta feature
 * no es técnico, es que quede sin usarse.
 *
 * Si el navegador no deja copiar —contexto sin HTTPS, permiso denegado—, muestra
 * la URL para copiarla a mano en vez de fallar en silencio.
 */
export function CopiarLink({ url }: { url: string }) {
  const [estado, setEstado] = useState<"listo" | "copiado" | "manual">("listo");

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setEstado("copiado");
            setTimeout(() => setEstado("listo"), 2500);
          } catch {
            setEstado("manual");
          }
        }}
        className="xo-eyebrow rounded-full border border-xo-negro/25 px-4 py-2 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/60"
      >
        {estado === "copiado" ? "Copiado ✓" : "Copiar link"}
      </button>

      {estado === "manual" ? (
        <code className="text-xs break-all text-xo-gris">{url}</code>
      ) : null}
    </div>
  );
}
