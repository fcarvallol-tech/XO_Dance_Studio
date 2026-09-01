import { BotonInscripcion } from "./BotonInscripcion";
import { Reveal } from "./Reveal";
import {
  clp,
  hastaPromo,
  hayPromo,
  nombrePromo,
  porClase,
  precioVigente,
  type Plan,
} from "@/lib/planes";

/**
 * Los precios, publicados. Hasta agosto de 2026 decían "Por confirmar"
 * mientras Instagram ya los mostraba; esta sección cierra esa contradicción.
 *
 * Lista de filas, no tarjetas: son cuatro variantes del mismo producto y lo
 * que la visitante compara es una columna de precios, no cuatro bloques.
 */
export function Planes({ planes }: { planes: Plan[] }) {
  const conPromo = hayPromo(planes);
  const promo = nombrePromo(planes);
  const hasta = hastaPromo(planes);

  return (
    <section
      id="planes"
      className="xo-grain relative scroll-mt-20 border-t border-xo-blanco/10 px-6 py-24 sm:px-10 sm:py-32"
    >
      <Reveal className="relative mx-auto max-w-4xl">
        <p className="xo-eyebrow text-xo-rosa">Los planes</p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Compras clases, no un mes
        </h2>
        <p className="mt-5 max-w-md text-xo-blanco/70">
          Mientras más clases lleves, menos te sale cada una. Los mismos valores
          para todos los cursos.
        </p>

        {conPromo && hasta ? (
          <div className="mt-12 border border-xo-rosa/40 p-6 sm:p-8">
            <p className="xo-eyebrow text-xo-rosa">{promo ?? "Promoción"}</p>
            <p className="mt-3 text-lg leading-relaxed text-xo-blanco/85">
              Hasta el{" "}
              <strong className="font-semibold text-xo-rosa-claro">{hasta}</strong>
              , los packs de 4 y de 8 clases quedan más baratos. Después vuelven
              a su valor normal.
            </p>
          </div>
        ) : null}

        <ul className="mt-14">
          {planes.map((plan, indice) => (
            <li key={plan.slug}>
              {indice > 0 ? (
                <div
                  aria-hidden="true"
                  className="h-px bg-xo-blanco/15"
                />
              ) : null}
              <Fila plan={plan} />
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-md text-sm leading-relaxed text-xo-blanco/60">
          <span aria-hidden="true" className="text-xo-rosa">
            ✦{" "}
          </span>
          Los horarios y la sede te los contamos por WhatsApp cuando nos dejes
          tus datos.
        </p>

        <div className="mt-10">
          <BotonInscripcion origen="planes">Reservar clase</BotonInscripcion>
        </div>
      </Reveal>
    </section>
  );
}

function Fila({ plan }: { plan: Plan }) {
  const enPromo = plan.promo !== null;

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 py-7">
      <div>
        <p className="font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-none text-xo-blanco">
          {plan.nombre}
        </p>
        <p className="mt-2 text-sm text-xo-blanco/60">
          {clp(porClase(plan))} por clase
        </p>
      </div>

      <p className="text-right">
        {enPromo ? (
          <span className="mr-3 text-base text-xo-blanco/60">
            <span className="sr-only">Precio normal: </span>
            <s>{clp(plan.precio)}</s>
          </span>
        ) : null}

        <span
          className={`font-display text-[clamp(2rem,6vw,3rem)] leading-none ${
            enPromo ? "text-xo-rosa" : "text-xo-blanco"
          }`}
        >
          {enPromo ? (
            <span className="sr-only">Precio de lanzamiento: </span>
          ) : null}
          {clp(precioVigente(plan))}
        </span>
      </p>
    </div>
  );
}
