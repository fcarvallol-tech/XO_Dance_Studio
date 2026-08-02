"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { BotonInscripcion } from "./BotonInscripcion";
import { Placeholder } from "./Placeholder";
import { Reveal } from "./Reveal";
import { getCurso } from "@/lib/cursos";
import { PROFESORAS, type Profesora } from "@/lib/profesoras";
import type { ProfesoraId } from "@/lib/tipos";

/**
 * El lineup: las cinco profesoras como cartelera de festival.
 * Desktop activa por hover; en táctil, la fila que cruza el centro de la
 * pantalla al hacer scroll. Click abre la ficha.
 */
export function Lineup() {
  const [activa, setActiva] = useState<ProfesoraId>(PROFESORAS[0].id);
  const [abierta, setAbierta] = useState<ProfesoraId | null>(null);
  const filas = useRef(new Map<ProfesoraId, HTMLElement>());

  useEffect(() => {
    // Con mouse manda el hover. Sin mouse, manda el scroll.
    if (
      window.matchMedia("(hover: hover)").matches ||
      typeof IntersectionObserver === "undefined"
    ) {
      return;
    }

    // Banda angosta al centro del viewport: se activa la fila que la cruza.
    const observer = new IntersectionObserver(
      (entradas) => {
        for (const entrada of entradas) {
          if (!entrada.isIntersecting) continue;
          const id = entrada.target.getAttribute("data-profesora");
          if (id) setActiva(id as ProfesoraId);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const elemento of filas.current.values()) observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  const conMedia = PROFESORAS.some((p) => p.video ?? p.foto);

  return (
    <section
      id="profesoras"
      className="xo-grain relative overflow-hidden border-t border-xo-blanco/10 py-24 sm:py-32"
    >
      {/* Fondo que cambia con la profesora activa. Sin material todavía. */}
      {conMedia ? (
        <div aria-hidden="true" className="absolute inset-0">
          {PROFESORAS.map((profesora) => (
            <FondoProfesora
              key={profesora.id}
              profesora={profesora}
              activa={profesora.id === activa}
            />
          ))}
          <div className="absolute inset-0 bg-xo-negro/70" />
        </div>
      ) : null}

      <Reveal className="relative px-6 sm:px-10">
        <p className="xo-eyebrow text-xo-rosa">Las profes</p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Cinco profes, cinco formas de bailar
        </h2>
        <p className="mt-5 max-w-md text-xo-blanco/70">
          Toca un nombre para ver quién es, qué enseña y dónde encontrarla.
        </p>
      </Reveal>

      <ul className="relative mt-14 px-6 sm:px-10">
        {PROFESORAS.map((profesora, indice) => (
          <li key={profesora.id}>
            {indice > 0 ? <Separador /> : null}
            <Fila
              profesora={profesora}
              activa={profesora.id === activa}
              abierta={abierta === profesora.id}
              onActivar={() => setActiva(profesora.id)}
              onAbrir={() =>
                setAbierta((previa) =>
                  previa === profesora.id ? null : profesora.id,
                )
              }
              registrar={(elemento) => {
                if (elemento) filas.current.set(profesora.id, elemento);
                else filas.current.delete(profesora.id);
              }}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Separador() {
  return (
    <div aria-hidden="true" className="flex items-center gap-4">
      <span className="h-px flex-1 bg-xo-blanco/15" />
      <span className="text-xs text-xo-rosa/60">✦</span>
      <span className="h-px flex-1 bg-xo-blanco/15" />
    </div>
  );
}

function FondoProfesora({
  profesora,
  activa,
}: {
  profesora: Profesora;
  activa: boolean;
}) {
  const media = profesora.video ?? profesora.foto;
  if (!media) return null;

  return (
    <div
      className={`absolute inset-0 transition-opacity duration-500 ${
        activa ? "opacity-100" : "opacity-0"
      }`}
    >
      {profesora.video ? (
        <video
          src={profesora.video}
          poster={profesora.foto ?? undefined}
          muted
          loop
          playsInline
          autoPlay
          className="h-full w-full object-cover"
        />
      ) : (
        <Image
          src={media}
          alt=""
          fill
          sizes="100vw"
          className="object-cover"
        />
      )}
    </div>
  );
}

function Fila({
  profesora,
  activa,
  abierta,
  onActivar,
  onAbrir,
  registrar,
}: {
  profesora: Profesora;
  activa: boolean;
  abierta: boolean;
  onActivar: () => void;
  onAbrir: () => void;
  registrar: (elemento: HTMLElement | null) => void;
}) {
  const fichaId = `ficha-${profesora.id}`;
  const cursos = profesora.cursos
    .map((id) => getCurso(id)?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));

  return (
    <div ref={registrar} data-profesora={profesora.id}>
      <h3>
        <button
          type="button"
          aria-expanded={abierta}
          aria-controls={fichaId}
          onClick={onAbrir}
          onMouseEnter={onActivar}
          onFocus={onActivar}
          className="block w-full py-6 text-left"
        >
          <span
            className={`xo-eyebrow block transition-colors duration-300 ${
              activa ? "text-xo-rosa-claro" : "text-xo-blanco/35"
            }`}
          >
            {profesora.estilo}
          </span>
          <span
            className={`mt-2 block font-display text-[clamp(3rem,12vw,9rem)] leading-[0.85] transition-colors duration-300 ${
              activa ? "text-xo-rosa" : "text-xo-blanco/25"
            }`}
          >
            {profesora.nombre}
          </span>
        </button>
      </h3>

      {abierta ? <Ficha id={fichaId} profesora={profesora} cursos={cursos} /> : null}
    </div>
  );
}

function Ficha({
  id,
  profesora,
  cursos,
}: {
  id: string;
  profesora: Profesora;
  cursos: string[];
}) {
  return (
    <div
      id={id}
      className="grid gap-8 border-t border-xo-blanco/15 pt-8 pb-10 sm:grid-cols-[minmax(0,20rem)_1fr] sm:gap-12"
    >
      {profesora.video ? (
        <video
          src={profesora.video}
          poster={profesora.foto ?? undefined}
          controls
          playsInline
          className="w-full bg-xo-negro-alt"
        />
      ) : profesora.foto ? (
        <Image
          src={profesora.foto}
          alt={`${profesora.nombre}, profesora de XO Dance Studio`}
          width={640}
          height={853}
          className="w-full"
        />
      ) : (
        <Placeholder
          etiqueta={`Video de ${profesora.nombre} pendiente`}
          className="aspect-[3/4]"
        />
      )}

      <div>
        <p className="max-w-prose text-lg leading-relaxed text-xo-blanco/85">
          {profesora.bio}
        </p>

        <p className="xo-eyebrow mt-8 text-xo-rosa-claro">Hace clases en</p>
        <ul className="mt-3 flex flex-wrap gap-2">
          {cursos.map((curso) => (
            <li
              key={curso}
              className="rounded-full border border-xo-rosa/40 px-3.5 py-1.5 text-sm text-xo-blanco/80"
            >
              {curso}
            </li>
          ))}
        </ul>

        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
          <BotonInscripcion
            origen="ficha-profesora"
            profesoraId={profesora.id}
            cursoId={profesora.cursos[0] ?? null}
          >
            Quiero clase con {profesora.nombre}
          </BotonInscripcion>

          <a
            href={profesora.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="xo-eyebrow text-xo-rosa underline-offset-4 hover:underline"
          >
            Instagram de {profesora.nombre}
          </a>
        </div>
      </div>
    </div>
  );
}
