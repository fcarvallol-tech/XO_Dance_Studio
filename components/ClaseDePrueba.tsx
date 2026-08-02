import Image from "next/image";
import { BotonInscripcion } from "./BotonInscripcion";
import { Reveal } from "./Reveal";

/**
 * Único bloque claro de la página. El corte de fondo es a propósito: marca
 * que acá cambia el tono y baja la fricción antes del formulario.
 */
export function ClaseDePrueba() {
  return (
    <section
      id="clase-de-prueba"
      className="scroll-mt-20 bg-xo-blanco px-6 py-24 sm:px-10 sm:py-32"
    >
      <Reveal className="mx-auto max-w-3xl text-center">
        <Image
          src="/corazon-xo.png"
          alt=""
          width={268}
          height={281}
          className="mx-auto h-12 w-auto"
        />

        <h2 className="mt-8 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-negro">
          La primera clase va por nuestra cuenta
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-xo-gris">
          Vienes, bailas una hora completa y decides después. No pagas nada, no
          firmas nada y no hace falta que sepas bailar. Si no era lo tuyo, no
          pasa nada.
        </p>

        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-xo-gris">
          Nos dejas tus datos, te escribimos por WhatsApp y coordinamos el día.
        </p>

        <div className="mt-10">
          <BotonInscripcion origen="clase-de-prueba">
            Reservar mi clase de prueba
          </BotonInscripcion>
        </div>
      </Reveal>
    </section>
  );
}
