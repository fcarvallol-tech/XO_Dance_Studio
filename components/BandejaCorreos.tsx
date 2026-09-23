"use client";

import { useState, useTransition } from "react";
import { reintentarEnvio } from "@/lib/acciones";
import { cuandoLegible } from "@/lib/compras";
import { NOMBRE_PLANTILLA, type EnvioFallido } from "@/lib/envios";

/**
 * Los correos que no salieron.
 *
 * Dos listas separadas a propósito: los **fallidos** todavía pueden salir y
 * tienen botón; los **descartados** no, y lo que hay que hacer con ellos es
 * hablarle a esa persona por otro lado. Ponerlos juntos invitaría a apretar un
 * botón que no existe.
 */
export function BandejaCorreos({
  fallidos,
  descartados,
}: {
  fallidos: EnvioFallido[];
  descartados: EnvioFallido[];
}) {
  const [fallo, setFallo] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  return (
    <>
      {fallo ? (
        <p role="alert" className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}

      {fallidos.length === 0 ? (
        <p className="text-xo-gris">
          No hay ninguno fallido. Todos los correos salieron.
        </p>
      ) : (
        <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {fallidos.map((envio) => (
            <li key={envio.id} className="flex flex-wrap justify-between gap-4 py-4">
              <div className="max-w-2xl">
                <p className="font-semibold text-xo-negro">
                  {NOMBRE_PLANTILLA[envio.plantilla] ?? envio.plantilla}
                  <span className="font-normal text-xo-gris">
                    {" "}
                    · {envio.destinatario ?? "sin destinatario"}
                  </span>
                </p>
                <p className="mt-1 text-sm text-xo-gris">
                  {envio.intentos} {envio.intentos === 1 ? "intento" : "intentos"} ·{" "}
                  {envio.proximoIntentoAt
                    ? `el próximo, ${cuandoLegible(envio.proximoIntentoAt)}`
                    : "sin más intentos automáticos"}
                  {envio.caducaAt ? ` · caduca el ${cuandoLegible(envio.caducaAt)}` : ""}
                </p>
                {envio.ultimoError ? (
                  <p className="mt-1 text-sm text-xo-gris">{envio.ultimoError}</p>
                ) : null}
              </div>

              <button
                type="button"
                disabled={ocupado === envio.id}
                onClick={() => {
                  setFallo(null);
                  setOcupado(envio.id);
                  iniciar(async () => {
                    const resultado = await reintentarEnvio(envio.id);
                    if (!resultado.ok) setFallo(resultado.mensaje);
                    setOcupado(null);
                  });
                }}
                className="xo-eyebrow self-center rounded-full border border-xo-negro/20 px-4 py-2 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-50"
              >
                {ocupado === envio.id ? "…" : "Reintentar ahora"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {descartados.length > 0 ? (
        <>
          <h2 className="xo-eyebrow mt-14 text-xo-gris">Descartados</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-xo-gris">
            Estos no se van a mandar. Si alguno importaba —el cupo de una
            especial, por ejemplo— hay que hablarle a esa persona por WhatsApp:
            mandarle ahora un aviso que ya no es cierto sería peor.
          </p>
          <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {descartados.map((envio) => (
              <li key={envio.id} className="py-3">
                <p className="text-sm text-xo-negro">
                  {NOMBRE_PLANTILLA[envio.plantilla] ?? envio.plantilla} ·{" "}
                  {envio.destinatario ?? "sin destinatario"}
                </p>
                <p className="text-sm text-xo-gris">
                  {cuandoLegible(envio.creadoAt)}
                  {envio.motivoDescarte ? ` · ${envio.motivoDescarte}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
