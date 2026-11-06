"use client";

import { useState } from "react";
import { FormularioEspecial } from "@/components/FormularioEspecial";
import { FormularioRecuperativa } from "@/components/FormularioRecuperativa";
import { CATEGORIAS, ORDEN_CATEGORIAS, esCategoria, type Categoria } from "@/lib/dominio/categorias-clase";
import type { OpcionesEspecial } from "@/lib/especiales-admin";
import type { ClasePorRecuperar } from "@/lib/recuperativas-consultas";

/**
 * Crear una clase a mano: primero la categoría (PRD-0027).
 *
 * **Empieza sin elegir, a propósito:** la categoría decide con qué paga la alumna
 * y cómo cobra la profesora, y un valor por defecto la decidiría sin que nadie la
 * mire. Una categoría nueva es un caso en `CATEGORIAS` y un caso acá.
 */
export function FormularioClase({
  categoriaInicial,
  claseInicial,
  porRecuperar,
  opciones,
  esOwner,
}: {
  categoriaInicial: string | undefined;
  claseInicial: string | undefined;
  porRecuperar: ClasePorRecuperar[];
  opciones: OpcionesEspecial;
  esOwner: boolean;
}) {
  const [categoria, setCategoria] = useState<Categoria | "">(
    esCategoria(categoriaInicial) ? categoriaInicial : "",
  );

  return (
    <>
      <div className="mb-10 max-w-xl">
        <label htmlFor="categoria" className="xo-eyebrow text-xo-gris">
          Categoría *
        </label>
        <select
          id="categoria"
          value={categoria}
          onChange={(e) => setCategoria(esCategoria(e.target.value) ? e.target.value : "")}
          className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
        >
          <option value="">Elige</option>
          {ORDEN_CATEGORIAS.map((c) => (
            <option key={c} value={c}>
              {CATEGORIAS[c].nombre}
            </option>
          ))}
        </select>
        {categoria ? (
          <p className="mt-2 text-sm leading-relaxed text-xo-gris">{CATEGORIAS[categoria].queEs}</p>
        ) : null}
      </div>

      {categoria === "recuperativa" ? (
        <FormularioRecuperativa porRecuperar={porRecuperar} opciones={opciones} claseInicial={claseInicial} />
      ) : null}
      {categoria === "especial" ? (
        <FormularioEspecial especial={null} opciones={opciones} esOwner={esOwner} />
      ) : null}
    </>
  );
}
