"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { CursoId, Origen, ProfesoraId } from "@/lib/tipos";

export type Seleccion = {
  cursoId: CursoId | null;
  profesoraId: ProfesoraId | null;
  origen: Origen;
};

type Parcial = Partial<Seleccion> & { origen: Origen };

type Contexto = {
  seleccion: Seleccion;
  /** Preselecciona profesora y curso, y lleva el foco al formulario. */
  inscribirse: (parcial: Parcial) => void;
  /**
   * Solo preselecciona. Es para cuando la visitante llega desde otra ruta con
   * el ancla puesta: el navegador ya hizo el scroll y robarle el foco sería
   * moverla dos veces.
   */
  preseleccionar: (parcial: Parcial) => void;
  setProfesoraId: (id: ProfesoraId | null) => void;
};

const SeleccionContext = createContext<Contexto | null>(null);

const INICIAL: Seleccion = {
  cursoId: null,
  profesoraId: null,
  origen: "formulario",
};

export function SeleccionProvider({ children }: { children: React.ReactNode }) {
  const [seleccion, setSeleccion] = useState<Seleccion>(INICIAL);

  const preseleccionar = useCallback<Contexto["preseleccionar"]>((parcial) => {
    setSeleccion({
      cursoId: parcial.cursoId ?? null,
      profesoraId: parcial.profesoraId ?? null,
      origen: parcial.origen,
    });
  }, []);

  const inscribirse = useCallback<Contexto["inscribirse"]>(
    (parcial) => {
      preseleccionar(parcial);

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
    },
    [preseleccionar],
  );

  const setProfesoraId = useCallback((id: ProfesoraId | null) => {
    setSeleccion((previa) => ({ ...previa, profesoraId: id }));
  }, []);

  const valor = useMemo(
    () => ({ seleccion, inscribirse, preseleccionar, setProfesoraId }),
    [seleccion, inscribirse, preseleccionar, setProfesoraId],
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
