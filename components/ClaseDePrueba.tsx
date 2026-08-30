import Image from "next/image";
import { BotonInscripcion } from "./BotonInscripcion";
import { Reveal } from "./Reveal";

/**
 * Único bloque claro de la página. El corte de fondo es a propósito: marca
 * que acá cambia el tono y baja la fricción antes del formulario.
 *
 * PRD-0003 le sacó la promesa de clase gratis. El id de la sección y el
 * `origen` del lead siguen diciendo "clase-de-prueba" a propósito: son la
 * llave con que se miden los leads históricos, y renombrarlos partiría la
 * serie justo cuando hay que comparar la conversión antes y después.
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
          Primero vienes, después decides
        </h2>

        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-xo-gris">
          Reservas una clase, bailas una hora completa y recién ahí ves si es lo
          tuyo. No hace falta que sepas bailar ni que vengas con alguien.
        </p>

        <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-xo-gris">
          Los horarios, las salas y los valores están todos acá. Nos dejas tus
          datos y te escribimos para decirte cómo inscribirte.
        </p>

        <div className="mt-10">
          <BotonInscripcion origen="clase-de-prueba">
            Reservar clase
          </BotonInscripcion>
        </div>
      </Reveal>
    </section>
  );
}
