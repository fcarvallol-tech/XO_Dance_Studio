"use client";

import { Fragment as Fragmento, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { rangoHorario } from "@/lib/dominio/horarios";
import {
  MINUTOS_POR_TRAMO,
  semanasDeLaGrilla,
  tramoDe,
  tramosQueOcupa,
  ventanaDeHoras,
} from "@/lib/dominio/grilla";
import { lugaresLibres, type ClaseDelCalendario } from "@/lib/compras";
import {
  diaEnSantiago,
  diasDeLaSemana,
  lunesDe,
  nombreDelDia,
  rangoLegible,
} from "@/lib/semana";

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
 *
 * **Siempre los siete días, y todas las semanas seguidas** (Felipe, 29/09/2026).
 * Un día sin clases es un dato —"el miércoles no hay"—, y esconderlo hacía que
 * la semana pareciera empezar el martes. Lo mismo con las semanas: una sin
 * clases se muestra vacía en vez de saltársela.
 *
 * **En el teléfono, un día a la vez.** Siete columnas a 375 px son de unos 44 px,
 * donde no cabe "Salsa · 19:30 · Pau · 8 lugares", y cortar el texto justo donde
 * está lo útil es peor que no mostrarlo. Bajo `lg` se ve la columna del día
 * elegido, con los siete días como botones arriba; desde `lg`, la semana entera.
 * No desde `md`: a 768 px las columnas dejan unos 65 px de texto, el nombre y
 * la línea de hora y lugares se parten en dos cada uno, y una clase de una hora
 * vuelve a perder los lugares. Medido, no supuesto: ver `verificar-sitio.mjs`.
 * Es el mismo DOM con otras clases de CSS, no dos grillas que mantener.
 *
 * ---
 *
 * **Es la grilla de todos los portales, no solo la del sitio público**
 * (PRD-0007 §8). El portal de alumna la usa para reservar, y no puede tener una
 * propia: dos calendarios divergen al primer ajuste. Lo que cambia entre uno y
 * otro son dos cosas, y nada más:
 *
 * - **`tema`**: el sitio es negro y los portales son claros (BRAND.md §8). Los
 *   colores del marco salen de `TEMAS`, y en el claro **ningún texto es rosa**:
 *   sobre blanco da 1,7:1 y `estilo.md` lo prohíbe.
 * - **`bloque`**: qué va dentro de cada clase. En el sitio es un enlace a
 *   reservar; en el portal, un botón con el estado de ella. La posición la
 *   calcula la grilla y se la entrega armada, así que lo que cambia es el
 *   contenido, nunca dónde cae ni cuánto mide.
 */
export function GrillaCalendario({
  clases,
  hoy,
  tema = "oscuro",
  bloque,
  pie,
}: {
  clases: ClaseDelCalendario[];
  /** Hoy en Santiago, del servidor: así la página y la grilla usan el mismo día. */
  hoy: string;
  tema?: Tema;
  /**
   * Lo que se dibuja en cada clase. Recibe la posición ya calculada y **la
   * tiene que aplicar** —`style` y `className`— al elemento de afuera. Sin él,
   * el enlace del sitio público.
   */
  bloque?: (clase: ClaseDelCalendario, ubicacion: Ubicacion) => ReactNode;
  /** La nota al pie. Sin ella, la del sitio público. */
  pie?: ReactNode;
}) {
  const T = TEMAS[tema];
  const porDia = new Map<string, ClaseDelCalendario[]>();
  for (const clase of clases) {
    const dia = diaEnSantiago(new Date(clase.inicio));
    porDia.set(dia, [...(porDia.get(dia) ?? []), clase]);
  }

  const semanas = semanasDeLaGrilla([...porDia.keys()], hoy);
  const [indice, setIndice] = useState(
    // La de hoy, que siempre está. Solo no es la primera si llegó una clase ya
    // pasada, y el calendario no debería mandarlas.
    Math.max(0, semanas.indexOf(lunesDe(hoy))),
  );
  const lunes = semanas[Math.min(indice, semanas.length - 1)];
  const dias = diasDeLaSemana(lunes);
  const deLaSemana = dias.flatMap((d) => porDia.get(d) ?? []);

  // El día que se ve en el teléfono. `null` es "el que toca por defecto", que
  // se recalcula al cambiar de semana.
  const [elegido, setElegido] = useState<string | null>(null);
  const diaVisible =
    elegido && dias.includes(elegido) ? elegido : diaPorDefecto(dias, porDia, hoy);

  const { desde, hasta } = ventanaDeHoras(deLaSemana);
  const filas = (hasta - desde) * (60 / MINUTOS_POR_TRAMO);

  const irA = (i: number) => {
    setIndice(i);
    setElegido(null);
  };

  const boton = T.boton;

  return (
    <div className="mt-12">
      <div className="mb-8 flex flex-wrap items-center gap-3">
        <button type="button" disabled={indice <= 0} onClick={() => irA(indice - 1)} className={boton}>
          <span aria-hidden="true">← </span>Antes
        </button>
        <button
          type="button"
          disabled={indice >= semanas.length - 1}
          onClick={() => irA(indice + 1)}
          className={boton}
        >
          Después<span aria-hidden="true"> →</span>
        </button>
        {/* Sin el número en cada columna, esto es lo único que dice qué semana
            se está mirando. */}
        <p className={`ml-1 basis-full text-sm sm:basis-auto ${T.rango}`} aria-live="polite">
          Del {rangoLegible(lunes)}
          <span className={`whitespace-nowrap ${T.rangoSub}`}>
            {" · "}
            {deLaSemana.length === 0
              ? "sin clases"
              : `${deLaSemana.length} ${deLaSemana.length === 1 ? "clase" : "clases"}`}
          </span>
        </p>
      </div>

      {/* Teléfono: los siete días como botones. Los que no tienen clases se ven
          más apagados, pero se pueden tocar igual. */}
      <div className="mb-4 grid grid-cols-7 gap-1 lg:hidden" role="group" aria-label="Día">
        {dias.map((dia) => {
          const tiene = (porDia.get(dia)?.length ?? 0) > 0;
          const activo = dia === diaVisible;
          return (
            <button
              key={dia}
              type="button"
              aria-pressed={activo}
              aria-label={nombreDelDia(dia)}
              onClick={() => setElegido(dia)}
              className={`xo-eyebrow flex min-h-11 flex-col items-center justify-center gap-1 rounded border transition-colors ${
                activo ? T.diaActivo : tiene ? T.diaTiene : T.diaVacio
              }`}
            >
              {abreviado(dia)}
              <span
                aria-hidden="true"
                className={`size-1 rounded-full ${
                  tiene ? (activo ? "bg-xo-negro" : "bg-xo-rosa") : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto pb-2">
        {/* La cuadrícula completa: borde por fuera, una línea vertical entre
            días y una horizontal por tramo. */}
        <div className={`grid min-w-0 grid-cols-[3rem_minmax(0,1fr)] border-t border-l lg:grid-cols-[4rem_repeat(7,minmax(0,1fr))] ${T.borde}`}>
          {/* Encabezado de días */}
          <div aria-hidden="true" className={`border-r border-b ${T.borde}`} />
          {dias.map((dia) => (
            <div
              key={dia}
              className={`${dia === diaVisible ? "block" : "hidden"} border-r border-b py-3 text-center lg:block ${T.borde}`}
            >
              <p className={`xo-eyebrow ${T.encabezado}`}>{nombreDelDia(dia)}</p>
            </div>
          ))}

          {/* La columna de horas */}
          <div
            className={`grid border-r ${T.borde}`}
            style={{ gridTemplateRows: `repeat(${filas}, 1.75rem)` }}
          >
            {Array.from({ length: filas }, (_, i) => {
              const enPunto = i % 2 === 0;
              return (
                <div
                  key={i}
                  className={`relative border-b ${
                    i % 2 === 0 ? T.lineaTenue : T.borde
                  }`}
                >
                  {enPunto ? (
                    <span className={`absolute top-1 right-2 text-xs ${T.hora}`}>
                      {String(desde + i / 2).padStart(2, "0")}:00
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {dias.map((dia) => {
            const delDia = porDia.get(dia) ?? [];
            return (
              <div
                key={dia}
                className={`${dia === diaVisible ? "grid" : "hidden"} relative border-r lg:grid ${T.borde}`}
                style={{ gridTemplateRows: `repeat(${filas}, 1.75rem)` }}
              >
                {/* Una línea al pie de cada tramo: la que cierra la hora en punto
                    más marcada, la de la media más tenue. Es lo que permite
                    ubicar una clase de 19:30 sin contar. */}
                {Array.from({ length: filas }, (_, i) => (
                  <div
                    key={i}
                    aria-hidden="true"
                    className={`border-b ${
                      i % 2 === 0 ? T.lineaTenue : T.borde
                    }`}
                    style={{ gridRow: i + 1, gridColumn: 1 }}
                  />
                ))}

                {delDia.length === 0 ? (
                  <p
                    className={`self-start px-3 pt-3 text-sm lg:hidden ${T.vacio}`}
                    style={{ gridRow: 1, gridColumn: 1 }}
                  >
                    El {nombreDelDia(dia)} no hay clases.
                  </p>
                ) : null}

                {delDia.map((clase) => {
                  const inicio = tramoDe(clase.inicio, desde);
                  const alto = tramosQueOcupa(clase.inicio, clase.fin);
                  const ubicacion: Ubicacion = {
                    style: { gridRow: `${inicio + 1} / span ${alto}`, gridColumn: 1 },
                    className: "z-10 mx-1 overflow-hidden rounded border px-2 py-1",
                    tramos: alto,
                  };

                  if (bloque) return <Fragmento key={clase.id}>{bloque(clase, ubicacion)}</Fragmento>;

                  const libres = lugaresLibres(clase);
                  // Una especial se paga aparte y tiene su página: ahí está su
                  // precio y su cupo real, que cuenta también las pendientes de
                  // pago. Por eso acá no dice lugares (PRD-0018).
                  const especial = clase.especial;
                  return (
                    <Link
                      key={clase.id}
                      href={
                        especial
                          ? `/clases-especiales/${especial.slug}`
                          : libres > 0
                            ? `/reservar/${clase.id}`
                            : "/calendario"
                      }
                      aria-disabled={!especial && libres === 0}
                      style={ubicacion.style}
                      className={`${ubicacion.className} transition-colors ${
                        especial || libres > 0
                          ? "border-xo-rosa/40 bg-xo-rosa/15 hover:border-xo-rosa hover:bg-xo-rosa/25"
                          : "pointer-events-none border-xo-blanco/15 bg-xo-negro-alt"
                      }`}
                    >
                      {/* El orden es el de importancia, porque lo que no cabe se
                          corta por abajo: una clase de una hora mide 56 px y la
                          profesora quedaba visible mientras los lugares —el dato
                          que decide si alguien reserva— desaparecían. La hora y
                          los lugares comparten línea y se parten solos donde la
                          columna es angosta. */}
                      <p className="text-xs leading-tight font-semibold text-xo-blanco">
                        {especial ? especial.titulo : clase.cursoNombre}
                      </p>
                      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] leading-tight">
                        <span className="text-xo-blanco/70">
                          {rangoHorario(clase.inicio, clase.fin)}
                        </span>
                        <span
                          className={!especial && libres === 0 ? "text-xo-blanco/50" : "text-xo-rosa-claro"}
                        >
                          {especial
                            ? "Especial"
                            : libres === 0
                              ? "Llena"
                              : `${libres} ${libres === 1 ? "lugar" : "lugares"}`}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-xo-blanco/60">
                        {clase.profesoraNombre}
                      </p>
                      {alto > 2 ? (
                        <p className="mt-0.5 text-[11px] leading-tight text-xo-blanco/50">
                          {clase.sedeNombre}
                        </p>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <p className={`mt-6 text-sm ${T.pie}`}>
        {pie ?? "Cada línea es media hora. Toca una clase para reservarla."}{" "}
        <span className={T.pieSub}>Las horas están en horario de Santiago.</span>
      </p>
    </div>
  );
}

/**
 * El día que se abre en el teléfono: hoy si le quedan clases; si no, el primer
 * día de la semana con clases desde hoy; y en una semana vacía, hoy si está en
 * ella o el lunes.
 */
function diaPorDefecto(
  dias: string[],
  porDia: Map<string, ClaseDelCalendario[]>,
  hoy: string,
): string {
  const conClases = dias.filter((d) => d >= hoy && (porDia.get(d)?.length ?? 0) > 0);
  if (conClases.length > 0) return conClases[0];
  return dias.includes(hoy) ? hoy : dias[0];
}

/** "Lu", "Mi", "Sá": dos letras, porque martes y miércoles empiezan igual. */
function abreviado(dia: string): string {
  const n = nombreDelDia(dia);
  return n.charAt(0).toUpperCase() + n.charAt(1);
}

/** Dónde cae una clase, ya calculado por la grilla. El bloque lo aplica tal cual. */
export type Ubicacion = {
  style: CSSProperties;
  className: string;
  /** Cuántos tramos de media hora mide: dice cuánto texto cabe. */
  tramos: number;
};

export type Tema = "oscuro" | "claro";

/**
 * Los colores del marco de la grilla, por tema. Clases completas y literales
 * —no armadas con interpolación— porque Tailwind solo genera las que ve
 * escritas.
 *
 * En `claro` ningún texto es rosa (1,7:1 sobre blanco, prohibido por
 * `estilo.md`): lo secundario es `xo-gris`, que da 5,0:1. El rosa queda solo
 * como fondo —el día elegido, con texto negro— y como el punto de "este día
 * tiene clases", que no es texto.
 */
const TEMAS: Record<Tema, Record<string, string>> = {
  oscuro: {
    boton:
      "xo-eyebrow rounded-full border border-xo-blanco/25 px-4 py-2 text-xo-blanco/80 transition-colors hover:border-xo-blanco/60 disabled:opacity-30",
    diaActivo: "border-xo-rosa bg-xo-rosa text-xo-negro",
    diaTiene: "border-xo-blanco/25 text-xo-blanco",
    diaVacio: "border-xo-blanco/10 text-xo-blanco/40",
    borde: "border-xo-blanco/15",
    lineaTenue: "border-xo-blanco/[0.06]",
    encabezado: "text-xo-rosa",
    hora: "text-xo-blanco/50",
    rango: "text-xo-blanco/80",
    rangoSub: "text-xo-blanco/50",
    vacio: "text-xo-blanco/50",
    pie: "text-xo-blanco/50",
    pieSub: "text-xo-blanco/70",
  },
  claro: {
    boton:
      "xo-eyebrow rounded-full border border-xo-negro/25 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/60 disabled:opacity-30",
    diaActivo: "border-xo-rosa bg-xo-rosa text-xo-negro",
    diaTiene: "border-xo-negro/25 text-xo-negro",
    diaVacio: "border-xo-negro/10 text-xo-gris",
    borde: "border-xo-negro/15",
    lineaTenue: "border-xo-negro/[0.06]",
    encabezado: "text-xo-negro",
    hora: "text-xo-gris",
    rango: "text-xo-negro",
    rangoSub: "text-xo-gris",
    vacio: "text-xo-gris",
    pie: "text-xo-gris",
    pieSub: "text-xo-negro",
  },
};
