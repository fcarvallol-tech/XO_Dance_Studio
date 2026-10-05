import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MarcoSitio } from "@/components/MarcoSitio";
import { porClaseDeOferta } from "@/lib/dominio/ofertas";
import { getOfertas, resolverOferta } from "@/lib/ofertas-consultas";
import { clp } from "@/lib/planes";

type Props = { params: Promise<{ oferta: string }> };

/**
 * `/comprar/<oferta>` — la página que se pega en un DM de Instagram.
 *
 * Es el link que antes no existía: se abre **sin cuenta**, dice qué se compra y
 * cuánto, y recién al apretar pide entrar. Mismo patrón que la página de una
 * clase especial, y por la misma razón: quien llega desde una historia no tiene
 * sesión, y un muro de login como primera pantalla pierde la conversación.
 *
 * El segmento se llama `oferta` y no `plan` a propósito (PRD-0020 §8.1): hoy
 * resuelve a un pack, mañana a una promoción, sin tocar esta página.
 *
 * **El precio es el vigente al abrir, no el de cuando se compartió** (§8.5). Un
 * link viejo no compromete a la academia a un precio que ya no existe; lo que se
 * congela es el monto de la compra al declarar la transferencia.
 */
export const dynamicParams = true;
export const revalidate = 3600;

export async function generateStaticParams() {
  return (await getOfertas()).map((oferta) => ({ oferta: oferta.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { oferta: slug } = await params;
  const oferta = await resolverOferta(slug);
  if (!oferta) return {};

  const titulo = `${oferta.titulo} · ${clp(oferta.precioClp)} — XO Dance Studio`;
  const descripcion =
    `${oferta.clases} ${oferta.clases === 1 ? "clase" : "clases"} a ` +
    `${clp(porClaseDeOferta(oferta))} cada una, para cualquier horario del calendario. ` +
    `Tienes ${oferta.vigenciaDias} días para usarlas.`;

  return {
    title: titulo,
    description: descripcion,
    alternates: { canonical: `/comprar/${oferta.slug}` },
    openGraph: {
      type: "website",
      locale: "es_CL",
      siteName: "XO Dance Studio",
      title: titulo,
      description: descripcion,
      url: `/comprar/${oferta.slug}`,
    },
    twitter: { card: "summary_large_image", title: titulo, description: descripcion },
  };
}

export default async function PaginaDeOferta({ params }: Props) {
  const { oferta: slug } = await params;
  const oferta = await resolverOferta(slug);
  if (!oferta) notFound();

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-2xl">
          <Link
            href="/comprar"
            className="xo-eyebrow text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
          >
            <span aria-hidden="true">← </span>Todos los packs
          </Link>

          <p className="xo-eyebrow mt-12 text-xo-rosa">
            {oferta.vigenteHasta ? "Promoción" : "Pack de clases"}
          </p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,10vw,5rem)] leading-[0.9] text-xo-blanco">
            {oferta.titulo}
          </h1>

          <p className="mt-8 flex flex-wrap items-baseline gap-x-4">
            {oferta.precioNormalClp !== null ? (
              <span className="text-xl text-xo-blanco/60">
                <span className="sr-only">Precio normal: </span>
                <s>{clp(oferta.precioNormalClp)}</s>
              </span>
            ) : null}
            <span className="font-display text-[clamp(3rem,12vw,5rem)] leading-none text-xo-rosa">
              {clp(oferta.precioClp)}
            </span>
          </p>

          <p className="mt-3 text-lg text-xo-blanco/75">
            {clp(porClaseDeOferta(oferta))} por clase
          </p>

          {oferta.vigenteHasta ? (
            <p className="mt-6 border border-xo-rosa/40 p-5 leading-relaxed text-xo-blanco/85">
              Este precio vale hasta el{" "}
              <strong className="font-semibold text-xo-rosa-claro">
                {oferta.vigenteHasta}
              </strong>
              . Después vuelve a su valor normal.
            </p>
          ) : null}

          <dl className="mt-12 space-y-5 border-t border-xo-blanco/15 pt-8">
            <Dato rotulo="Qué incluye">
              {oferta.clases} {oferta.clases === 1 ? "clase" : "clases"} para
              cualquier horario del calendario, con cualquier profe y en
              cualquiera de nuestras salas
            </Dato>
            <Dato rotulo="Hasta cuándo las puedes usar">
              {oferta.vigenciaDias} días desde que te las acreditamos
            </Dato>
            <Dato rotulo="Cómo se paga">
              Por transferencia. Te mostramos los datos al entrar y nos avisas
              cuando la hagas
            </Dato>
          </dl>

          <Link
            href={`/transferir/${oferta.slug}`}
            className="xo-eyebrow mt-10 inline-flex items-center rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
          >
            Comprar por {clp(oferta.precioClp)}
          </Link>

          <p className="mt-5 max-w-md text-sm leading-relaxed text-xo-blanco/65">
            <span aria-hidden="true" className="text-xo-rosa">
              ✦{" "}
            </span>
            Si es tu primera vez, al apretar te pedimos el correo y entras con un
            enlace: no hay contraseña que recordar.
          </p>
        </div>
      </section>
    </MarcoSitio>
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
