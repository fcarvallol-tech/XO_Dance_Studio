"use client";

import { useSeleccion } from "./Seleccion";
import type { CursoId, Origen, ProfesoraId } from "@/lib/tipos";

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
  className = "",
}: {
  children: React.ReactNode;
  origen: Origen;
  cursoId?: CursoId | null;
  profesoraId?: ProfesoraId | null;
  variante?: "solido" | "borde";
  className?: string;
}) {
  const { inscribirse } = useSeleccion();

  const estilos =
    variante === "solido"
      ? "bg-xo-rosa text-xo-negro hover:bg-xo-rosa-claro"
      : "border border-xo-rosa/60 text-xo-rosa hover:border-xo-rosa hover:bg-xo-rosa hover:text-xo-negro";

  return (
    <button
      type="button"
      onClick={() => inscribirse({ origen, cursoId, profesoraId })}
      className={`xo-eyebrow inline-flex items-center justify-center rounded-full px-6 py-3.5 transition-colors ${estilos} ${className}`}
    >
      {children}
    </button>
  );
}
