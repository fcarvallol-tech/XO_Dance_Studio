import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { Calendario } from "@/components/Calendario";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
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

  // La única lectura de esta página que puede fallar en silencio, y está bien
  // que lo haga: es una preferencia con un valor por defecto sensato, no un
  // dato. Que el calendario muestre 60 días porque no se pudo leer el
  // parámetro es indistinguible —y equivalente— a que el parámetro diga 60.
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
        bajada="Reservas al tiro, sin esperar a nadie. Cada reserva descuenta una clase de tu saldo, y puedes cancelar hasta 30 minutos antes."
      />

      <ErrorDeLectura que="tu saldo de clases" error={saldo.error} />

      {saldo.error ? null : (
        <div className="mb-10 flex flex-wrap items-center gap-4 rounded-lg border border-xo-negro/20 px-5 py-4">
          <p className="text-xo-negro">
            Te quedan{" "}
            <strong className="text-lg font-semibold">
              {saldo.datos} {saldo.datos === 1 ? "clase" : "clases"}
            </strong>
          </p>
          {saldo.datos === 0 ? (
            <Link
              href="/comprar"
              className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 text-xo-negro transition-opacity hover:opacity-80"
            >
              Comprar clases
            </Link>
          ) : null}
        </div>
      )}

      <ErrorDeLectura que="el calendario de clases" error={clases.error} />

      {clases.error ? null : clases.datos.length === 0 ? (
        <p className="text-xo-gris">
          Todavía no hay clases publicadas para las próximas semanas.
        </p>
      ) : (
        <Calendario clases={clases.datos} saldo={saldo.datos} />
      )}
    </>
  );
}
