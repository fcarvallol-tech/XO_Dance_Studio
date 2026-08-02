import Image from "next/image";
import { BotonInscripcion } from "./BotonInscripcion";
import { INICIO_CLASES, UBICACION } from "@/lib/contacto";

export function Hero() {
  return (
    <header className="xo-grain relative flex min-h-[100svh] flex-col justify-between overflow-hidden px-6 pt-10 pb-12 sm:px-10 sm:pb-16">
      {/*
        Fase 4: acá va el video en loop con overlay negro al 55%, y un frame
        fijo en móvil. Mientras no exista el material, el hero es negro plano.
      */}

      <Image
        src="/logo-xo.png"
        alt="XO Dance Studio"
        width={1192}
        height={789}
        priority
        className="relative h-14 w-auto sm:h-16"
      />

      <div className="relative max-w-5xl">
        <p className="xo-eyebrow text-xo-rosa-claro">
          Academia de baile urbano femenino
        </p>

        <h1 className="mt-5 font-display text-[clamp(3.5rem,13vw,8.75rem)] leading-[0.85] text-xo-rosa">
          Acá nadie
          <br />
          baila sola
        </h1>

        <p className="mt-7 max-w-xl font-serif-xo text-xl italic leading-snug text-xo-rosa-claro sm:text-2xl">
          Un lugar donde bailar también significa sentirte parte.
        </p>

        <div className="mt-10">
          <BotonInscripcion origen="hero">
            Quiero mi clase de prueba gratis
          </BotonInscripcion>
        </div>
      </div>

      <p className="xo-eyebrow relative text-xo-blanco/60">
        {INICIO_CLASES}
        <span aria-hidden="true" className="px-2 text-xo-rosa">
          ✦
        </span>
        {UBICACION}
      </p>
    </header>
  );
}
