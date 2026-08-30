import { Reveal } from "./Reveal";
import type { Sede } from "@/lib/catalogo";

/**
 * Dónde se baila.
 *
 * Sección nueva de PRD-0016: hasta agosto la dirección exacta no se publicaba y
 * se entregaba por WhatsApp. Ahora se publica, y esta es la respuesta a una de
 * las dos preguntas que la visitante decide antes de inscribirse.
 */
export function Sedes({ sedes }: { sedes: Sede[] }) {
  if (sedes.length === 0) return null;

  return (
    <section
      id="sedes"
      className="xo-grain relative scroll-mt-20 border-t border-xo-blanco/10 px-6 py-24 sm:px-10 sm:py-32"
    >
      <Reveal className="relative mx-auto max-w-5xl">
        <p className="xo-eyebrow text-xo-rosa">Dónde bailamos</p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Dos salas, dos comunas
        </h2>
        <p className="mt-5 max-w-md text-xo-blanco/70">
          Elige la que te quede mejor: cada horario dice en cuál es.
        </p>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-lg bg-xo-blanco/15 sm:grid-cols-2">
          {sedes.map((sede) => (
            <li key={sede.slug} className="bg-xo-negro-alt p-7 sm:p-9">
              <p className="xo-eyebrow text-xo-rosa-claro">{sede.comuna}</p>

              <h3 className="mt-3 font-display text-[clamp(1.5rem,3.5vw,2rem)] leading-tight text-xo-rosa">
                {sede.nombre}
              </h3>

              <address className="mt-5 text-lg leading-relaxed text-xo-blanco/85 not-italic">
                {sede.direccion}
                <br />
                {sede.comuna}, Santiago
              </address>

              {sede.referencia ? (
                <p className="mt-3 text-sm text-xo-blanco/60">
                  <span aria-hidden="true" className="text-xo-rosa">
                    ✦{" "}
                  </span>
                  {sede.referencia}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </Reveal>
    </section>
  );
}
