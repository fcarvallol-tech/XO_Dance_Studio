import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CabeceraPublica } from "@/components/CabeceraPublica";
import { Footer } from "@/components/Footer";
import { ReelFachada } from "@/components/ReelFachada";
import { cuandoLegible, horaLegible } from "@/lib/compras";
import {
  getEspecialPorSlug,
  getEspecialesPublicadas,
} from "@/lib/especiales-consultas";
import { clp } from "@/lib/planes";

type Props = { params: Promise<{ slug: string }> };

/**
 * La página de una clase especial. Es el link que se pega en una historia, así
 * que tiene que contestar sola: qué coreo, cuándo, con quién, dónde, cuánto y
 * cuántos lugares quedan.
 *
 * Igual que los perfiles de profesora: las que existen al build salen
 * prerenderizadas y una publicada después se renderiza en la primera visita, no
 * da 404 hasta el próximo deploy.
 */
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  const especiales = await getEspecialesPublicadas();
  return especiales.map((especial) => ({ slug: especial.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const dato = await getEspecialPorSlug(slug);
  if (!dato) return {};

  const { especial } = dato;
  const titulo = `${especial.titulo} — Clase especial con ${especial.profesora}`;
  const descripcion =
    `${cuandoLegible(especial.inicio)} en ${especial.sede}, ${especial.comuna}. ` +
    `${clp(especial.precioClp)}. Se paga aparte de los packs y se reserva por acá.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/clases-especiales/${especial.slug}` },
    openGraph: {
      type: "article",
      locale: "es_CL",
      siteName: "XO Dance Studio",
      title: titulo,
      description: descripcion,
      url: `/clases-especiales/${especial.slug}`,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function ClaseEspecial({ params }: Props) {
  const { slug } = await params;
  const dato = await getEspecialPorSlug(slug);
  if (!dato) notFound();

  const { especial, lugaresLibres } = dato;
  const llena = lugaresLibres <= 0;

  // Quien llega desde una historia no tiene sesión: el proxy la manda a
  // `/entrar` con `?volver=` puesto y vuelve **a la pantalla de reserva**, no a
  // esta ficha. Con sesión, entra derecho.
  const reservar = `/reservar-especial/${especial.slug}`;

  return (
    <>
      <CabeceraPublica accion="Ver todas" destino="/clases-especiales" />

      <main className="xo-grain relative px-6 py-16 sm:px-10 sm:py-24">
        <div className="relative mx-auto max-w-5xl">
          <Link
            href="/clases-especiales"
            className="xo-eyebrow text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
          >
            <span aria-hidden="true">← </span>Todas las clases especiales
          </Link>

          <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,380px)_1fr] lg:gap-16">
            <div>
              <ReelFachada
                codigo={especial.reelCodigo}
                portadaUrl={especial.portadaUrl}
                titulo={especial.titulo}
              />
            </div>

            <div>
              <p className="xo-eyebrow text-xo-rosa">
                {especial.curso}
                {especial.dificultad ? ` · ${especial.dificultad}` : ""}
              </p>

              <h1 className="mt-4 font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.9] text-xo-blanco">
                {especial.titulo}
              </h1>

              {especial.cancion ? (
                <p className="mt-4 font-serif-xo text-xl italic text-xo-rosa-claro sm:text-2xl">
                  {especial.cancion}
                </p>
              ) : null}

              {especial.descripcion ? (
                <p className="mt-6 max-w-lg text-lg leading-relaxed text-xo-blanco/80">
                  {especial.descripcion}
                </p>
              ) : null}

              <dl className="mt-10 space-y-5 border-t border-xo-blanco/15 pt-8">
                <Dato rotulo="Cuándo">
                  {cuandoLegible(especial.inicio)}
                  {especial.fin ? ` a ${horaLegible(especial.fin)}` : ""}
                </Dato>

                <Dato rotulo="Con quién">
                  {especial.profesoraSlug ? (
                    <Link
                      href={`/profesoras/${especial.profesoraSlug}`}
                      className="underline decoration-xo-rosa underline-offset-4 transition-colors hover:text-xo-rosa"
                    >
                      {especial.profesora}
                    </Link>
                  ) : (
                    especial.profesora
                  )}
                </Dato>

                <Dato rotulo="Dónde">
                  {especial.sede}
                  <br />
                  <span className="text-xo-blanco/70">
                    {especial.direccion}, {especial.comuna}
                  </span>
                </Dato>

                <Dato rotulo="Lugares">
                  {llena
                    ? "Llena"
                    : `Quedan ${lugaresLibres} de ${especial.cupoMaximo}`}
                </Dato>
              </dl>

              <p className="mt-10 font-display text-[clamp(2.5rem,8vw,4rem)] leading-none text-xo-rosa">
                {clp(especial.precioClp)}
              </p>

              {llena ? (
                <p className="mt-6 max-w-md leading-relaxed text-xo-blanco/75">
                  Esta ya se llenó. Escríbenos por{" "}
                  <a
                    href="https://www.instagram.com/XO.dancestudioo/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xo-rosa underline underline-offset-4"
                  >
                    Instagram
                  </a>{" "}
                  y te avisamos si se libera un lugar o si la repetimos.
                </p>
              ) : (
                <>
                  <Link
                    href={reservar}
                    className="xo-eyebrow mt-8 inline-flex items-center rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
                  >
                    Reservar por {clp(especial.precioClp)}
                  </Link>

                  <p className="mt-5 max-w-md text-sm leading-relaxed text-xo-blanco/65">
                    <span aria-hidden="true" className="text-xo-rosa">
                      ✦{" "}
                    </span>
                    Se paga aparte de los packs: esta clase no usa las clases que
                    ya tengas. Es por transferencia, y el cupo te queda tomado
                    mientras confirmamos.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

function Dato({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="xo-eyebrow text-xo-blanco/50">{rotulo}</dt>
      <dd className="mt-1.5 text-lg leading-relaxed text-xo-blanco">{children}</dd>
    </div>
  );
}
