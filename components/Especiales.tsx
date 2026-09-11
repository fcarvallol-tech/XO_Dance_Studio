import Link from "next/link";
import { clp } from "@/lib/planes";
import { cuandoLegible } from "@/lib/compras";
import type { EspecialPublica } from "@/lib/especiales-consultas";

/**
 * La lista de clases especiales.
 *
 * Cada una lleva a su página propia, que es donde vive el Reel: acá se elige,
 * allá se mira. Así esta página tampoco tiene por qué tocar Instagram.
 *
 * La portada es lo que la trajo desde una historia, así que manda: va grande y
 * primero. Lo que sigue es lo que decide —cuándo, con quién, dónde, cuánto—,
 * en ese orden.
 */
export function Especiales({ especiales }: { especiales: EspecialPublica[] }) {
  return (
    <ul className="mt-14 grid gap-12 sm:grid-cols-2 sm:gap-x-10 sm:gap-y-16">
      {especiales.map((especial) => (
        <li key={especial.slug}>
          <Link
            href={`/clases-especiales/${especial.slug}`}
            className="group block focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-xo-rosa"
          >
            {especial.portadaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={especial.portadaUrl}
                alt={`Portada de ${especial.titulo}`}
                className="block aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-85"
                loading="lazy"
              />
            ) : (
              <span className="flex aspect-[4/5] w-full items-center justify-center border border-dashed border-xo-blanco/25 bg-xo-negro-alt">
                <span className="xo-eyebrow text-xo-blanco/50">Falta la portada</span>
              </span>
            )}

            <p className="xo-eyebrow mt-6 text-xo-rosa-claro">
              {especial.curso}
              {especial.dificultad ? ` · ${especial.dificultad}` : ""}
            </p>

            <h3 className="mt-3 font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-none text-xo-blanco transition-colors group-hover:text-xo-rosa">
              {especial.titulo}
            </h3>

            <p className="mt-3 text-sm text-xo-blanco/70">
              {cuandoLegible(especial.inicio)}
            </p>
            <p className="mt-1 text-sm text-xo-blanco/70">
              Con {especial.profesora} · {especial.sede}, {especial.comuna}
            </p>

            <p className="mt-4 font-display text-[clamp(1.5rem,4vw,2rem)] leading-none text-xo-rosa">
              {clp(especial.precioClp)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
