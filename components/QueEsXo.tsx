import { Reveal } from "./Reveal";

export function QueEsXo() {
  return (
    <section
      id="que-es-xo"
      className="xo-grain relative border-t border-xo-blanco/10 px-6 py-24 sm:px-10 sm:py-36"
    >
      <Reveal className="relative mx-auto max-w-2xl text-center">
        <p aria-hidden="true" className="text-xo-rosa">
          ✦
        </p>

        <h2 className="mt-8 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Bailar se aprende.
          <br />
          Sentirse cómoda, también.
        </h2>

        <div className="mt-8 space-y-5 text-lg leading-relaxed text-xo-blanco/80">
          <p>
            XO nació de algo simple: querer un lugar donde llegar sin saber nada
            no diera vergüenza.
          </p>
          <p>
            Somos cinco profes y cinco formas de bailar, en grupos chicos donde
            nos aprendemos tu nombre la primera clase.
          </p>
          <p>
            Acá se viene a bailar, pero también a hacer amigas. Eso no es un
            extra, es el punto.
          </p>
        </div>
      </Reveal>
    </section>
  );
}
