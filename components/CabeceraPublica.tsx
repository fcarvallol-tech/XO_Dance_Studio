import Image from "next/image";
import Link from "next/link";

/**
 * El encabezado de las páginas públicas que no son la landing. Mismo patrón que
 * el perfil de profesora: el logo vuelve al inicio y a la derecha hay una sola
 * acción, la que corresponda a esa página.
 */
export function CabeceraPublica({
  accion,
  destino,
}: {
  accion: string;
  destino: string;
}) {
  return (
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
          href={destino}
          className="xo-eyebrow inline-flex items-center justify-center rounded-full bg-xo-rosa px-4 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-rosa-claro sm:px-5"
        >
          {accion}
        </Link>
      </div>
    </header>
  );
}
