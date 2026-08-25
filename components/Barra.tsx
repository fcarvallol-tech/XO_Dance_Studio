import Image from "next/image";
import { BotonInscripcion } from "./BotonInscripcion";

const SECCIONES = [
  { href: "#que-es-xo", texto: "Qué es XO" },
  { href: "#profesoras", texto: "Las profes" },
  { href: "#cursos", texto: "Cursos" },
  { href: "#planes", texto: "Planes" },
];

/**
 * Barra fija: logo, secciones y el CTA siempre a la vista.
 * En móvil los enlaces se ocultan —no caben a 375px y la página es un solo
 * scroll—, pero el botón se queda, que es lo único que tiene que estar.
 */
export function Barra() {
  return (
    <header className="sticky top-0 z-50 h-18 border-b border-xo-blanco/10 bg-xo-negro">
      <a
        href="#contenido"
        className="xo-eyebrow sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-6 focus:z-10 focus:rounded-full focus:bg-xo-rosa focus:px-5 focus:py-3 focus:text-xo-negro"
      >
        Saltar al contenido
      </a>

      <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
        <a href="#inicio" aria-label="XO Dance Studio, ir al inicio">
          <Image
            src="/logo-xo.png"
            alt=""
            width={1192}
            height={789}
            priority
            className="h-8 w-auto"
          />
        </a>

        <nav aria-label="Secciones" className="hidden md:block">
          <ul className="flex items-center gap-8">
            {SECCIONES.map((seccion) => (
              <li key={seccion.href}>
                <a
                  href={seccion.href}
                  className="xo-eyebrow text-xo-blanco/65 transition-colors hover:text-xo-rosa"
                >
                  {seccion.texto}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <BotonInscripcion origen="barra" tamano="compacto">
          Reservar clase
        </BotonInscripcion>
      </div>
    </header>
  );
}
