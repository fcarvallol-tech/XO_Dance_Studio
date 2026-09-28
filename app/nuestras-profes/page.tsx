import type { Metadata } from "next";
import { Lineup } from "@/components/Lineup";
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
      <Lineup cursos={cursos} profesoras={profesoras} horarios={horarios} />
    </MarcoSitio>
  );
}
