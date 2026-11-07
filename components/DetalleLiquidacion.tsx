import type { ReactNode } from "react";
import { cuandoLegible } from "@/lib/compras";
import { clp } from "@/lib/planes";
import { NOMBRE_CAUSA, textoDeBloqueo, type Linea } from "@/lib/dominio/liquidacion";
import type { FotoLiquidacion } from "@/lib/liquidacion-consultas";

/**
 * El detalle de una liquidación. Lo usan el owner y la profesora: los dos ven lo
 * mismo de esa profesora. Solo números y clases: **ningún dato de una alumna**,
 * y los créditos son una cantidad, no quiénes (ADR-0008).
 */
export function DetalleLiquidacion({
  liquidacion,
  accionDeLinea,
}: {
  liquidacion: FotoLiquidacion;
  /** Lo que se puede hacer con una línea. La profesora no recibe ninguna. */
  accionDeLinea?: (linea: Linea) => ReactNode;
}) {
  const dictadas = liquidacion.lineas.filter((l) => l.tipo === "dictada");
  const noDictadas = liquidacion.lineas.filter((l) => l.tipo === "no_dictada" || l.tipo === "sin_causa");

  return (
    <div className="space-y-10">
      <section>
        <h3 className="xo-eyebrow text-xo-gris">Clases dictadas</h3>
        {dictadas.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Ninguna en este mes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {dictadas.map((l) => (
              <li key={l.claseId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-xo-negro">{l.curso}</p>
                  <p className="font-semibold text-xo-negro">{clp(l.totalClp)}</p>
                </div>
                <p className="mt-1 text-sm text-xo-gris">
                  {cuandoLegible(l.inicio)} · {l.sede}
                </p>
                <p className="mt-1 text-sm text-xo-gris">
                  {l.creditosConsumidos} {l.creditosConsumidos === 1 ? "crédito" : "créditos"} · base {clp(l.baseClp)} ·
                  variable {clp(l.variableClp)}
                </p>
                {l.recuperaInicio ? (
                  <p className="mt-1 text-sm text-xo-gris">Recupera la del {cuandoLegible(l.recuperaInicio)}.</p>
                ) : null}
                {accionDeLinea?.(l)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="xo-eyebrow text-xo-gris">Clases que no se dictaron</h3>
        {noDictadas.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Ninguna en este mes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {noDictadas.map((l) => (
              <li key={l.claseId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-xo-negro">{l.curso}</p>
                  <p className="font-semibold text-xo-negro">{l.totalClp > 0 ? clp(l.totalClp) : "No paga"}</p>
                </div>
                <p className="mt-1 text-sm text-xo-gris">
                  {cuandoLegible(l.inicio)} · {l.sede}
                </p>
                <p className="mt-1 text-sm text-xo-negro">
                  {l.causa ? `Causa: ${NOMBRE_CAUSA[l.causa]}.` : "Sin causa."} {l.explicacion}
                </p>
                {accionDeLinea?.(l)}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="xo-eyebrow text-xo-gris">Incentivo</h3>
        {liquidacion.incentivos.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Sin clases dictadas: no hay incentivo que calcular.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {liquidacion.incentivos.map((i) => (
              <li key={i.cursoId} className="border-l-2 border-xo-negro/20 pl-4">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-xo-negro">{i.curso}</p>
                  <p className="font-semibold text-xo-negro">{i.montoClp > 0 ? clp(i.montoClp) : "Sin incentivo"}</p>
                </div>
                <p className="mt-1 text-sm text-xo-negro">{i.explicacion}</p>
                {i.clasesDelPromedio.length > 0 ? (
                  <ul className="mt-2 text-sm text-xo-gris">
                    {i.clasesDelPromedio.map((c) => (
                      <li key={c.claseId}>
                        {cuandoLegible(c.inicio)} · {c.creditos} {c.creditos === 1 ? "crédito" : "créditos"}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="xo-eyebrow text-xo-gris">Lo que no entra en este pago</h3>
        {liquidacion.noEntra.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Nada: todas las clases del mes están en el total.</p>
        ) : (
          <ul className="mt-3 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {liquidacion.noEntra.map((n) => (
              <li key={n.claseId} className="py-3">
                <p className="font-semibold text-xo-negro">
                  {n.curso} · {cuandoLegible(n.inicio)}
                </p>
                <p className="mt-1 text-sm text-xo-negro">{n.explicacion}</p>
                {n.cae ? <p className="mt-1 text-sm text-xo-gris">Se recupera el {cuandoLegible(n.cae)}.</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {liquidacion.especiales > 0 ? (
        <p className="text-sm text-xo-gris">
          {liquidacion.especiales === 1 ? "1 clase especial, se paga aparte." : `${liquidacion.especiales} clases especiales, se pagan aparte.`}
        </p>
      ) : null}

      <dl className="max-w-sm text-sm">
        <Fila nombre="Base" valor={clp(liquidacion.baseClp)} />
        <Fila nombre="Variable" valor={clp(liquidacion.variableClp)} />
        <Fila nombre="Incentivo" valor={clp(liquidacion.incentivoClp)} />
        <div className="mt-2 flex justify-between border-t border-xo-negro/20 pt-2 text-base font-semibold text-xo-negro">
          <dt>Total</dt>
          <dd>{clp(liquidacion.totalClp)}</dd>
        </div>
      </dl>

      {liquidacion.bloqueos.length > 0 ? (
        <ul className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {liquidacion.bloqueos.map((b) => (
            <li key={b.tipo}>{textoDeBloqueo(b)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Fila({ nombre, valor }: { nombre: string; valor: string }) {
  return (
    <div className="flex justify-between py-1 text-xo-gris">
      <dt>{nombre}</dt>
      <dd>{valor}</dd>
    </div>
  );
}
