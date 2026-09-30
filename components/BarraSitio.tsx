"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAMINOS, MI_CUENTA } from "@/lib/navegacion";

/**
 * La barra del sitio público, con el logo **dentro de un bulto de la barra**.
 *
 * El efecto que pidió Felipe (PRD-0022 §8.5) no es un logo que sobresale sobre
 * la barra: es que **la barra acompañe la forma del logo**, bajando con él para
 * que se lean como una sola pieza. Se fue a mirar la referencia con un navegador
 * —el fetch no la muestra, devuelve un header plano— y lo que hace Death Wish es
 * exactamente eso: una protuberancia del mismo negro de la barra, que baja por
 * detrás del logo. Allá va centrada; acá, anclada a la izquierda.
 *
 * Cómo está hecho, porque cada pieza se rompe sola:
 *
 * 1. **El bulto es un SVG que cuelga bajo la barra**, del mismo negro. No es un
 *    `div` con esquinas redondeadas: un rectángulo se lee como una caja pegada
 *    a la barra, y lo que se busca es que la **línea de la barra se curve** y
 *    baje rodeando el logo. Por eso el trazo es una sola curva que sale de la
 *    línea de la barra, baja en cuenco y vuelve a subir, sin paredes verticales.
 * 2. **El logo va encima** (`z-10` contra el bulto), con aire arriba y abajo: el
 *    PNG llega hasta el borde superior de su lienzo, así que sin ese aire se ve
 *    **cortado por arriba**, que es lo que pasaba.
 * 3. **`overflow-visible` en la barra**, o el navegador recorta lo que baja.
 * 4. **El espacio de abajo lo reserva `MarcoSitio`**, no cada página.
 *
 * No se achica al hacer scroll, por decisión de Felipe.
 */
export function BarraSitio() {
  const [abierto, setAbierto] = useState(false);
  const aqui = usePathname();

  return (
    <header className="sticky top-0 z-50 h-18 overflow-visible border-b border-xo-blanco/10 bg-xo-negro">
      <a
        href="#contenido"
        className="xo-eyebrow sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-40 focus:z-10 focus:rounded-full focus:bg-xo-rosa focus:px-5 focus:py-3 focus:text-xo-negro"
      >
        Saltar al contenido
      </a>

      {/* El bulto y el logo cuelgan del `header`, que ocupa el ancho de la
          ventana, y **no del contenedor centrado**: anclados al costado
          izquierdo de la pantalla, pero **separados de su borde**. Pegado al
          borde el logo se leía apretado; con aire se lee como una pieza propia.

          El SVG empieza 1px arriba del final de la barra para tapar su borde
          justo donde nace la curva: así la línea no atraviesa el cuenco, sino
          que baja con él. `preserveAspectRatio="none"` deja usar el mismo dibujo
          en móvil y escritorio, y `non-scaling-stroke` mantiene la línea en 1px
          aunque se estire. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 216 64"
        preserveAspectRatio="none"
        className="pointer-events-none absolute top-[calc(100%-1px)] left-3 z-0 h-[27px] w-36 sm:left-8 sm:h-[65px] sm:w-54 lg:left-10"
      >
        <path
          className="fill-xo-negro"
          d="M0 0H216C206 0 200 3 200 12C200 44 164 64 108 64C52 64 16 44 16 12C16 3 10 0 0 0Z"
        />
        <path
          className="fill-none stroke-xo-blanco/10"
          vectorEffect="non-scaling-stroke"
          d="M0 0.5C10 0.5 16 3 16 12C16 44 52 63.5 108 63.5C164 63.5 200 44 200 12C200 3 206 0.5 216 0.5"
        />
      </svg>

      <Link
        href="/"
        aria-label="XO Dance Studio, ir al inicio"
        className="absolute top-[1.1rem] left-[2.2rem] z-10 sm:top-5 sm:left-[4.2rem] lg:left-[4.7rem]"
      >
        <Image
          src="/logo-xo.png"
          alt=""
          width={1192}
          height={789}
          priority
          className="h-16 w-auto sm:h-24"
        />
      </Link>

      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
        {/* Deja el hueco del bulto: la navegación no empieza debajo de él. */}
        <div aria-hidden="true" className="h-full w-36 shrink-0 sm:w-56" />

        <nav aria-label="Secciones" className="hidden lg:block">
          <ul className="flex items-center gap-6 xl:gap-8">
            {CAMINOS.map((camino) => {
              const activo = aqui === camino.href || aqui.startsWith(`${camino.href}/`);
              return (
                <li key={camino.href}>
                  <Link
                    href={camino.href}
                    aria-current={activo ? "page" : undefined}
                    className={`xo-eyebrow whitespace-nowrap transition-colors hover:text-xo-rosa ${
                      activo ? "text-xo-rosa" : "text-xo-blanco/65"
                    }`}
                  >
                    {camino.texto}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href={MI_CUENTA.href}
            className="xo-eyebrow inline-flex items-center justify-center rounded-full bg-xo-rosa px-4 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro sm:px-5"
          >
            {MI_CUENTA.texto}
          </Link>

          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-controls="menu-movil"
            className="xo-eyebrow rounded-full border border-xo-blanco/25 px-3 py-2.5 text-xo-blanco/80 transition-colors hover:border-xo-blanco/60 lg:hidden"
          >
            {abierto ? "Cerrar" : "Menú"}
          </button>
        </div>
      </div>

      {/* El menú móvil: los mismos seis caminos, de la misma fuente. */}
      {abierto ? (
        <nav
          id="menu-movil"
          aria-label="Secciones"
          className="absolute inset-x-0 top-18 border-b border-xo-blanco/10 bg-xo-negro lg:hidden"
        >
          <ul className="mx-auto max-w-6xl px-6 py-2 sm:px-10">
            {CAMINOS.map((camino) => (
              <li key={camino.href} className="border-t border-xo-blanco/10 first:border-t-0">
                <Link
                  href={camino.href}
                  onClick={() => setAbierto(false)}
                  className="xo-eyebrow block py-4 text-xo-blanco/80 transition-colors hover:text-xo-rosa"
                >
                  {camino.texto}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
