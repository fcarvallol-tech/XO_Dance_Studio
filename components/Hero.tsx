import { BotonInscripcion } from "./BotonInscripcion";
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
          Acá nadie
          <br />
          baila sola
        </h1>

        <p className="mt-7 max-w-xl font-serif-xo text-xl italic leading-snug text-xo-rosa-claro sm:text-2xl">
          Un lugar donde bailar también significa sentirte parte.
        </p>

        <div className="mt-10">
          <BotonInscripcion origen="hero">Reservar clase</BotonInscripcion>
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
