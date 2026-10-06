import Link from "next/link";
import { INICIO_CLASES, UBICACION } from "@/lib/contacto";

export function Hero() {
  return (
    // Alto de la ventana menos la barra fija, para que el hero entre justo.
    <section
      id="inicio"
      className="xo-grain relative flex min-h-[calc(100svh-4.5rem)] flex-col justify-between overflow-hidden px-6 pt-16 pb-12 sm:px-10 sm:pt-24 sm:pb-16"
    >
      {/*
        Fase 4: acá va el video en loop con overlay negro al 55%, y un frame
        fijo en móvil. Mientras no exista el material, el hero es negro plano.
      */}

      <div className="relative max-w-5xl">
        <p className="xo-eyebrow text-xo-rosa-claro">Academia de baile</p>

        <h1 className="mt-5 font-display text-[clamp(3.5rem,13vw,8.75rem)] leading-[0.85] text-xo-rosa">
          Descúbrete
          <br />
          y crece bailando
        </h1>

        <p className="mt-7 max-w-xl font-serif-xo text-xl italic leading-snug text-xo-rosa-claro sm:text-2xl">
          Un lugar donde bailar también significa sentirte parte.
        </p>

        {/* Los dos caminos que el sitio ofrece ahora: ver cuándo hay clases,
            o comprar. El formulario de captación se retiró con PRD-0022. */}
        <div className="mt-10 flex flex-wrap gap-4">
          <Link
            href="/calendario"
            className="xo-eyebrow inline-flex items-center rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
          >
            Ver el calendario
          </Link>
          <Link
            href="/comprar"
            className="xo-eyebrow inline-flex items-center rounded-full border border-xo-blanco/30 px-6 py-4 text-xo-blanco transition-colors hover:border-xo-rosa hover:text-xo-rosa"
          >
            Comprar clases
          </Link>
        </div>
      </div>

      <p className="xo-eyebrow relative text-xo-blanco/60">
        {INICIO_CLASES}
        <span aria-hidden="true" className="px-2 text-xo-rosa">
          ✦
        </span>
        {UBICACION}
      </p>
    </section>
  );
}
