import type { Metadata } from "next";
import Link from "next/link";
import { MarcoSitio } from "@/components/MarcoSitio";
import { Sedes } from "@/components/Sedes";
import { sedesConHorarios } from "@/lib/catalogo";
import { getCatalogoPublico } from "@/lib/catalogo-consultas";

/**
 * `/nosotros` — qué queremos transmitir y qué nos motiva.
 *
 * **Las sedes van dentro, como un dato, no como el tema** (PRD-0022 §8.2). El
 * tema es la academia; dónde queda es una respuesta práctica que se da al final.
 *
 * El texto salió de `BRAND.md` §1 y §7 y de `CONTEXT.md` §7, y quedó aprobado
 * por Felipe el 29/09/2026 con dos párrafos menos: el del origen de la academia
 * y el del cierre. Lo que queda dice qué diferencia a XO —el ambiente, no el
 * estilo— y nada más.
 */
export const revalidate = 3600;

const TITULO = "Nosotros — XO Dance Studio";
const DESCRIPCION =
  "Qué es XO Dance Studio, qué nos motiva y dónde hacemos clases, en Providencia y Las Condes.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/nosotros" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/nosotros",
  },
};

export default async function Nosotros() {
  const { cursos, sedes, horarios } = await getCatalogoPublico();
  // Los estilos que se nombran son los que se dictan hoy, desde la base: el
  // texto decía K-Pop meses después de que salió del catálogo.
  const estilos = cursos.filter((c) => c.activo).map((c) => c.nombre);

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-3xl">
          <p className="xo-eyebrow text-xo-rosa">Nosotros</p>

          <h1 className="mt-4 font-display text-[clamp(2.5rem,9vw,5rem)] leading-[0.9] text-xo-blanco">
            Acá nadie
            <br />
            baila sola
          </h1>

          <div className="mt-12 space-y-6 text-lg leading-relaxed text-xo-blanco/85">
            <p>
              Lo que nos diferencia no es el estilo. {estilos.join(", ")}: eso
              lo enseña mucha gente y lo enseña bien.{" "}
              <strong className="font-semibold text-xo-blanco">
                Lo que hace distinta a XO es el ambiente.
              </strong>{" "}
              Que alguien llegue sola un martes y a la tercera clase ya tenga con
              quién quedarse conversando. Que las profesoras se sepan tu nombre.
              Que venir a bailar sea también venir a un lugar donde te esperan.
            </p>
          </div>

          <h2 className="mt-16 font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-none text-xo-blanco">
            Lo que nos importa
          </h2>

          <dl className="mt-8 space-y-6">
            <Valor titulo="Comunidad antes que técnica">
              La técnica se aprende. Sentirse parte es lo que hace que alguien
              vuelva la semana siguiente.
            </Valor>
            <Valor titulo="Cercanía real con las profes">
              No somos un estudio donde pasas y nadie te registra. Las profes te
              conocen, y eso cambia cómo se aprende.
            </Valor>
            <Valor titulo="Sin vergüenza de empezar">
              Todos los cursos que dictamos son de nivel principiante a
              propósito. Se puede llegar sin saber nada.
            </Valor>
            <Valor titulo="Las profesoras al centro">
              Cada una tiene su estilo, su público y su manera. La academia está
              para que eso se note, no para uniformarlo.
            </Valor>
          </dl>
        </div>
      </section>

      {/* Las sedes: un dato dentro de la página, no su tema. */}
      <Sedes sedes={sedesConHorarios(sedes, horarios)} />

      <section className="px-6 pb-20 sm:px-10 sm:pb-28">
        <div className="mx-auto max-w-3xl">
          <p className="text-lg leading-relaxed text-xo-blanco/75">
            ¿Te quedaron dudas de cómo funciona?{" "}
            <Link
              href="/ayuda"
              className="text-xo-rosa underline underline-offset-4"
            >
              Están respondidas en Ayuda
            </Link>
            .
          </p>
        </div>
      </section>
    </MarcoSitio>
  );
}

function Valor({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-xo-rosa pl-5">
      <dt className="font-display text-2xl leading-none text-xo-rosa-claro">{titulo}</dt>
      <dd className="mt-2 leading-relaxed text-xo-blanco/80">{children}</dd>
    </div>
  );
}
