import type { ReactNode } from "react";
import { cuandoLegible } from "@/lib/compras";
import { clp } from "@/lib/planes";
import {
  NOMBRE_CAUSA,
  formatoPromedio,
  textoDeBloqueo,
  type ClaseDelPromedio,
  type IncentivoDeHorario,
  type Linea,
} from "@/lib/dominio/liquidacion";
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

      <Resultados liquidacion={liquidacion} />

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

/**
 * Lo que suma el mes, justo antes del total (Felipe, 10/11/2026): la base, el
 * **variable** —que se despliega clase por clase— y los **objetivos**, en un
 * solo bloque, agrupados por horario. Cada objetivo dice si se logró y se
 * despliega con el promedio que lo sustenta y las clases que lo componen.
 *
 * Fuera de alcance: apretar una clase y ver quiénes fueron. Esa pantalla no
 * existe todavía (PRD-0031).
 */
function Resultados({ liquidacion }: { liquidacion: FotoLiquidacion }) {
  const dictadas = liquidacion.lineas.filter((l) => l.tipo === "dictada");
  const incentivos = liquidacion.incentivos ?? [];

  return (
    <div className="max-w-xl text-sm">
      <div className="flex justify-between py-2 text-xo-negro">
        <span>Base</span>
        <span>{clp(liquidacion.baseClp)}</span>
      </div>

      <Desplegable titulo="Variable" valor={clp(liquidacion.variableClp)}>
        {dictadas.length === 0 ? (
          <p className="text-xo-gris">Sin clases dictadas en este mes.</p>
        ) : (
          <ul className="divide-y divide-xo-negro/10">
            {dictadas.map((l) => (
              <li key={l.claseId} className="flex flex-wrap justify-between gap-x-4 py-2">
                <span className="text-xo-negro">
                  {cuandoLegible(l.inicio)} · {l.curso}
                </span>
                <span className="text-xo-gris">
                  {l.creditosConsumidos} {l.creditosConsumidos === 1 ? "crédito" : "créditos"} ·{" "}
                  <span className="text-xo-negro">{clp(l.variableClp)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Desplegable>

      <Desplegable titulo="Objetivos" valor={clp(liquidacion.incentivoClp)}>
        {incentivos.length === 0 ? (
          <p className="text-xo-gris">Sin clases dictadas: no hay objetivos que calcular.</p>
        ) : (
          <div className="space-y-5">
            {incentivos.map((i) => (
              <GrupoDeObjetivos key={i.horarioId ?? i.cursoId} incentivo={i} />
            ))}
          </div>
        )}
      </Desplegable>

      <div className="mt-2 flex justify-between border-t border-xo-negro/20 pt-3 text-base font-semibold text-xo-negro">
        <span>Total</span>
        <span>{clp(liquidacion.totalClp)}</span>
      </div>
    </div>
  );
}

/** Los dos objetivos de un horario. Una foto cerrada antes del 10/11 no trae `etiqueta` ni `objetivos`. */
function GrupoDeObjetivos({ incentivo: i }: { incentivo: IncentivoDeHorario }) {
  const objetivos = i.objetivos ?? [];
  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <h4 className="font-semibold text-xo-negro">{i.etiqueta ?? i.curso}</h4>
        <span className="font-semibold text-xo-negro">{clp(i.montoClp)}</span>
      </div>
      <ul className="mt-1">
        {objetivos.map((o, n) => (
          <li key={o.desdePromedio}>
            <Desplegable
              titulo={`Objetivo ${n + 1}: promedio de ${o.desdePromedio} o más`}
              valor={o.logrado ? `Obtenido · ${clp(o.montoClp)}` : "No obtenido"}
              chico
            >
              <Sustento incentivo={i} />
            </Desplegable>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** El promedio que sostiene un objetivo, con las clases que lo componen. */
function Sustento({ incentivo: i }: { incentivo: IncentivoDeHorario }) {
  const opta = i.promedio !== null;
  const clases: ClaseDelPromedio[] = opta ? i.clasesDelPromedio : (i.clasesDictadas ?? []);
  return (
    <div>
      <p className="text-xo-negro">
        {opta ? `Promedio ${formatoPromedio(i.promedio as number)} en las ${clases.length} mejores clases de este horario.` : i.explicacion}
      </p>
      {clases.length > 0 ? (
        <ul className="mt-2 text-xo-gris">
          {clases.map((c) => (
            <li key={c.claseId}>
              {cuandoLegible(c.inicio)} · {c.creditos} {c.creditos === 1 ? "crédito" : "créditos"}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Una fila que se aprieta y despliega lo que la sustenta. Sin JavaScript: `<details>`. */
function Desplegable({
  titulo,
  valor,
  chico = false,
  children,
}: {
  titulo: string;
  valor: string;
  chico?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={chico ? "group" : "group border-t border-xo-negro/10"}>
      <summary
        className={`flex cursor-pointer list-none items-baseline justify-between gap-x-4 [&::-webkit-details-marker]:hidden ${
          chico ? "py-1 text-xo-gris" : "py-2 text-xo-negro"
        }`}
      >
        <span className="flex items-baseline gap-2">
          <span aria-hidden className="inline-block motion-safe:transition-transform group-open:rotate-90">
            ›
          </span>
          {titulo}
        </span>
        <span className={chico ? "text-xo-negro" : undefined}>{valor}</span>
      </summary>
      <div className={chico ? "pb-2 pl-4" : "pb-3 pl-4"}>{children}</div>
    </details>
  );
}
