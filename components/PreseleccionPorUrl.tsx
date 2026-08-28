"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useSeleccion } from "./Seleccion";

/**
 * Puente entre los perfiles públicos y el formulario: `/?profesora=carli`
 * llega con la profe ya elegida.
 *
 * Va aislado en su propio componente y dentro de un <Suspense> porque
 * `useSearchParams` saca del prerender estático a todo lo que tenga encima.
 * Acá arriba no hay nada: la landing se sigue generando estática.
 */
export function PreseleccionPorUrl({
  slugsValidos,
}: {
  /** Las profesoras activas. Llegan por props: el catálogo vive en la base y
      un componente cliente no la consulta. */
  slugsValidos: string[];
}) {
  const parametros = useSearchParams();
  const { preseleccionar } = useSeleccion();

  const desdeUrl = parametros.get("profesora");

  useEffect(() => {
    if (!desdeUrl || !slugsValidos.includes(desdeUrl)) return;
    preseleccionar({ profesoraId: desdeUrl, origen: "perfil-profesora" });
  }, [desdeUrl, slugsValidos, preseleccionar]);

  return null;
}
