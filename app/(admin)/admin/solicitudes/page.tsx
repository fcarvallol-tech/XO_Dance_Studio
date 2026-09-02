import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { BandejaSolicitudes } from "@/components/BandejaSolicitudes";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { nombreDia } from "@/lib/catalogo";
import { cuandoLegible } from "@/lib/compras";
import {
  getConflictos,
  getSolicitudesPendientes,
  getSolicitudesResueltas,
  type Conflicto,
} from "@/lib/profesora-consultas";

export const metadata: Metadata = {
  title: "Horarios pedidos — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * La bandeja del otro lado de PRD-0008.
 *
 * Es alcance de PRD-0009, pero sin ella una solicitud cae en un buzón que nadie
 * abre. Se adelanta **solo resolver solicitudes**, no el resto del portal de
 * administración.
 */
export default async function Solicitudes() {
  await requiereNivel("admin", "admin");

  const [pendientes, resueltas] = await Promise.all([
    getSolicitudesPendientes(),
    getSolicitudesResueltas(),
  ]);

  // Los choques se calculan por solicitud: son pocas y es contexto para
  // decidir, no un filtro.
  const conflictos: Record<string, Conflicto[]> = {};
  await Promise.all(
    pendientes.datos.map(async (solicitud) => {
      conflictos[solicitud.id] = await getConflictos(solicitud.id);
    }),
  );

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Horarios que pidieron las profes"
        bajada="Las profesoras piden bloques nuevos. Contesta siempre algo: lo que escribas es lo que ella va a leer."
      />

      <ErrorDeLectura que="las solicitudes pendientes" error={pendientes.error} />

      {pendientes.error ? null : (
        <BandejaSolicitudes
          pendientes={pendientes.datos}
          conflictos={conflictos}
        />
      )}

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Resueltas</h2>
      <ErrorDeLectura que="las solicitudes resueltas" error={resueltas.error} />

      {resueltas.error ? null : resueltas.datos.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no has resuelto ninguna.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {resueltas.datos.map((solicitud) => (
            <li key={solicitud.id} className="py-3">
              <div className="flex flex-wrap justify-between gap-3">
                <p className="text-sm text-xo-negro">
                  {solicitud.profesoraNombre} · {nombreDia(solicitud.diaSemana)}{" "}
                  {solicitud.hora} ·{" "}
                  {solicitud.cursoNombre ?? solicitud.cursoPropuesto}
                </p>
                <p className="xo-eyebrow text-xo-gris">
                  {solicitud.estado === "aprobada" ? "Aprobada" : "Rechazada"}
                  {solicitud.resueltaAt
                    ? ` · ${cuandoLegible(solicitud.resueltaAt).split(",")[0]}`
                    : ""}
                </p>
              </div>
              {solicitud.respuesta ? (
                <p className="mt-1 text-sm text-xo-gris">
                  {solicitud.respuesta}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
