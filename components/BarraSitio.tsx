"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAMINOS, MI_CUENTA } from "@/lib/navegacion";

/**
 * La barra del sitio público.
 *
 * **El logo sobresale de la barra**, más alto que ella y anclado a la
 * izquierda (PRD-0022 §8.5). El efecto necesita tres cosas que conviene dejar
 * dichas, porque cada una se rompe por su cuenta:
 *
 * 1. La barra tiene altura fija y el logo es **más alto**, con
 *    `position: absolute` y `top` centrado sobre ella. Sin absoluto, el logo
 *    estira la barra y deja de sobresalir.
 * 2. `overflow-visible` en la barra, o el navegador recorta lo que sobra.
 * 3. **El contenido de cada página arranca debajo del logo, no de la barra.**
 *    Lo resuelve `<MarcoSitio>`, que reserva ese espacio una sola vez: hacerlo
 *    con un margen en cada página es garantizar que alguna se olvide.
 *
 * No se achica al hacer scroll, por decisión de Felipe: es una animación que
 * `BRAND.md` no pide y la regla del proyecto es poco movimiento y con intención.
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

      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
        {/* El logo, sobresaliendo. `-translate-y-1/2` sobre `top-1/2` lo deja
            centrado en la barra, así que lo que sobra se reparte arriba y
            abajo; el contenedor de contenido reserva lo de abajo. */}
        <Link
          href="/"
          aria-label="XO Dance Studio, ir al inicio"
          className="absolute top-1/2 left-6 z-10 -translate-y-1/2 sm:left-10"
        >
          <Image
            src="/logo-xo.png"
            alt=""
            width={1192}
            height={789}
            priority
            className="h-20 w-auto drop-shadow-[0_4px_16px_rgba(26,26,26,0.85)] sm:h-28"
          />
        </Link>

        {/* Deja el hueco del logo: la navegación no puede empezar debajo de él. */}
        <div aria-hidden="true" className="h-full w-28 shrink-0 sm:w-40" />

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
