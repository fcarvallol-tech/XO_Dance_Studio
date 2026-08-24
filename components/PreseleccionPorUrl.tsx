"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSeleccion } from "./Seleccion";
import { esProfesoraActiva } from "@/lib/profesoras";

/**
 * Puente entre los perfiles públicos y el formulario: `/?profesora=carli`
 * llega con la profe ya elegida.
 *
 * Va aislado en su propio componente y dentro de un <Suspense> porque
 * `useSearchParams` saca del prerender estático a todo lo que tenga encima.
 * Acá arriba no hay nada: la landing se sigue generando estática.
 */
export function PreseleccionPorUrl() {
  const parametros = useSearchParams();
  const { preseleccionar } = useSeleccion();

  const desdeUrl = parametros.get("profesora");

  useEffect(() => {
    if (!desdeUrl || !esProfesoraActiva(desdeUrl)) return;
    preseleccionar({ profesoraId: desdeUrl, origen: "perfil-profesora" });
  }, [desdeUrl, preseleccionar]);

  return null;
}
