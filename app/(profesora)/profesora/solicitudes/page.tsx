import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { FormularioSolicitud } from "@/components/FormularioSolicitud";
import { requiereNivel } from "@/lib/sesion";
import { nombreDia } from "@/lib/catalogo";
import { getCatalogoPublico } from "@/lib/catalogo-consultas";
import { getMisSolicitudes } from "@/lib/profesora-consultas";
import { cuandoLegible } from "@/lib/compras";

export const metadata: Metadata = {
  title: "Pedir horario — XO Dance Studio",
  robots: { index: false, follow: false },
};

const ESTADO: Record<string, string> = {
  pendiente: "Esperando respuesta",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export default async function Solicitudes() {
  await requiereNivel("profesora", "profesora");

  const [catalogo, solicitudes] = await Promise.all([
    getCatalogoPublico(),
    getMisSolicitudes(),
  ]);

  return (
    <>
      <TituloPortal
        eyebrow="Portal de profesora"
        titulo="Pedir un horario"
        bajada="Propón un bloque nuevo: día, hora y qué quieres hacer. Administración lo revisa y te responde acá."
      />

      <FormularioSolicitud cursos={catalogo.cursos} sedes={catalogo.sedes} />

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Tus pedidos</h2>
      <ErrorDeLectura que="tus pedidos" error={solicitudes.error} />

      {solicitudes.error ? null : solicitudes.datos.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no has pedido ningún horario.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {solicitudes.datos.map((solicitud) => (
            <li key={solicitud.id} className="py-4">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="text-xo-negro">
                    {nombreDia(solicitud.diaSemana)} {solicitud.hora} ·{" "}
                    {solicitud.cursoNombre ?? solicitud.cursoPropuesto}
                    {solicitud.cursoPropuesto && !solicitud.cursoNombre
                      ? " (curso nuevo)"
                      : ""}
                  </p>
                  <p className="text-sm text-xo-gris">
                    {solicitud.sedeNombre ?? "Cualquier sala"} · pedido el{" "}
                    {cuandoLegible(solicitud.createdAt).split(",")[0]}
                  </p>
                  {solicitud.mensaje ? (
                    <p className="mt-1 text-sm text-xo-gris">
                      &laquo;{solicitud.mensaje}&raquo;
                    </p>
                  ) : null}
                </div>
                <p className="xo-eyebrow self-start text-xo-gris">
                  {ESTADO[solicitud.estado]}
                </p>
              </div>

              {solicitud.respuesta ? (
                <p className="mt-3 border-l-2 border-xo-negro/30 pl-4 text-sm leading-relaxed text-xo-negro">
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
