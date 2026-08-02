"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CursoId, Origen, ProfesoraId } from "@/lib/tipos";

export type Seleccion = {
  cursoId: CursoId | null;
  profesoraId: ProfesoraId | null;
  origen: Origen;
};

type Contexto = {
  seleccion: Seleccion;
  /** Preselecciona curso y profesora, y lleva el foco al formulario. */
  inscribirse: (parcial: Partial<Seleccion> & { origen: Origen }) => void;
  setCursoId: (id: CursoId | null) => void;
};

const SeleccionContext = createContext<Contexto | null>(null);

const INICIAL: Seleccion = {
  cursoId: null,
  profesoraId: null,
  origen: "formulario",
};

export function SeleccionProvider({ children }: { children: React.ReactNode }) {
  const [seleccion, setSeleccion] = useState<Seleccion>(INICIAL);

  const inscribirse = useCallback<Contexto["inscribirse"]>((parcial) => {
    setSeleccion({
      cursoId: parcial.cursoId ?? null,
      profesoraId: parcial.profesoraId ?? null,
      origen: parcial.origen,
    });

    const destino = document.getElementById("inscripcion");
    if (!destino) return;

    const sinMovimiento = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    destino.scrollIntoView({
      behavior: sinMovimiento ? "auto" : "smooth",
      block: "start",
    });
    // El foco sigue al scroll: si no, quien navega con teclado queda arriba.
    document.getElementById("nombre")?.focus({ preventScroll: true });
  }, []);

  const setCursoId = useCallback((id: CursoId | null) => {
    setSeleccion((previa) => ({ ...previa, cursoId: id }));
  }, []);

  const valor = useMemo(
    () => ({ seleccion, inscribirse, setCursoId }),
    [seleccion, inscribirse, setCursoId],
  );

  return (
    <SeleccionContext.Provider value={valor}>
      {children}
    </SeleccionContext.Provider>
  );
}

export function useSeleccion(): Contexto {
  const contexto = useContext(SeleccionContext);
  if (!contexto) {
    throw new Error("useSeleccion debe usarse dentro de <SeleccionProvider>");
  }
  return contexto;
}
