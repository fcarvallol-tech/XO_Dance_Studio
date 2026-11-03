import Image from "next/image";
import Link from "next/link";
import { UBICACION } from "@/lib/contacto";

export function Hero() {
  return (
    // Alto de la ventana menos la barra fija, para que el hero entre justo.
    <section
      id="inicio"
      className="xo-grain relative flex min-h-[calc(100svh-4.5rem)] flex-col justify-between overflow-hidden px-6 pt-16 pb-12 sm:px-10 sm:pt-24 sm:pb-16"
    >
      {/*
        El fondo, de atrás hacia adelante (03/11/2026):

        1. El primer cuadro del video, como imagen. Es lo que se ve mientras el
           video carga —en datos móviles, unos segundos— y lo único que se ve con
           `prefers-reduced-motion`, que pide no reproducir video decorativo.
           Es el mismo cuadro con que arranca, así que no hay salto.
        2. El video: H.264 a 720p y 2 Mbps, sin pista de audio, con el índice al
           principio del archivo para que empiece antes de bajarse entero.
           `muted` y `playsInline` no son opcionales: sin ellos iOS no lo
           reproduce solo.
        3. Un velo negro parejo. Sin él el rosa deja de leerse sobre las
           partes claras del video —CLAUDE.md prohíbe rosa sobre fondo claro—.
           Parejo y no degradado (estilo.md: sin degradados). **80 %, medido**:
           con 70 % el eslogan bajaba a 3,3:1 sobre el píxel más claro del video;
           con 80 % todo el texto del hero queda sobre 4,5:1 en todo el video
           (changelog del 03/11/2026). Si se cambia el video, se vuelve a medir.
      */}
      <div aria-hidden="true" className="absolute inset-0">
        <Image src="/hero-poster.jpg" alt="" fill priority sizes="100vw" className="object-cover" />
        <video
          className="absolute inset-0 h-full w-full object-cover motion-reduce:hidden"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
        >
          {/* Con `media` en el source y no solo `motion-reduce:hidden`: un video
              oculto se descarga igual, y son 3,6 MB de datos móviles para algo
              que no se va a ver. */}
          <source src="/hero.mp4" type="video/mp4" media="(prefers-reduced-motion: no-preference)" />
        </video>
        <div className="absolute inset-0 bg-xo-negro/80" />
      </div>

      <div className="relative max-w-5xl">
        <p className="xo-eyebrow text-xo-rosa-claro">Academia de baile</p>

        <h1 className="mt-5 font-display text-[clamp(3.5rem,13vw,8.75rem)] leading-[0.85] text-xo-rosa">
          Tu lugar
          <br />
          para brillar
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

      {/* Sin fecha de inicio: "Las clases parten en septiembre" era del
          lanzamiento, y leída en octubre hacía ver el sitio abandonado. */}
      <p className="xo-eyebrow relative text-xo-blanco/75">{UBICACION}</p>
    </section>
  );
}
