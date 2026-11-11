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
 * Lo que suma el mes, justo antes del total (Felipe, 10/11/2026). **Variable**
 * y **Objetivos** son apartados como "Clases dictadas", con su encabezado, y se
 * abren igual que la ficha de una profesora: apretando el encabezado. Variable
 * se despliega clase por clase; Objetivos, por horario, con los dos objetivos
 * adentro, cada uno con el promedio que lo sustenta.
 *
 * Fuera de alcance: apretar una clase y ver quiénes fueron. Esa pantalla no
 * existe todavía (PRD-0031).
 */
function Resultados({ liquidacion }: { liquidacion: FotoLiquidacion }) {
  const dictadas = liquidacion.lineas.filter((l) => l.tipo === "dictada");
  const incentivos = liquidacion.incentivos ?? [];

  return (
    <>
      <Apartado titulo="Variable" valor={clp(liquidacion.variableClp)}>
        {dictadas.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Sin clases dictadas en este mes.</p>
        ) : (
          <ul className="mt-3 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {dictadas.map((l) => (
              <li key={l.claseId} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <p className="font-semibold text-xo-negro">{l.curso}</p>
                  <p className="font-semibold text-xo-negro">{clp(l.variableClp)}</p>
                </div>
                <p className="mt-1 text-sm text-xo-gris">
                  {cuandoLegible(l.inicio)} · {l.creditosConsumidos}{" "}
                  {l.creditosConsumidos === 1 ? "crédito" : "créditos"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </Apartado>

      <Apartado titulo="Objetivos" valor={clp(liquidacion.incentivoClp)}>
        {incentivos.length === 0 ? (
          <p className="mt-3 text-sm text-xo-gris">Sin clases dictadas: no hay objetivos que calcular.</p>
        ) : (
          <ul className="mt-3 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {incentivos.map((i) => (
              <li key={i.horarioId ?? i.cursoId} className="py-3">
                <GrupoDeObjetivos incentivo={i} />
              </li>
            ))}
          </ul>
        )}
      </Apartado>

      <dl className="max-w-sm text-sm">
        <Fila nombre="Base" valor={clp(liquidacion.baseClp)} />
        <Fila nombre="Variable" valor={clp(liquidacion.variableClp)} />
        <Fila nombre="Objetivos" valor={clp(liquidacion.incentivoClp)} />
        <div className="mt-2 flex justify-between border-t border-xo-negro/20 pt-2 text-base font-semibold text-xo-negro">
          <dt>Total</dt>
          <dd>{clp(liquidacion.totalClp)}</dd>
        </div>
      </dl>
    </>
  );
}

/** Los dos objetivos de un horario. Una foto cerrada antes del 10/11 no trae `etiqueta` ni `objetivos`. */
function GrupoDeObjetivos({ incentivo: i }: { incentivo: IncentivoDeHorario }) {
  const objetivos = i.objetivos ?? [];
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-semibold text-xo-negro">{i.etiqueta ?? i.curso}</p>
        <p className="font-semibold text-xo-negro">{clp(i.montoClp)}</p>
      </div>
      <ul className="mt-2 space-y-2">
        {objetivos.map((o, n) => (
          <li key={o.desdePromedio}>
            <details>
              <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4 text-sm">
                <span className="text-xo-negro underline underline-offset-4">
                  Objetivo {n + 1}: promedio de {o.desdePromedio} o más
                </span>
                <span className="text-xo-negro">{o.logrado ? `Obtenido · ${clp(o.montoClp)}` : "No obtenido"}</span>
              </summary>
              <div className="mt-2 border-l-2 border-xo-negro/20 pl-4 text-sm">
                <Sustento incentivo={i} />
              </div>
            </details>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** El promedio que sostiene un objetivo, con las clases que lo componen. */
function Sustento({ incentivo: i }: { incentivo: IncentivoDeHorario }) {
  const opta = i.promedio !== null;
  const clases: ClaseDelPromedio[] = opta ? i.clasesDelPromedio : (i.clasesDictadas ?? []);
  return (
    <div>
      <p className="text-xo-negro">
        {opta
          ? `Promedio ${formatoPromedio(i.promedio as number)} en las ${clases.length} mejores clases de este horario.`
          : i.explicacion}
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

/**
 * Un apartado con el encabezado de "Clases dictadas", que se abre al apretar el
 * encabezado, como la ficha de una profesora. Sin JavaScript: `<details>`.
 */
function Apartado({ titulo, valor, children }: { titulo: string; valor: string; children: ReactNode }) {
  return (
    <details>
      <summary className="flex cursor-pointer flex-wrap items-baseline justify-between gap-x-4">
        <h3 className="xo-eyebrow text-xo-gris">{titulo}</h3>
        <span className="font-semibold text-xo-negro">{valor}</span>
      </summary>
      {children}
    </details>
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
