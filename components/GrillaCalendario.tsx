"use client";

import { useState } from "react";
import Link from "next/link";
import { rangoHorario } from "@/lib/dominio/horarios";
import {
  MINUTOS_POR_TRAMO,
  tramoDe,
  tramosQueOcupa,
  ventanaDeHoras,
} from "@/lib/dominio/grilla";
import { lugaresLibres, type ClaseDelCalendario } from "@/lib/compras";
import { diaEnSantiago, nombreDelDia, numeroDelDia } from "@/lib/semana";

/**
 * El calendario público, como **grilla semanal con tramos de media hora**.
 *
 * ---
 *
 * **Por qué no se reusó `GrillaSemanal`**, que es la pregunta que hay que
 * contestar antes de escribir otro componente con un nombre parecido: esa
 * **apila** las clases de cada día en una lista, sin eje de tiempo. Sirve para
 * lo que hace —que una profesora vea qué bloques están ocupados— pero no puede
 * representar una clase de 90 minutos, porque en una lista todas las clases
 * miden lo mismo. Acá el alto **es** la duración, y esa es toda la diferencia.
 * Se suman tres más: aquella es de servidor y del portal en modo claro, usa otro
 * tipo de clase, y tiene la lógica de "mía / ajena" que acá no aplica.
 *
 * Lo que sí se comparte es lo que importa: `rangoHorario` y la aritmética de
 * `lib/dominio/grilla.ts`, que tienen tests.
 *
 * **Los tramos son de media hora y la media va marcada más tenue**, para que una
 * clase de 19:30 se lea de un vistazo sin contar líneas.
 */
export function GrillaCalendario({ clases }: { clases: ClaseDelCalendario[] }) {
  const [semana, setSemana] = useState(0);

  const porSemana = new Map<number, ClaseDelCalendario[]>();
  const hoy = new Date();
  for (const clase of clases) {
    const dias = Math.floor(
      (new Date(clase.inicio).getTime() - hoy.getTime()) / (24 * 60 * 60 * 1000),
    );
    const n = Math.max(0, Math.floor((dias + hoy.getDay()) / 7));
    porSemana.set(n, [...(porSemana.get(n) ?? []), clase]);
  }

  const semanas = [...porSemana.keys()].sort((a, b) => a - b);
  const actual = semanas.includes(semana) ? semana : (semanas[0] ?? 0);
  const deLaSemana = porSemana.get(actual) ?? [];

  const { desde, hasta } = ventanaDeHoras(deLaSemana);
  const filas = (hasta - desde) * (60 / MINUTOS_POR_TRAMO);

  // Los días que de verdad tienen clases esta semana. Mostrar los siete con
  // cuatro vacíos es hacer scrollear de más en el teléfono.
  const dias = [...new Set(deLaSemana.map((c) => diaEnSantiago(new Date(c.inicio))))].sort();

  const indice = semanas.indexOf(actual);

  return (
    <div className="mt-12">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={indice <= 0}
          onClick={() => setSemana(semanas[indice - 1])}
          className="xo-eyebrow rounded-full border border-xo-blanco/25 px-4 py-2 text-xo-blanco/80 transition-colors hover:border-xo-blanco/60 disabled:opacity-30"
        >
          <span aria-hidden="true">← </span>Antes
        </button>
        <button
          type="button"
          disabled={indice >= semanas.length - 1}
          onClick={() => setSemana(semanas[indice + 1])}
          className="xo-eyebrow rounded-full border border-xo-blanco/25 px-4 py-2 text-xo-blanco/80 transition-colors hover:border-xo-blanco/60 disabled:opacity-30"
        >
          Después<span aria-hidden="true"> →</span>
        </button>
        <span className="xo-eyebrow ml-2 text-xo-blanco/50">
          {deLaSemana.length} {deLaSemana.length === 1 ? "clase" : "clases"}
        </span>
      </div>

      {/* La grilla desborda a lo ancho en el teléfono y se scrollea sola: el
          contenedor lo hace, no la página. */}
      <div className="overflow-x-auto pb-2">
        <div
          className="grid min-w-[44rem] gap-px"
          style={{ gridTemplateColumns: `4rem repeat(${dias.length}, minmax(9rem, 1fr))` }}
        >
          {/* Encabezado de días */}
          <div aria-hidden="true" />
          {dias.map((dia) => (
            <div key={dia} className="pb-3 text-center">
              <p className="xo-eyebrow text-xo-rosa">{nombreDelDia(dia)}</p>
              <p className="mt-1 font-display text-2xl leading-none text-xo-blanco">
                {numeroDelDia(dia)}
              </p>
            </div>
          ))}

          {/* La columna de horas y el fondo con sus líneas */}
          <div
            className="grid"
            style={{ gridTemplateRows: `repeat(${filas}, 1.75rem)` }}
          >
            {Array.from({ length: filas }, (_, i) => {
              const enPunto = i % 2 === 0;
              return (
                <div key={i} className="relative">
                  {enPunto ? (
                    <span className="absolute -top-2 right-3 text-xs text-xo-blanco/40">
                      {String(desde + i / 2).padStart(2, "0")}:00
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {dias.map((dia) => (
            <div
              key={dia}
              className="relative grid"
              style={{ gridTemplateRows: `repeat(${filas}, 1.75rem)` }}
            >
              {/* Las líneas: la hora en punto más marcada, la media más tenue.
                  Es lo que permite ubicar una clase de 19:30 sin contar. */}
              {Array.from({ length: filas }, (_, i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  className={`border-t ${
                    i % 2 === 0 ? "border-xo-blanco/15" : "border-xo-blanco/[0.06]"
                  }`}
                  style={{ gridRow: i + 1 }}
                />
              ))}

              {deLaSemana
                .filter((c) => diaEnSantiago(new Date(c.inicio)) === dia)
                .map((clase) => {
                  const libres = lugaresLibres(clase);
                  const inicio = tramoDe(clase.inicio, desde);
                  const alto = tramosQueOcupa(clase.inicio, clase.fin);

                  return (
                    <Link
                      key={clase.id}
                      href={libres > 0 ? `/reservar/${clase.id}` : "/calendario"}
                      aria-disabled={libres === 0}
                      style={{ gridRow: `${inicio + 1} / span ${alto}` }}
                      className={`z-10 mx-1 overflow-hidden rounded border px-2 py-1.5 transition-colors ${
                        libres > 0
                          ? "border-xo-rosa/40 bg-xo-rosa/15 hover:border-xo-rosa hover:bg-xo-rosa/25"
                          : "pointer-events-none border-xo-blanco/15 bg-xo-negro-alt"
                      }`}
                    >
                      <p className="text-xs leading-tight font-semibold text-xo-blanco">
                        {clase.cursoNombre}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-xo-blanco/70">
                        {rangoHorario(clase.inicio, clase.fin)}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-xo-blanco/60">
                        {clase.profesoraNombre}
                      </p>
                      {alto > 2 ? (
                        <p className="mt-1 text-[11px] leading-tight text-xo-blanco/50">
                          {clase.sedeNombre}
                        </p>
                      ) : null}
                      <p
                        className={`mt-1 text-[11px] leading-tight ${
                          libres === 0 ? "text-xo-blanco/50" : "text-xo-rosa-claro"
                        }`}
                      >
                        {libres === 0 ? "Llena" : `${libres} ${libres === 1 ? "lugar" : "lugares"}`}
                      </p>
                    </Link>
                  );
                })}
            </div>
          ))}
        </div>
      </div>

      <p className="mt-6 text-sm text-xo-blanco/50">
        Cada línea es media hora. Toca una clase para reservarla.{" "}
        <span className="text-xo-blanco/70">
          Las horas están en horario de Santiago.
        </span>
      </p>
    </div>
  );
}
