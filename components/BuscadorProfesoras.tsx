"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { Placeholder } from "./Placeholder";
import { cursosDeProfesora } from "@/lib/catalogo";
import type { Curso, Horario, Profesora } from "@/lib/catalogo";

/**
 * Las profesoras, con buscador por nombre y filtro por estilo.
 *
 * **Los estilos salen de los horarios, no de una lista escrita acá.** Cada
 * profesora aparece bajo los cursos que de verdad dicta, así que el día que
 * alguien cambie de estilo el filtro lo refleja solo. Una lista a mano sería un
 * segundo lugar donde vive el catálogo, que es la incoherencia que este proyecto
 * ya tuvo una vez.
 *
 * El buscador **ignora tildes**: quien escribe "lina" tiene que encontrar a
 * Lina, y quien escribe "Maida" sin saber cómo se acentúa, también.
 */
export function BuscadorProfesoras({
  profesoras,
  cursos,
  horarios,
}: {
  profesoras: Profesora[];
  cursos: Curso[];
  horarios: Horario[];
}) {
  const [texto, setTexto] = useState("");
  const [estilo, setEstilo] = useState<string | null>(null);

  /** Qué cursos dicta cada una, por nombre, calculado una vez. */
  const suyos = useMemo(() => {
    const mapa = new Map<string, string[]>();
    for (const p of profesoras) {
      mapa.set(
        p.slug,
        cursosDeProfesora(horarios, cursos, p.slug).map((c) => c.nombre),
      );
    }
    return mapa;
  }, [profesoras, cursos, horarios]);

  /** Los estilos que alguien dicta de verdad, sin repetir. */
  const estilos = useMemo(
    () => [...new Set([...suyos.values()].flat())].sort(),
    [suyos],
  );

  const visibles = profesoras.filter((p) => {
    const coincide = normalizar(p.nombre).includes(normalizar(texto));
    const dicta = estilo === null || (suyos.get(p.slug) ?? []).includes(estilo);
    return coincide && dicta;
  });

  return (
    <div className="mt-12">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <label className="block sm:max-w-xs sm:flex-1">
          <span className="xo-eyebrow text-xo-blanco/60">Buscar por nombre</span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Escribe un nombre"
            className="mt-2 w-full rounded-full border border-xo-blanco/25 bg-transparent px-5 py-3 text-xo-blanco placeholder:text-xo-blanco/40 focus:border-xo-rosa focus:outline-none"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <span className="xo-eyebrow mr-1 text-xo-blanco/60">Estilo</span>
          <Chip activo={estilo === null} onClick={() => setEstilo(null)}>
            Todos
          </Chip>
          {estilos.map((e) => (
            <Chip
              key={e}
              activo={estilo === e}
              onClick={() => setEstilo(estilo === e ? null : e)}
            >
              {e}
            </Chip>
          ))}
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="mt-14 text-lg text-xo-blanco/70">
          Ninguna profe coincide con eso.{" "}
          <button
            type="button"
            onClick={() => {
              setTexto("");
              setEstilo(null);
            }}
            className="text-xo-rosa underline underline-offset-4"
          >
            Ver todas
          </button>
        </p>
      ) : (
        <ul className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {visibles.map((profesora) => (
            <li key={profesora.slug}>
              <Link href={`/profesoras/${profesora.slug}`} className="group block">
                {profesora.foto ? (
                  <Image
                    src={profesora.foto}
                    alt={`Foto de ${profesora.nombre}`}
                    width={500}
                    height={625}
                    className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-85"
                  />
                ) : (
                  <Placeholder
                    etiqueta={`Foto de ${profesora.nombre}`}
                    className="aspect-[4/5] w-full"
                  />
                )}

                <h2 className="mt-5 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-none text-xo-blanco transition-colors group-hover:text-xo-rosa">
                  {profesora.nombre}
                </h2>
                <p className="mt-2 text-sm text-xo-blanco/65">
                  {(suyos.get(profesora.slug) ?? []).join(" · ") || profesora.estilo}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Sin tildes y en minúsculas: buscar "lina" tiene que encontrar a Lina. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`xo-eyebrow rounded-full border px-4 py-2 transition-colors ${
        activo
          ? "border-xo-rosa bg-xo-rosa text-xo-negro"
          : "border-xo-blanco/25 text-xo-blanco/70 hover:border-xo-blanco/60"
      }`}
    >
      {children}
    </button>
  );
}
