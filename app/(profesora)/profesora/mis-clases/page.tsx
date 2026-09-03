import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { GrillaSemanal } from "@/components/GrillaSemanal";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { getProximaClase, getSemana } from "@/lib/profesora-consultas";
import { esDiaValido, hoyEnSantiago, lunesDe, sumarDias } from "@/lib/semana";

export const metadata: Metadata = {
  // "La semana" describe lo que se ve. La etiqueta del menú sigue diciendo
  // "Clases que dicto", que es para qué entra.
  title: "La semana — XO Dance Studio",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ semana?: string }> };

/**
 * La parrilla de la semana, con su próxima clase arriba.
 *
 * Son dos lecturas distintas en una página, a propósito:
 *
 * - **La tira de arriba** responde el caso de PRD-0008 §2 —mirar el teléfono
 *   minutos antes de entrar a la sala— y para eso una línea sirve más que una
 *   grilla.
 * - **La grilla** responde el otro: saber qué está ocupado y en qué sede antes
 *   de pedir un horario. Por eso muestra la academia completa y no solo lo suyo.
 */
export default async function LaSemana({ searchParams }: Props) {
  await requiereNivel("profesora", "profesora");
  const { semana } = await searchParams;

  // Lo que llega por la URL no se confía: un valor inválido cae en esta semana.
  const lunes = lunesDe(esDiaValido(semana) ? semana : hoyEnSantiago());

  const [grilla, proxima] = await Promise.all([getSemana(lunes), getProximaClase()]);

  // `generar_clases` materializa 70 días. Más allá la grilla sale vacía, y decir
  // "no hay clases" sería mentir: todavía no están generadas.
  const limiteGeneracion = sumarDias(hoyEnSantiago(), 70);

  return (
    <>
      <TituloPortal
        eyebrow="Portal de profesora"
        titulo="La semana"
        bajada="Toda la parrilla de la academia. Las tuyas en rosa y con su lista de inscritas; las de las otras profes están para que sepas qué está ocupado y dónde."
      />

      <ErrorDeLectura que="tu próxima clase" error={proxima.error} />

      {proxima.error ? null : proxima.datos ? (
        <Link
          href={`/profesora/clases/${proxima.datos.id}`}
          className="mb-10 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-xo-negro bg-xo-negro/5 px-5 py-4 transition-colors hover:border-xo-negro/60"
        >
          <div>
            <p className="xo-eyebrow text-xo-gris">Tu próxima clase</p>
            <p className="mt-1 text-lg text-xo-negro">
              {proxima.datos.cursoNombre} · {cuandoLegible(proxima.datos.inicio)}
            </p>
            <p className="text-sm text-xo-gris">
              {proxima.datos.sedeNombre}, {proxima.datos.sedeComuna}
            </p>
          </div>
          <p className="xo-eyebrow whitespace-nowrap text-xo-negro">
            {proxima.datos.inscritas}/{proxima.datos.cupoMaximo} inscritas
          </p>
        </Link>
      ) : (
        <p className="mb-10 text-xo-gris">No tienes clases próximas.</p>
      )}

      <ErrorDeLectura que="la parrilla de la semana" error={grilla.error} />

      {grilla.error ? null : (
        <GrillaSemanal
          lunes={lunes}
          dias={grilla.datos.dias}
          hayClases={grilla.datos.hayClases}
          limiteGeneracion={limiteGeneracion}
        />
      )}
    </>
  );
}
