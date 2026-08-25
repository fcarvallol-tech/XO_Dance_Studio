import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormularioEntrar } from "@/components/FormularioEntrar";
import { perfilActual } from "@/lib/sesion";
import { inicioSegunRol } from "@/lib/roles";

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
  codigo: "No pudimos completar la entrada con Google. Prueba de nuevo.",
  "sin-codigo": "Google no nos devolvió nada. Prueba de nuevo.",
};

/**
 * La puerta. Va en negro como el sitio público —es donde llega quien viene de
 * la landing—, no en claro como los portales de BRAND.md §8.
 */
export default async function Entrar({ searchParams }: Props) {
  const { volver, error } = await searchParams;

  // Quien ya tiene sesión no ve la puerta: se va a donde le corresponde.
  const perfil = await perfilActual();
  if (perfil) redirect(inicioSegunRol(perfil.rol));

  const destino = volver?.startsWith("/") && !volver.startsWith("//") ? volver : "/mi-perfil";

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

        {error && ERRORES[error] ? (
          <p
            role="alert"
            className="mt-8 border-l-2 border-xo-rosa pl-4 text-sm leading-relaxed text-xo-rosa"
          >
            {ERRORES[error]}
          </p>
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
