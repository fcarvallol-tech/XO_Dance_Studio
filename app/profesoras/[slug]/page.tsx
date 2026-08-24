import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Footer } from "@/components/Footer";
import { Placeholder } from "@/components/Placeholder";
import { getCurso } from "@/lib/cursos";
import { UBICACION } from "@/lib/contacto";
import { PROFESORAS_ACTIVAS, getProfesoraActiva } from "@/lib/profesoras";

type Props = { params: Promise<{ slug: string }> };

// Las cinco se generan en build. Una profesora inactiva no tiene perfil: el
// slug no existe y la ruta responde 404, no una página vacía.
export const dynamicParams = false;

export function generateStaticParams() {
  return PROFESORAS_ACTIVAS.map((profesora) => ({ slug: profesora.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const profesora = getProfesoraActiva(slug);
  if (!profesora) return {};

  const titulo = `${profesora.nombre} — Profesora de XO Dance Studio`;
  // La bio real todavía no existe: la descripción se arma con lo que sí es
  // dato, no con el texto de relleno.
  const descripcion = `${profesora.nombre} hace clases de ${profesora.estilo} en XO Dance Studio, ${UBICACION}. Reserva tu clase con ella.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/profesoras/${profesora.id}` },
    openGraph: {
      type: "profile",
      locale: "es_CL",
      siteName: "XO Dance Studio",
      title: titulo,
      description: descripcion,
      url: `/profesoras/${profesora.id}`,
    },
    twitter: {
      card: "summary_large_image",
      title: titulo,
      description: descripcion,
    },
  };
}

export default async function PerfilProfesora({ params }: Props) {
  const { slug } = await params;
  const profesora = getProfesoraActiva(slug);
  if (!profesora) notFound();

  const cursos = profesora.cursos
    .map((id) => getCurso(id)?.nombre)
    .filter((nombre): nombre is string => Boolean(nombre));

  // El formulario vive en la landing. El perfil manda para allá con la profe
  // ya elegida: la lee <PreseleccionPorUrl>.
  const reservar = `/?profesora=${profesora.id}#inscripcion`;

  return (
    <>
      <header className="sticky top-0 z-50 h-18 border-b border-xo-blanco/10 bg-xo-negro">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between gap-4 px-6 sm:px-10">
          <Link href="/" aria-label="XO Dance Studio, ir al inicio">
            <Image
              src="/logo-xo.png"
              alt=""
              width={1192}
              height={789}
              priority
              className="h-8 w-auto"
            />
          </Link>

          <Link
            href={reservar}
            className="xo-eyebrow inline-flex items-center justify-center rounded-full bg-xo-rosa px-4 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro sm:px-5"
          >
            Reservar clase
          </Link>
        </div>
      </header>

      <main className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/#profesoras"
            className="xo-eyebrow text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
          >
            <span aria-hidden="true">← </span>Todas las profes
          </Link>

          <p className="xo-eyebrow mt-12 text-xo-rosa-claro">
            {profesora.estilo}
          </p>
          <h1 className="mt-3 font-display text-[clamp(3.5rem,14vw,9rem)] leading-[0.85] text-xo-rosa">
            {profesora.nombre}
          </h1>

          <div className="mt-14 grid gap-10 sm:grid-cols-[minmax(0,22rem)_1fr] sm:gap-14">
            {profesora.video ? (
              <video
                src={profesora.video}
                poster={profesora.foto ?? undefined}
                controls
                playsInline
                className="w-full bg-xo-negro-alt"
              />
            ) : profesora.foto ? (
              <Image
                src={profesora.foto}
                alt={`${profesora.nombre}, profesora de XO Dance Studio`}
                width={640}
                height={853}
                className="w-full"
              />
            ) : (
              <Placeholder
                etiqueta={`Foto de ${profesora.nombre} pendiente`}
                className="aspect-[3/4]"
              />
            )}

            <div>
              <p className="max-w-prose text-lg leading-relaxed text-xo-blanco/85">
                {profesora.bio}
              </p>

              <p className="xo-eyebrow mt-10 text-xo-rosa-claro">
                Hace clases en
              </p>
              <ul className="mt-3 flex flex-wrap gap-2">
                {cursos.map((curso) => (
                  <li
                    key={curso}
                    className="rounded-full border border-xo-rosa/40 px-3.5 py-1.5 text-sm text-xo-blanco/80"
                  >
                    {curso}
                  </li>
                ))}
              </ul>

              <p className="xo-eyebrow mt-10 text-xo-rosa-claro">Dónde</p>
              <p className="mt-3 text-xo-blanco/80">{UBICACION}</p>

              <div className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-4">
                <Link
                  href={reservar}
                  className="xo-eyebrow inline-flex items-center justify-center rounded-full bg-xo-rosa px-6 py-3.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro"
                >
                  Reservar clase con {profesora.nombre}
                </Link>

                <a
                  href={profesora.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="xo-eyebrow text-xo-rosa underline-offset-4 hover:underline"
                >
                  Instagram de {profesora.nombre}
                </a>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
