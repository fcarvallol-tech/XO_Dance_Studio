import Link from "next/link";
import { Footer } from "./Footer";

/**
 * El marco de las páginas legales.
 *
 * **En claro, a propósito.** Es el mismo criterio de BRAND.md §8 para el ERP:
 * el negro del sitio público es aspiracional y funciona para leer poco; esto
 * son varias pantallas de texto seguido. El footer queda en negro porque es el
 * del sitio y vive fuera del bloque claro.
 *
 * Ojo con el rosa acá: sobre fondo claro da 1.7:1 y no sirve para texto. Solo
 * aparece como línea y como borde de bloque, que es lo que permite
 * `.claude/rules/estilo.md`.
 */
export function PaginaLegal({
  titulo,
  actualizado,
  children,
}: {
  titulo: string;
  actualizado: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="bg-xo-blanco text-xo-negro">
        <header className="border-b border-xo-negro/10">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-6 py-5 sm:px-8">
            {/* Wordmark en vez del logo: el logo es rosa y sobre blanco queda
                lavado. Mismo criterio que el header de los portales. */}
            <Link
              href="/"
              className="font-display text-2xl leading-none text-xo-negro"
            >
              XO Dance Studio
            </Link>

            <Link
              href="/"
              className="xo-eyebrow text-xo-gris underline-offset-4 transition-colors hover:text-xo-negro hover:underline"
            >
              <span aria-hidden="true">← </span>Volver al sitio
            </Link>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-6 py-14 sm:px-8 sm:py-20">
          <h1 className="font-display text-[clamp(2.5rem,9vw,4rem)] leading-[0.95] text-xo-negro">
            {titulo}
          </h1>

          <p className="mt-5 text-sm leading-relaxed text-xo-gris">
            <strong className="font-semibold text-xo-negro">
              XO Dance Studio SpA
            </strong>
            <br />
            Última actualización: {actualizado}
          </p>

          {/* El rosa como línea sí está permitido sobre fondo claro. */}
          <hr className="mt-8 border-t-2 border-xo-rosa" />

          <article className="max-w-[62ch]">{children}</article>
        </main>
      </div>

      <Footer />
    </>
  );
}

/** Una sección numerada. La línea superior separa sin gritar. */
export function Seccion({
  numero,
  titulo,
  children,
}: {
  numero: number;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12 border-t border-xo-negro/10 pt-10 first:border-t-0">
      <h2 className="text-xl font-semibold text-xo-negro">
        <span className="text-xo-gris">{numero}.</span> {titulo}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Subtítulo dentro de una sección. */
export function Sub({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-8 text-base font-semibold text-xo-negro">{children}</h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 leading-[1.7] text-xo-negro/85">{children}</p>
  );
}

export function Lista({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 space-y-2.5 pl-5">
      {children}
    </ul>
  );
}

export function Item({ children }: { children: React.ReactNode }) {
  return (
    <li className="list-disc leading-[1.7] text-xo-negro/85 marker:text-xo-negro/35">
      {children}
    </li>
  );
}

/** Bloque destacado. Borde rosa: permitido sobre claro, a diferencia del texto. */
export function Destacado({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-6 border-l-2 border-xo-rosa bg-xo-rosa/10 px-5 py-4">
      {children}
    </div>
  );
}

export function Fuerte({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-xo-negro">{children}</strong>;
}

export function Correo() {
  return (
    <a
      href="mailto:xo.dancestudioo@gmail.com"
      className="font-medium text-xo-negro underline underline-offset-4 hover:text-xo-gris"
    >
      xo.dancestudioo@gmail.com
    </a>
  );
}
