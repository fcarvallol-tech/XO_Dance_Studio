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
  const enlaces = enlacesPara(perfil.rol);

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

            <nav aria-label="Portal">
              <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {enlaces.map((enlace) => (
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

function enlacesPara(rol: Rol) {
  const enlaces = [{ href: "/mi-perfil", texto: "Mi perfil" }];

  if (tieneNivel(rol, "profesora")) {
    enlaces.push({ href: "/profesora/mis-clases", texto: "Mis clases" });
  }
  if (tieneNivel(rol, "admin")) {
    enlaces.push({ href: "/admin", texto: "Administración" });
    enlaces.push({ href: "/admin/leads", texto: "Leads" });
  }
  if (tieneNivel(rol, "owner")) {
    enlaces.push({ href: "/owner/metricas", texto: "Métricas" });
  }

  return enlaces;
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
