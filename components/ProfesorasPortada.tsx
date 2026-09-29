import Image from "next/image";
import Link from "next/link";
import { Placeholder } from "./Placeholder";
import type { Profesora } from "@/lib/catalogo";

/**
 * Las profesoras en la portada: foto, nombre y a su perfil.
 *
 * Es la versión corta del lineup de `/nuestras-profes`. Acá no hay filtros ni
 * bios: es una fila de caras para que alguien reconozca a la profe que vio en
 * Instagram y llegue a ella en un clic, que es de donde viene casi todo el
 * tráfico.
 *
 * **Sobre fondo negro**, después del bloque rosado: la alternancia marca que
 * cambia el tema.
 */
export function ProfesorasPortada({ profesoras }: { profesoras: Profesora[] }) {
  return (
    <section className="xo-grain relative bg-xo-negro px-6 py-24 sm:px-10 sm:py-32">
      <div className="relative mx-auto max-w-6xl">
        <p className="xo-eyebrow text-xo-rosa">Las profes</p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Quiénes te van a enseñar
        </h2>

        <ul className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5">
          {profesoras.map((profesora) => (
            <li key={profesora.slug}>
              <Link href={`/profesoras/${profesora.slug}`} className="group block">
                {profesora.foto ? (
                  <Image
                    src={profesora.foto}
                    alt={`Foto de ${profesora.nombre}`}
                    width={400}
                    height={500}
                    className="aspect-[4/5] w-full object-cover transition-opacity group-hover:opacity-85"
                  />
                ) : (
                  <Placeholder
                    etiqueta={`Foto de ${profesora.nombre}`}
                    className="aspect-[4/5] w-full"
                  />
                )}

                <p className="mt-4 font-display text-[clamp(1.5rem,4vw,2rem)] leading-none text-xo-blanco transition-colors group-hover:text-xo-rosa">
                  {profesora.nombre}
                </p>
                <p className="mt-1 text-sm text-xo-blanco/60">{profesora.estilo}</p>
              </Link>
            </li>
          ))}
        </ul>

        <Link
          href="/nuestras-profes"
          className="xo-eyebrow mt-12 inline-flex items-center text-xo-rosa underline-offset-4 hover:underline"
        >
          Conocerlas a todas
          <span aria-hidden="true" className="ml-2">→</span>
        </Link>
      </div>
    </section>
  );
}
