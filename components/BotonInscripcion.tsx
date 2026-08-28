"use client";

import { useSeleccion } from "./Seleccion";
import type { Origen } from "@/lib/tipos";

/**
 * Único camino al formulario. Preselecciona curso y profesora y guarda de qué
 * sección salió el click, que es lo que después dice qué convierte.
 */
export function BotonInscripcion({
  children,
  origen,
  cursoId = null,
  profesoraId = null,
  variante = "solido",
  tamano = "normal",
  className = "",
}: {
  children: React.ReactNode;
  origen: Origen;
  cursoId?: string | null;
  profesoraId?: string | null;
  variante?: "solido" | "borde";
  /** "compacto" es para la barra fija, donde no cabe el botón normal. */
  tamano?: "normal" | "compacto";
  className?: string;
}) {
  const { inscribirse } = useSeleccion();

  const estilos =
    variante === "solido"
      ? "bg-xo-rosa text-xo-negro hover:bg-xo-rosa-claro"
      : "border border-xo-rosa/60 text-xo-rosa hover:border-xo-rosa hover:bg-xo-rosa hover:text-xo-negro";

  const medidas =
    tamano === "compacto" ? "px-4 py-2.5 sm:px-5" : "px-6 py-3.5";

  return (
    <button
      type="button"
      onClick={() => inscribirse({ origen, cursoId, profesoraId })}
      className={`xo-eyebrow inline-flex items-center justify-center rounded-full whitespace-nowrap transition-colors ${medidas} ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}
