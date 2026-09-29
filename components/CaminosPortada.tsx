import Link from "next/link";

/**
 * Los tres caminos de compra, en la portada.
 *
 * Es lo primero que ve alguien que ya sabe qué es XO y viene a hacer algo: las
 * tres formas de tomar clases, cada una a su página. Reemplaza al texto que
 * explicaba los packs, porque explicar es lo que hace `/comprar`.
 *
 * **Va sobre fondo rosado**, así que todo el texto es negro. `xo-rosa` sobre
 * claro da 1.7:1 y `BRAND.md` lo prohíbe para texto: acá el rosa es el fondo.
 */
const CAMINOS = [
  {
    href: "/calendario",
    titulo: "Clases sueltas",
    texto: "Mira los horarios de las próximas semanas y reserva la que te acomode.",
    accion: "Ver el calendario",
  },
  {
    href: "/comprar",
    titulo: "Packs de clases",
    texto: "Mientras más clases lleves, menos te sale cada una. Sirven para cualquier estilo.",
    accion: "Ver los packs",
  },
  {
    href: "/clases-especiales",
    titulo: "Clases especiales",
    texto: "Coreografías completas, en una fecha puntual, con precio propio.",
    accion: "Ver las especiales",
  },
];

export function CaminosPortada() {
  return (
    <section className="bg-xo-rosa px-6 py-24 sm:px-10 sm:py-32">
      <div className="mx-auto max-w-6xl">
        <h2 className="max-w-3xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-negro">
          Elige el pack que más te guste
        </h2>

        <ul className="mt-14 grid gap-6 sm:grid-cols-3">
          {CAMINOS.map((camino) => (
            <li key={camino.href}>
              <Link
                href={camino.href}
                className="group flex h-full flex-col justify-between border border-xo-negro/25 bg-xo-blanco p-7 transition-colors hover:border-xo-negro"
              >
                <div>
                  <h3 className="font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-none text-xo-negro">
                    {camino.titulo}
                  </h3>
                  <p className="mt-4 leading-relaxed text-xo-gris">{camino.texto}</p>
                </div>

                <span className="xo-eyebrow mt-8 inline-flex items-center text-xo-negro">
                  {camino.accion}
                  <span aria-hidden="true" className="ml-2 transition-transform group-hover:translate-x-1">
                    →
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
