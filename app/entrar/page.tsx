import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioEntrar } from "@/components/FormularioEntrar";
import { inicioPara, perfilActual } from "@/lib/sesion";
import { empiezaEn, volverInterno } from "@/lib/rutas";

export const metadata: Metadata = {
  title: "Entrar — XO Dance Studio",
  description: "Entra a tu cuenta de XO Dance Studio.",
  robots: { index: false, follow: false },
};

// Lee la sesión para no mostrarle la puerta a quien ya entró.
export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ volver?: string; error?: string }> };

const ERRORES: Record<string, string> = {
  enlace: "Ese enlace ya no sirve: vencen y se usan una sola vez. Pide otro.",
  // Un enlace de PKCE abierto en otro navegador. No es culpa suya ni del
  // enlace, así que se le dice qué hacer en vez de mandarla a reintentar.
  "otro-navegador":
    "Ese enlace hay que abrirlo en el mismo teléfono o computador donde lo pediste. Pide uno nuevo desde el aparato que vayas a usar.",
  // El servidor no recibió nada utilizable. Es configuración nuestra: mandarla
  // a pedir otro enlace la haría chocar con lo mismo.
  configuracion:
    "Algo está mal configurado de nuestro lado y no pudimos abrirte la sesión. Entra con Google mientras lo arreglamos, o escríbenos.",
  codigo: "No pudimos completar la entrada con Google. Prueba de nuevo.",
  "sin-codigo": "Google no nos devolvió nada. Prueba de nuevo.",
};

/**
 * La puerta. Va en negro como el sitio público —es donde llega quien viene de
 * la landing—, no en claro como los portales de BRAND.md §8.
 */
export default async function Entrar({ searchParams }: Props) {
  const { volver, error } = await searchParams;

  // `/entrar` como destino de sí misma sería un bucle con sesión puesta.
  const interno = volverInterno(volver);
  const pedido = interno && !empiezaEn(interno.split("?")[0], "/entrar") ? interno : null;

  // Quien ya tiene sesión no ve la puerta. Si venía pidiendo una página —el
  // botón de una clase especial, por ejemplo— se va a **esa**: mandarla a su
  // inicio la obligaría a buscar de nuevo lo que ya había elegido.
  //
  // **Salvo que venga con un error.** Un enlace vencido abierto en un navegador
  // con la sesión de otra persona dejaba esa sesión y mandaba a su inicio, sin
  // decir nada: Felipe abrió dos enlaces de owner y admin y cayó como profesora
  // (13/11/2026). Con error, se dice que el enlace no sirvió y de quién es la
  // sesión que quedó abierta.
  const perfil = await perfilActual();
  const mensaje = error ? ERRORES[error] ?? null : null;
  if (perfil && !mensaje) redirect(pedido ?? (await inicioPara(perfil)));
  const inicioDeLaSesion = perfil ? await inicioPara(perfil) : null;
  // **Solo el nombre de pila**, nunca el completo ni el correo (Felipe,
  // 13/11/2026; PRD-0026 §12.3): /entrar es ruta pública y esto es un mensaje
  // de error, y CLAUDE.md prohíbe ahí el nombre de una alumna. Quien lo ve ya
  // tiene esa sesión, así que no filtra nada nuevo, pero el completo no hace
  // falta para reconocer la cuenta.
  const pila = perfil?.nombre?.trim().split(/\s+/)[0] || null;

  // Sin una página pedida, el enlace vuelve **acá**: con la sesión ya puesta,
  // esta misma página decide el inicio según el rol, y para admin eso depende
  // de si hay transferencias esperando (PRD-0017 §19). Un destino fijo como el
  // `/mi-perfil` de antes no puede saberlo.
  const destino = pedido ?? "/entrar";

  return (
    <main className="xo-grain relative flex min-h-dvh flex-col justify-center px-6 py-16 sm:px-10">
      <div className="relative mx-auto w-full max-w-md">
        <Link href="/" aria-label="XO Dance Studio, ir al inicio">
          <Image
            src="/logo-xo.png"
            alt=""
            width={1192}
            height={789}
            priority
            className="h-10 w-auto"
          />
        </Link>

        <h1 className="mt-10 font-display text-[clamp(2.5rem,10vw,4rem)] leading-[0.9] text-xo-rosa">
          Entra a tu cuenta
        </h1>
        <p className="mt-4 text-xo-blanco/70">
          Acá ves tus clases y tus reservas. Si es tu primera vez, se te crea
          sola al entrar.
        </p>

        {mensaje ? (
          <p
            role="alert"
            data-error-de-enlace={error}
            className="mt-8 border-l-2 border-xo-rosa pl-4 text-sm leading-relaxed text-xo-rosa"
          >
            {mensaje}
          </p>
        ) : null}

        {perfil && inicioDeLaSesion ? (
          <div data-sesion-abierta className="mt-6 text-sm leading-relaxed text-xo-blanco/70">
            <p>
              En este navegador sigue abierta la sesión de{" "}
              <strong className="text-xo-blanco">{pila ?? "otra cuenta"}</strong>. Si el
              enlace era para otra cuenta, sal primero y pide uno nuevo.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <form action="/auth/salir" method="post">
                {/* Al salir vuelve acá, con la página que se había pedido. */}
                <input type="hidden" name="volver" value={`/entrar${pedido ? `?volver=${encodeURIComponent(pedido)}` : ""}`} />
                <button
                  type="submit"
                  className="xo-eyebrow rounded-full border border-xo-blanco/30 px-4 py-2 text-xo-blanco transition-colors hover:border-xo-rosa"
                >
                  Salir de esta cuenta
                </button>
              </form>
              <Link
                href={inicioDeLaSesion}
                className="xo-eyebrow text-xo-blanco/70 underline-offset-4 hover:text-xo-rosa hover:underline"
              >
                {pila ? `Seguir como ${pila}` : "Seguir con esta cuenta"}
              </Link>
            </div>
          </div>
        ) : null}

        <div className="mt-10">
          <FormularioEntrar volver={destino} />
        </div>

        <Link
          href="/"
          className="xo-eyebrow mt-12 inline-block text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
        >
          <span aria-hidden="true">← </span>Volver al sitio
        </Link>
      </div>
    </main>
  );
}
