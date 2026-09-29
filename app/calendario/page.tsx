import type { Metadata } from "next";
import Link from "next/link";
import { MarcoSitio } from "@/components/MarcoSitio";
import { GrillaCalendario } from "@/components/GrillaCalendario";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { getCalendarioPublico } from "@/lib/compras-consultas";

/**
 * `/calendario` — los horarios, **sin sesión** (PRD-0022 §8.3).
 *
 * Hasta ahora ver cuándo había clases exigía tener cuenta, que es pedirle a
 * alguien que se registre para saber si le acomoda el horario. Ahora se ve, y
 * la sesión se pide al reservar, que es cuando de verdad hace falta.
 *
 * **Revalida cada 10 minutos y no cada hora** como el resto del catálogo: acá
 * lo que cambia son los cupos, y un cupo desactualizado hace que alguien
 * intente reservar en una clase llena. La base lo rechaza —el cupo se valida
 * ahí—, pero la persona ya se hizo la ilusión.
 */
export const revalidate = 600;

const TITULO = "Calendario — XO Dance Studio";
const DESCRIPCION =
  "Todas las clases de las próximas semanas: horario, profesora, sala y cuántos lugares quedan.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/calendario" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/calendario",
  },
};

export default async function CalendarioPagina() {
  const clases = await getCalendarioPublico(60);

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-5xl">
          <p className="xo-eyebrow text-xo-rosa">Calendario</p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.9] text-xo-blanco">
            Cuándo hay clases
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-xo-blanco/75">
            Las próximas semanas, con quién las dicta y dónde. Para reservar
            necesitas tener clases compradas.
          </p>

          <ErrorDeLectura que="el calendario" error={clases.error} />

          {clases.error ? null : clases.datos.length === 0 ? (
            <div className="mt-12 border border-xo-blanco/15 p-8">
              <p className="text-lg leading-relaxed text-xo-blanco/85">
                Todavía no hay clases publicadas para las próximas semanas.
              </p>
              <Link
                href="/comprar"
                className="xo-eyebrow mt-8 inline-flex items-center rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
              >
                Ver los packs
              </Link>
            </div>
          ) : (
            <GrillaCalendario clases={clases.datos} />
          )}
        </div>
      </section>
    </MarcoSitio>
  );
}
