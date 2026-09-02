"use client";

import { useState, useTransition } from "react";
import { resolverSolicitud } from "@/lib/acciones";
import { nombreDia } from "@/lib/catalogo";
import { cuandoLegible } from "@/lib/compras";
import type { Conflicto, Solicitud } from "@/lib/profesora-consultas";

/**
 * Resolver pedidos de horario.
 *
 * La respuesta es obligatoria en los dos casos, no solo al rechazar: aprobar
 * sin decir nada deja a la profesora sin saber cuándo empieza. La base también
 * la exige.
 */
export function BandejaSolicitudes({
  pendientes,
  conflictos,
}: {
  pendientes: Solicitud[];
  /** Por id de solicitud: qué choca con ella. Contexto, no bloqueo. */
  conflictos: Record<string, Conflicto[]>;
}) {
  const [abierta, setAbierta] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  if (pendientes.length === 0) {
    return (
      <p className="text-xo-gris">
        No hay pedidos esperando respuesta.
      </p>
    );
  }

  function resolver(id: string, estado: "aprobada" | "rechazada") {
    setFallo(null);
    setOcupada(id);
    iniciar(async () => {
      const resultado = await resolverSolicitud(id, estado, respuesta);
      if (!resultado.ok) setFallo(resultado.mensaje);
      else {
        setAbierta(null);
        setRespuesta("");
      }
      setOcupada(null);
    });
  }

  return (
    <div>
      {fallo ? (
        <p
          role="alert"
          className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}

      <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        {pendientes.map((solicitud) => {
          const choques = conflictos[solicitud.id] ?? [];

          return (
            <li key={solicitud.id} className="py-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg text-xo-negro">
                    {solicitud.profesoraNombre} ·{" "}
                    {nombreDia(solicitud.diaSemana)} {solicitud.hora}
                  </p>
                  <p className="text-sm text-xo-gris">
                    {solicitud.cursoNombre ?? solicitud.cursoPropuesto}
                    {solicitud.cursoPropuesto && !solicitud.cursoNombre
                      ? " · curso que no existe en el catálogo"
                      : ""}{" "}
                    · {solicitud.sedeNombre ?? "cualquier sala"}
                  </p>
                  <p className="text-sm text-xo-gris">
                    Pedido el {cuandoLegible(solicitud.createdAt).split(",")[0]}
                  </p>
                  {solicitud.mensaje ? (
                    <p className="mt-2 max-w-prose text-sm leading-relaxed text-xo-negro">
                      &laquo;{solicitud.mensaje}&raquo;
                    </p>
                  ) : null}

                  {choques.length > 0 ? (
                    <div className="mt-3 border-l-2 border-xo-negro/40 pl-4">
                      <p className="text-sm font-medium text-xo-negro">
                        Choca con lo que ya existe:
                      </p>
                      <ul className="mt-1 space-y-1">
                        {choques.map((choque, i) => (
                          <li key={i} className="text-sm text-xo-gris">
                            {choque.motivo === "sala"
                              ? "Misma sala y hora"
                              : "Ella ya dicta a esa hora"}
                            : {choque.detalle}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setAbierta(abierta === solicitud.id ? null : solicitud.id)
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50"
                >
                  {abierta === solicitud.id ? "Cerrar" : "Responder"}
                </button>
              </div>

              {abierta === solicitud.id ? (
                <div className="mt-4">
                  <label
                    htmlFor={`respuesta-${solicitud.id}`}
                    className="xo-eyebrow text-xo-gris"
                  >
                    Tu respuesta · la va a leer ella
                  </label>
                  <textarea
                    id={`respuesta-${solicitud.id}`}
                    rows={2}
                    value={respuesta}
                    onChange={(evento) => setRespuesta(evento.target.value)}
                    className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-sm text-xo-negro"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={!respuesta.trim() || ocupada === solicitud.id}
                      onClick={() => resolver(solicitud.id, "aprobada")}
                      className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-40"
                    >
                      Aprobar
                    </button>
                    <button
                      type="button"
                      disabled={!respuesta.trim() || ocupada === solicitud.id}
                      onClick={() => resolver(solicitud.id, "rechazada")}
                      className="xo-eyebrow rounded-full border border-xo-negro px-5 py-2.5 text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-40"
                    >
                      Rechazar
                    </button>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-xo-gris">
                    Aprobar registra la decisión y le responde.{" "}
                    <strong className="font-medium text-xo-negro">
                      Crear el bloque en la parrilla se hace aparte
                    </strong>
                    , en el catálogo: toca los cupos y el calendario de las
                    alumnas.
                  </p>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
