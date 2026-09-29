import type { Metadata } from "next";
import { BuscadorProfesoras } from "@/components/BuscadorProfesoras";
import { MarcoSitio } from "@/components/MarcoSitio";
import { getCatalogoPublico } from "@/lib/catalogo-consultas";

/**
 * `/nuestras-profes` — el lineup, que hasta PRD-0022 vivía en la portada.
 *
 * Es la página que sostiene la visión de plataforma de talentos de
 * `CONTEXT.md` §7: las profesoras al centro, cada una con su perfil propio.
 */
export const revalidate = 3600;

const TITULO = "Nuestras profes — XO Dance Studio";
const DESCRIPCION =
  "Las cinco profesoras de XO Dance Studio: quiénes son, qué estilo dicta cada una y cuándo hacen clases.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/nuestras-profes" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/nuestras-profes",
  },
};

export default async function NuestrasProfes() {
  const { cursos, profesoras, horarios } = await getCatalogoPublico();

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-6xl">
          <p className="xo-eyebrow text-xo-rosa">Las profes</p>
          <h1 className="mt-4 max-w-3xl font-display text-[clamp(2.25rem,7vw,4rem)] leading-[0.95] text-xo-blanco">
            Elige a cualquiera de nuestras excelentes profesoras
          </h1>

          <BuscadorProfesoras
            profesoras={profesoras}
            cursos={cursos}
            horarios={horarios}
          />
        </div>
      </section>
    </MarcoSitio>
  );
}
