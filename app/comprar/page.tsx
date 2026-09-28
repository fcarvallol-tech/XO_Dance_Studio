import type { Metadata } from "next";
import Link from "next/link";
import { MarcoSitio } from "@/components/MarcoSitio";
import { porClaseDeOferta } from "@/lib/dominio/ofertas";
import { getOfertas } from "@/lib/ofertas-consultas";
import { clp } from "@/lib/planes";

/**
 * `/comprar` — la vitrina de los packs, **pública**.
 *
 * Hasta PRD-0020 esta página vivía dentro de `(cuenta)` y exigía sesión para
 * mostrar precios que la landing ya publica: entrar para comparar packs era
 * fricción sin nada que proteger. Ahora se ve sin cuenta y la sesión se pide
 * recién al transferir, que es donde empieza a haber algo de alguien.
 *
 * Estática con revalidación, como el resto del catálogo: no toca cookies.
 */
export const revalidate = 3600;

const TITULO = "Comprar clases — XO Dance Studio";
const DESCRIPCION =
  "Packs de clases para cualquier horario de la parrilla, con cualquier profe y en las dos salas. Mientras más clases, menos sale cada una.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/comprar" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/comprar",
  },
};

export default async function Comprar() {
  const ofertas = await getOfertas();

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-4xl">
          <Link
            href="/#planes"
            className="xo-eyebrow text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
          >
            <span aria-hidden="true">← </span>Volver a la página
          </Link>

          <p className="xo-eyebrow mt-12 text-xo-rosa">Comprar clases</p>
          <h1 className="mt-4 max-w-2xl font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.9] text-xo-blanco">
            Compras clases, no un mes
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-xo-blanco/75">
            Sirven para cualquier clase de la parrilla, con cualquier profe y en
            cualquiera de las dos salas. Se pagan por transferencia y te las
            acreditamos en cuanto veamos el abono.
          </p>

          <ul className="mt-14">
            {ofertas.map((oferta, indice) => (
              <li key={oferta.slug}>
                {indice > 0 ? (
                  <div aria-hidden="true" className="h-px bg-xo-blanco/15" />
                ) : null}

                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-4 py-7">
                  <div>
                    <p className="font-display text-[clamp(1.75rem,5vw,2.5rem)] leading-none text-xo-blanco">
                      {oferta.titulo}
                    </p>
                    <p className="mt-2 text-sm text-xo-blanco/60">
                      {clp(porClaseDeOferta(oferta))} por clase ·{" "}
                      {oferta.vigenciaDias} días para usarlas
                    </p>
                  </div>

                  <div className="flex flex-wrap items-baseline gap-x-5 gap-y-3">
                    <p className="text-right">
                      {oferta.precioNormalClp !== null ? (
                        <span className="mr-3 text-base text-xo-blanco/60">
                          <span className="sr-only">Precio normal: </span>
                          <s>{clp(oferta.precioNormalClp)}</s>
                        </span>
                      ) : null}
                      <span
                        className={`font-display text-[clamp(2rem,6vw,3rem)] leading-none ${
                          oferta.precioNormalClp !== null
                            ? "text-xo-rosa"
                            : "text-xo-blanco"
                        }`}
                      >
                        {clp(oferta.precioClp)}
                      </span>
                    </p>

                    <Link
                      href={`/comprar/${oferta.slug}`}
                      className="xo-eyebrow inline-flex items-center rounded-full bg-xo-rosa px-5 py-3 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro"
                    >
                      Comprar por {clp(oferta.precioClp)}
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-10 max-w-md text-sm leading-relaxed text-xo-blanco/60">
            <span aria-hidden="true" className="text-xo-rosa">
              ✦{" "}
            </span>
            Las clases especiales se pagan aparte y tienen su propio precio.{" "}
            <Link href="/clases-especiales" className="underline underline-offset-4">
              Verlas
            </Link>
            .
          </p>
        </div>
      </section>
    </MarcoSitio>
  );
}
