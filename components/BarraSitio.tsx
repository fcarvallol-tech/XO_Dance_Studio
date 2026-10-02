"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CAMINOS, MI_CUENTA } from "@/lib/navegacion";

/**
 * La barra del sitio público, con el logo **dentro de un círculo de la barra**.
 *
 * El efecto que pidió Felipe (PRD-0022 §8.5, §14) es el de deathwishcoffee.com:
 * la barra baja y forma **un círculo negro completo** alrededor del logo, que
 * sobresale por abajo. Allá va centrado; acá, anclado a la izquierda con aire
 * respecto al borde de la ventana.
 *
 * **Es un círculo, no un óvalo.** El logo XO es ancho (1192 × 789), y estirar
 * la forma para que calce ya se probó: se lee como un cuenco, no como la marca
 * de la referencia. Lo que cede es el logo, que se achica hasta caber.
 *
 * Cuánto se achica no sale del rectángulo del PNG sino de **sus píxeles**: el
 * círculo mínimo que contiene la parte opaca mide 1,04 veces el ancho del logo,
 * con centro en el 48,7 % del ancho y el 60 % del alto —las esquinas de arriba a
 * la izquierda y abajo a la derecha están vacías—. Con 7 px de aire queda:
 *
 *   escritorio  círculo 144 px · logo 124 × 82 · desde el círculo 12, 23
 *   teléfono    círculo 104 px · logo  88 × 58 · desde el círculo  9, 17
 *
 * `scripts/verificar-sitio.mjs` usa esas mismas proporciones para medir que el
 * logo quede dentro. Si el logo cambia, se vuelven a medir.
 *
 * Cómo está hecho, porque cada pieza se rompe sola:
 *
 * 1. **El relleno es un círculo entero** del negro de la barra. **El borde
 *    solo se dibuja bajo la línea de la barra**: dentro de ella el círculo es
 *    negro sobre negro, y un contorno ahí lo convertiría en un botón pegado. Se
 *    recorta con una caja `overflow-hidden` que empieza en esa línea.
 * 2. **Tres capas:** el círculo abajo (`z-0`), el menú del teléfono encima
 *    (`z-20`) para que el círculo no le tape el primer camino, y el logo arriba
 *    de todo (`z-30`), porque baja unos píxeles de la barra y el menú abierto
 *    le cortaba el corazón.
 * 3. **`overflow-visible` en la barra**, o el navegador recorta lo que baja.
 * 4. **El espacio de abajo lo reserva `MarcoSitio`**, no cada página.
 * 5. **Los seis caminos van en línea desde `xl`.** Con Mi Cuenta suman unos
 *    925 px, y a 1024 no caben ni con el círculo chico: desbordaban 142 px sin
 *    que el verificador lo viera. Bajo `xl`, el botón Menú.
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

      {/* El círculo y el logo cuelgan del `header`, que ocupa el ancho de la
          ventana, y **no del contenedor centrado**: anclados al costado
          izquierdo de la pantalla, separados de su borde. */}
      <div
        aria-hidden="true"
        data-circulo-logo
        className="pointer-events-none absolute top-0 left-3 z-0 size-26 sm:left-8 sm:size-36 lg:left-10"
      >
        <div className="absolute inset-0 rounded-full bg-xo-negro" />
        {/* 71 px: la línea de la barra, que es su último píxel. */}
        <div className="absolute inset-x-0 top-[71px] bottom-0 overflow-hidden">
          <div className="absolute inset-x-0 -top-[71px] size-26 rounded-full border border-xo-blanco/10 sm:size-36" />
        </div>
      </div>

      <Link
        href="/"
        aria-label="XO Dance Studio, ir al inicio"
        className="absolute top-[17px] left-[21px] z-30 sm:top-[23px] sm:left-[44px] lg:left-[52px]"
      >
        <Image
          src="/logo-xo.png"
          alt=""
          width={1192}
          height={789}
          priority
          className="h-[58px] w-auto sm:h-[82px]"
        />
      </Link>

      <div className="relative mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-4 min-[375px]:px-6 sm:px-10">
        {/* Deja el hueco del círculo, que se mide desde la ventana y no desde el
            contenedor: desde `xl` el contenedor ya empieza a 104 px del borde,
            y al círculo le bastan 184. Bajo 375 px todo se aprieta un poco
            —hueco, márgenes, botones— o Mi Cuenta y Menú no caben al lado del
            círculo; de 375 para arriba queda como estaba. */}
        <div aria-hidden="true" className="h-full w-22 shrink-0 min-[375px]:w-32 sm:w-40 xl:w-24" />

        <nav aria-label="Secciones" className="hidden xl:block">
          <ul className="flex items-center gap-8">
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

        <div className="flex items-center gap-2 min-[375px]:gap-3">
          <Link
            href={MI_CUENTA.href}
            className="xo-eyebrow inline-flex items-center justify-center rounded-full bg-xo-rosa px-3 py-2.5 min-[375px]:px-4 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro sm:px-5"
          >
            {MI_CUENTA.texto}
          </Link>

          <button
            type="button"
            onClick={() => setAbierto((a) => !a)}
            aria-expanded={abierto}
            aria-controls="menu-movil"
            className="xo-eyebrow rounded-full border border-xo-blanco/25 px-3 py-2.5 text-xo-blanco/80 transition-colors hover:border-xo-blanco/60 xl:hidden"
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
          className="absolute inset-x-0 top-18 z-20 border-b border-xo-blanco/10 bg-xo-negro xl:hidden"
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
