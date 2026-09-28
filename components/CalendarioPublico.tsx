"use client";

import { useState } from "react";
import Link from "next/link";
import {
  claveDia,
  diaLegible,
  lugaresLibres,
  type ClaseDelCalendario,
} from "@/lib/compras";
import { rangoHorario } from "@/lib/dominio/horarios";

/**
 * El calendario que se ve sin cuenta.
 *
 * Es primo de `Calendario.tsx` —el de la alumna— pero **no el mismo**, y la
 * diferencia no es cosmética: allá cada clase tiene botones que mueven créditos
 * y cupos; acá no hay ninguna acción, solo un enlace que lleva a reservar. Un
 * componente que hiciera las dos cosas tendría que saber si hay sesión, y esa
 * es exactamente la clase de rama que después nadie prueba en los dos estados.
 *
 * El filtro por profesora **atenúa en vez de esconder**, como pide `BRAND.md`
 * §6: una clase atenuada sigue siendo información —"ese día hay algo, aunque no
 * sea de ella"— y esconderla haría parecer que el día está libre.
 */
export function CalendarioPublico({ clases }: { clases: ClaseDelCalendario[] }) {
  const [profesora, setProfesora] = useState<string | null>(null);

  const profesoras = [
    ...new Map(clases.map((c) => [c.profesoraSlug, c.profesoraNombre])).entries(),
  ];

  const porDia = new Map<string, ClaseDelCalendario[]>();
  for (const clase of clases) {
    const dia = claveDia(clase.inicio);
    porDia.set(dia, [...(porDia.get(dia) ?? []), clase]);
  }

  return (
    <div className="mt-12">
      <div className="mb-10 flex flex-wrap items-center gap-2">
        <span className="xo-eyebrow mr-2 text-xo-blanco/60">Filtrar</span>
        <Chip activo={profesora === null} onClick={() => setProfesora(null)}>
          Todas
        </Chip>
        {profesoras.map(([slug, nombre]) => (
          <Chip
            key={slug}
            activo={profesora === slug}
            onClick={() => setProfesora(profesora === slug ? null : slug)}
          >
            {nombre}
          </Chip>
        ))}
      </div>

      <ul className="space-y-10">
        {[...porDia.entries()].map(([dia, delDia]) => (
          <li key={dia}>
            <h2 className="xo-eyebrow text-xo-rosa-claro">
              {diaLegible(delDia[0].inicio)}
            </h2>

            <ul className="mt-4 divide-y divide-xo-blanco/10 border-y border-xo-blanco/10">
              {delDia.map((clase) => {
                const libres = lugaresLibres(clase);
                const atenuada = profesora !== null && clase.profesoraSlug !== profesora;

                return (
                  <li
                    key={clase.id}
                    className={`flex flex-wrap items-center justify-between gap-4 py-4 transition-opacity ${
                      atenuada ? "opacity-55" : ""
                    }`}
                  >
                    <div>
                      <p className="text-lg text-xo-blanco">
                        <span className="font-semibold">
                          {rangoHorario(clase.inicio, clase.fin)}
                        </span>{" "}
                        · {clase.cursoNombre}
                      </p>
                      <p className="mt-1 text-sm text-xo-blanco/65">
                        Con {clase.profesoraNombre} · {clase.sedeNombre},{" "}
                        {clase.sedeComuna}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm whitespace-nowrap text-xo-blanco/65">
                        {libres === 0
                          ? "Llena"
                          : `${libres} ${libres === 1 ? "lugar" : "lugares"}`}
                      </span>

                      {libres > 0 ? (
                        <Link
                          href={`/reservar/${clase.id}`}
                          className="xo-eyebrow rounded-full border border-xo-rosa/50 px-4 py-2 whitespace-nowrap text-xo-rosa transition-colors hover:bg-xo-rosa hover:text-xo-negro"
                        >
                          Reservar
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
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
