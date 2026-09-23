import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { BandejaCorreos } from "@/components/BandejaCorreos";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { getEnviosDescartados, getEnviosFallidos } from "@/lib/envios-consultas";

export const metadata: Metadata = {
  title: "Correos — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * Los correos que no salieron (PRD-0019).
 *
 * Existe porque durante dos meses el sistema prometió reintentar comprobantes y
 * no lo hacía: el fallo se escribía en un log que nadie lee y se veía igual que
 * el caso normal. Ahora, si algo no sale, está acá.
 */
export default async function Correos() {
  await requiereNivel("admin", "admin");

  const [fallidos, descartados] = await Promise.all([
    getEnviosFallidos(),
    getEnviosDescartados(),
  ]);

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Correos"
        bajada="Lo que no salió. El sistema reintenta solo una vez al día; si algo urge —el cupo de una especial— no esperes al cron: reintenta acá o escribe por WhatsApp."
      />

      <ErrorDeLectura que="los correos fallidos" error={fallidos.error} />
      <ErrorDeLectura que="los correos descartados" error={descartados.error} />

      {fallidos.error ? null : (
        <BandejaCorreos fallidos={fallidos.datos} descartados={descartados.datos} />
      )}
    </>
  );
}
