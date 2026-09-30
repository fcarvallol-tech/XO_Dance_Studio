import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { FormularioEgreso } from "@/components/FormularioEgreso";
import { requiereNivel } from "@/lib/sesion";
import { getOpcionesEgreso } from "@/lib/finanzas-consultas";

export const metadata: Metadata = {
  title: "Nuevo egreso — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Hoy en Santiago, como `YYYY-MM-DD`. El navegador de quien registra puede estar en otra zona. */
function hoyEnSantiago(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function NuevoEgreso() {
  await requiereNivel("owner", "owner");
  const opciones = await getOpcionesEgreso();

  return (
    <>
      <TituloPortal
        eyebrow="Finanzas"
        titulo="Registrar un egreso"
        bajada="Algo que ya se pagó: el arriendo, un parlante, la pauta de Instagram. Queda en la caja del mes de la fecha que pongas."
      />

      <Link
        href="/owner/finanzas"
        className="xo-eyebrow mb-10 inline-block text-xo-gris underline underline-offset-4"
      >
        ← Finanzas
      </Link>

      <ErrorDeLectura que="las categorías y las sedes" error={opciones.error} />
      {!opciones.error ? (
        <FormularioEgreso opciones={opciones.datos} hoy={hoyEnSantiago()} />
      ) : null}
    </>
  );
}
