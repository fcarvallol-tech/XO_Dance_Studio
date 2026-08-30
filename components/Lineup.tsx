"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BotonInscripcion } from "./BotonInscripcion";
import { Placeholder } from "./Placeholder";
import { Reveal } from "./Reveal";
import {
  cursosDeProfesora,
  type Curso,
  type Horario,
  type Profesora,
} from "@/lib/catalogo";

/**
 * El lineup: las cinco profesoras como cartelera de festival.
 * Desktop activa por hover; en táctil, la fila que cruza el centro de la
 * pantalla al hacer scroll. Click abre la ficha.
 */
export function Lineup({
  cursos,
  profesoras,
  horarios,
}: {
  cursos: Curso[];
  profesoras: Profesora[];
  horarios: Horario[];
}) {
  const [activa, setActiva] = useState<string | null>(profesoras[0]?.slug ?? null);
  const [abierta, setAbierta] = useState<string | null>(null);
  const filas = useRef(new Map<string, HTMLElement>());

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
          if (id) setActiva(id);
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    for (const elemento of filas.current.values()) observer.observe(elemento);
    return () => observer.disconnect();
  }, []);

  const conMedia = profesoras.some((p) => p.video ?? p.foto);

  return (
    <section
      id="profesoras"
      className="xo-grain relative scroll-mt-20 overflow-hidden border-t border-xo-blanco/10 py-24 sm:py-32"
    >
      {/* Fondo que cambia con la profesora activa. Sin material todavía. */}
      {conMedia ? (
        <div aria-hidden="true" className="absolute inset-0">
          {profesoras.map((profesora) => (
            <FondoProfesora
              key={profesora.slug}
              profesora={profesora}
              activa={profesora.slug === activa}
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
        {profesoras.map((profesora, indice) => (
          <li key={profesora.slug}>
            {indice > 0 ? <Separador /> : null}
            <Fila
              profesora={profesora}
              cursos={cursos}
              horarios={horarios}
              activa={profesora.slug === activa}
              abierta={abierta === profesora.slug}
              onActivar={() => setActiva(profesora.slug)}
              onAbrir={() =>
                setAbierta((previa) =>
                  previa === profesora.slug ? null : profesora.slug,
                )
              }
              registrar={(elemento) => {
                if (elemento) filas.current.set(profesora.slug, elemento);
                else filas.current.delete(profesora.slug);
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
  cursos,
  horarios,
  activa,
  abierta,
  onActivar,
  onAbrir,
  registrar,
}: {
  profesora: Profesora;
  cursos: Curso[];
  horarios: Horario[];
  activa: boolean;
  abierta: boolean;
  onActivar: () => void;
  onAbrir: () => void;
  registrar: (elemento: HTMLElement | null) => void;
}) {
  const fichaId = `ficha-${profesora.slug}`;
  // Qué dicta se deriva de los horarios desde PRD-0016. La consulta pública
  // solo trae cursos activos, así que un curso fuera de catálogo no aparece.
  const nombresCursos = cursosDeProfesora(horarios, cursos, profesora.slug).map(
    (curso) => curso.nombre,
  );

  return (
    <div ref={registrar} data-profesora={profesora.slug}>
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

      {abierta ? (
        <Ficha id={fichaId} profesora={profesora} cursos={nombresCursos} />
      ) : null}
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
          <BotonInscripcion origen="ficha-profesora" profesoraId={profesora.slug}>
            Reservar clase con {profesora.nombre}
          </BotonInscripcion>

          <Link
            href={`/profesoras/${profesora.slug}`}
            className="xo-eyebrow text-xo-rosa underline-offset-4 hover:underline"
          >
            Ver el perfil de {profesora.nombre}
          </Link>

          <a
            href={profesora.instagram ?? "#"}
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
