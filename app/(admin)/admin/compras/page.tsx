import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { BandejaCompras } from "@/components/BandejaCompras";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { clp } from "@/lib/planes";
import { NOMBRE_ESTADO, cuandoLegible, type EstadoCompra } from "@/lib/compras";
import { getComprasPendientes, getComprasResueltas } from "@/lib/compras-consultas";

export const metadata: Metadata = {
  title: "Transferencias — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * La bandeja de aprobación.
 *
 * Lee con la sesión de quien mira: si no fuera admin, RLS devuelve vacío en vez
 * de filtrar compras ajenas. La aprobación sí pasa por la service role key,
 * porque `acreditar_compra` está concedida solo a `service_role` — y esa
 * función vuelve a verificar el rol adentro.
 */
export default async function Compras() {
  await requiereNivel("admin", "admin");

  const [pendientes, resueltas] = await Promise.all([
    getComprasPendientes(),
    getComprasResueltas(),
  ]);

  const enJuego = pendientes.datos.reduce((total, compra) => total + compra.monto, 0);

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Transferencias"
        bajada="Abre la cuenta del banco, encuentra el abono y aprueba. Aprobar acredita las clases al tiro; rechazar pide motivo, porque del otro lado alguien transfirió plata."
      />

      <ErrorDeLectura que="las transferencias pendientes" error={pendientes.error} />

      {pendientes.datos.length > 0 ? (
        <p className="mb-8 text-xo-gris">
          <strong className="text-xo-negro">{pendientes.datos.length}</strong>{" "}
          esperando · {clp(enJuego)} por confirmar
        </p>
      ) : null}

      {/* El estado vacío solo si NO hubo error: es la distinción que faltaba. */}
      {pendientes.error ? null : (
        <BandejaCompras pendientes={pendientes.datos} />
      )}

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Resueltas</h2>
      <ErrorDeLectura que="las transferencias resueltas" error={resueltas.error} />

      {resueltas.error ? null : resueltas.datos.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no hay ninguna resuelta.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {resueltas.datos.map((compra) => (
            <li key={compra.id} className="flex flex-wrap justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-xo-negro">
                  {compra.alumna ?? "Sin nombre"} · {compra.planNombre} ·{" "}
                  {clp(compra.monto)}
                </p>
                <p className="text-sm text-xo-gris">
                  {cuandoLegible(compra.declaradaAt)}
                  {compra.motivoRechazo ? ` · ${compra.motivoRechazo}` : ""}
                </p>
              </div>
              <p className="xo-eyebrow self-center text-xo-gris">
                {NOMBRE_ESTADO[compra.estado as EstadoCompra]}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
