import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { Calendario } from "@/components/Calendario";
import { requiereSesion } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";
import { getCalendario, getSaldo } from "@/lib/compras-consultas";

export const metadata: Metadata = {
  title: "Reservar — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * El calendario.
 *
 * **60 días y no una semana**, porque es exactamente la vigencia del crédito:
 * cualquier clase que se ve acá se puede pagar con lo que ya se compró. Una
 * ventana semanal escondería justo lo que hace valioso al crédito universal.
 * Ver PRD-0017 §6.
 */
export default async function Reservar() {
  const perfil = await requiereSesion("cuenta");
  const supabase = await clienteServidor();

  const { data: parametro } = await supabase
    .from("parametros")
    .select("valor")
    .eq("clave", "calendario_dias")
    .maybeSingle();

  const dias = Number(parametro?.valor ?? 60) || 60;

  const [clases, saldo] = await Promise.all([
    getCalendario(perfil.id, dias),
    getSaldo(perfil.id),
  ]);

  return (
    <>
      <TituloPortal
        eyebrow="Reservar"
        titulo="Las próximas clases"
        bajada={`Reservas al tiro, sin esperar a nadie. Cada reserva descuenta una clase de tu saldo, y puedes cancelar hasta 30 minutos antes.`}
      />

      <div className="mb-10 flex flex-wrap items-center gap-4 rounded-lg border border-xo-negro/20 px-5 py-4">
        <p className="text-xo-negro">
          Te quedan{" "}
          <strong className="text-lg font-semibold">
            {saldo} {saldo === 1 ? "clase" : "clases"}
          </strong>
        </p>
        {saldo === 0 ? (
          <Link
            href="/comprar"
            className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 text-xo-negro transition-opacity hover:opacity-80"
          >
            Comprar clases
          </Link>
        ) : null}
      </div>

      {clases.length === 0 ? (
        <p className="text-xo-gris">
          Todavía no hay clases publicadas para las próximas semanas.
        </p>
      ) : (
        <Calendario clases={clases} saldo={saldo} />
      )}
    </>
  );
}
