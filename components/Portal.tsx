import Link from "next/link";
import { NOMBRE_ROL, tieneNivel, type Rol } from "@/lib/roles";
import type { Perfil } from "@/lib/sesion";

/**
 * El marco de los portales internos.
 *
 * **En claro, a propósito.** BRAND.md §8: el sitio público es negro porque es
 * aspiracional; una herramienta que se usa tres horas al día en negro cansa.
 * Ojo con el rosa acá: sobre fondo claro da 1.7:1 y no sirve para texto, solo
 * como fondo de botón con texto negro o como borde.
 *
 * El menú se arma con `tieneNivel`, así que `owner` ve lo de `admin` sin que
 * exista una lista de "lo que ve owner" que mantener aparte.
 */
export function Portal({
  perfil,
  children,
}: {
  perfil: Perfil;
  children: React.ReactNode;
}) {
  const grupos = gruposPara(perfil.rol);

  return (
    <div className="min-h-dvh bg-xo-blanco text-xo-negro">
      <header className="border-b border-xo-negro/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4 sm:px-8">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="font-display text-2xl leading-none text-xo-negro"
            >
              XO
            </Link>

            <nav aria-label="Portal" className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {grupos.map((grupo, indice) => (
                <div key={grupo.de ?? indice} className="flex items-center gap-x-5">
                  {indice > 0 ? (
                    <span aria-hidden="true" className="text-xo-negro/20">
                      /
                    </span>
                  ) : null}

                  <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    {/* El rótulo del grupo va como texto, no como enlace: dice
                        desde qué rol se entra a lo que sigue. */}
                    {grupo.de ? (
                      <li
                        aria-hidden="true"
                        className="xo-eyebrow text-xo-negro/35"
                      >
                        {grupo.de}
                      </li>
                    ) : null}

                    {grupo.enlaces.map((enlace) => (
                      <li key={enlace.href}>
                        <Link
                          href={enlace.href}
                          className="xo-eyebrow text-xo-gris underline-offset-4 transition-colors hover:text-xo-negro hover:underline"
                        >
                          {enlace.texto}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="xo-eyebrow text-xo-gris">
              {NOMBRE_ROL[perfil.rol]}
            </span>
            {/* POST: un GET lo dispararía un prefetch y cerraría la sesión sola. */}
            <form action="/auth/salir" method="post">
              <button
                type="submit"
                className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/50"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}

type Grupo = { de: string | null; enlaces: { href: string; texto: string }[] };

/**
 * La navegación, **agrupada por en calidad de qué se entra**.
 *
 * Con más de un rol la barra mezclaba contextos y había dos pestañas llamadas
 * "Mis clases": la de la alumna y la de la profesora. Los roles son
 * acumulativos —una profesora también toma clases, y `owner` es `admin` más
 * cosas— así que la barra de alguien con tres roles llega a nueve enlaces.
 *
 * Dos arreglos: los nombres dicen **en calidad de qué** es cada cosa, y los
 * grupos van separados para que se lean como bloques y no como una lista larga.
 */
function gruposPara(rol: Rol): Grupo[] {
  const grupos: Grupo[] = [
    {
      // Lo que hace cualquiera con cuenta. Sin etiqueta: es lo de base.
      de: null,
      enlaces: [
        { href: "/mis-clases", texto: "Mis clases" },
        { href: "/reservar", texto: "Reservar" },
        { href: "/mi-perfil", texto: "Mi perfil" },
      ],
    },
  ];

  if (tieneNivel(rol, "profesora")) {
    grupos.push({
      de: "Como profe",
      enlaces: [
        // "Clases que dicto" y no "Mis clases": ella también tiene las suyas
        // como alumna, y las dos aparecen en la misma barra.
        { href: "/profesora/mis-clases", texto: "Clases que dicto" },
        { href: "/profesora/solicitudes", texto: "Pedir horario" },
      ],
    });
  }

  if (tieneNivel(rol, "admin")) {
    grupos.push({
      de: "Administración",
      enlaces: [
        { href: "/admin/compras", texto: "Transferencias" },
        { href: "/admin/solicitudes", texto: "Horarios pedidos" },
        { href: "/admin", texto: "Personas" },
        { href: "/admin/leads", texto: "Leads" },
      ],
    });
  }

  if (tieneNivel(rol, "owner")) {
    grupos.push({ de: null, enlaces: [{ href: "/owner/metricas", texto: "Métricas" }] });
  }

  return grupos;
}

/** Encabezado de página dentro del portal. */
export function TituloPortal({
  eyebrow,
  titulo,
  bajada,
}: {
  eyebrow: string;
  titulo: string;
  bajada?: string;
}) {
  return (
    <div className="mb-10">
      <p className="xo-eyebrow text-xo-gris">{eyebrow}</p>
      <h1 className="mt-3 font-display text-[clamp(2rem,5vw,3rem)] leading-none text-xo-negro">
        {titulo}
      </h1>
      {bajada ? (
        <p className="mt-4 max-w-prose leading-relaxed text-xo-gris">{bajada}</p>
      ) : null}
    </div>
  );
}
