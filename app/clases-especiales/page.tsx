import type { Metadata } from "next";
import Link from "next/link";
import { CabeceraPublica } from "@/components/CabeceraPublica";
import { Especiales } from "@/components/Especiales";
import { Footer } from "@/components/Footer";
import { getEspecialesPublicadas } from "@/lib/especiales-consultas";

/**
 * `/clases-especiales` — las coreografías puntuales, fuera de la parrilla.
 *
 * Estática con revalidación, igual que la landing y los perfiles de profesora:
 * se lee con el cliente público, sin cookies. El camino rápido es el webhook
 * contra `/api/revalidar` cuando se publica una; la hora es la red.
 */
export const revalidate = 3600;

const TITULO = "Clases especiales — XO Dance Studio";
const DESCRIPCION =
  "Coreografías puntuales, fuera del horario de siempre: una fecha, una profe y un tema. Se pagan aparte y se reservan por la web.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/clases-especiales" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/clases-especiales",
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRIPCION },
};

export default async function ClasesEspeciales() {
  const especiales = await getEspecialesPublicadas();

  return (
    <>
      <CabeceraPublica accion="Ver los planes" destino="/#planes" />

      <main className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/#planes"
            className="xo-eyebrow text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
          >
            <span aria-hidden="true">← </span>Los planes
          </Link>

          <p className="xo-eyebrow mt-12 text-xo-rosa">Clases especiales</p>
          <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.5rem,9vw,5rem)] leading-[0.9] text-xo-blanco">
            Una coreo, una fecha
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-xo-blanco/75">
            Fuera del horario de siempre: la profe arma una coreografía completa
            para un día puntual. Se paga aparte de los packs y el cupo queda
            tomado cuando nos avisas de la transferencia.
          </p>

          {especiales.length > 0 ? (
            <Especiales especiales={especiales} />
          ) : (
            <div className="mt-14 border border-xo-blanco/15 p-8">
              <p className="text-lg leading-relaxed text-xo-blanco/85">
                Ahora mismo no hay ninguna agendada.
              </p>
              <p className="mt-3 max-w-md leading-relaxed text-xo-blanco/65">
                Las anunciamos en{" "}
                <a
                  href="https://www.instagram.com/XO.dancestudioo/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xo-rosa underline underline-offset-4"
                >
                  @XO.dancestudioo
                </a>{" "}
                apenas quedan cerradas. Mientras tanto, las clases de la parrilla
                van todas las semanas.
              </p>
              <Link
                href="/#planes"
                className="xo-eyebrow mt-8 inline-flex items-center rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
              >
                Ver los planes
              </Link>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
