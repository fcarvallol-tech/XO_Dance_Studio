import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { claveDia, diaLegible, horaLegible } from "@/lib/compras";
import { getMisClases } from "@/lib/profesora-consultas";

export const metadata: Metadata = {
  title: "Mis clases — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * Sus clases: las próximas primero, agrupadas por día.
 *
 * Pensada para el teléfono, minutos antes de entrar a la sala: lo que tiene que
 * poder leer de un vistazo es a qué hora, dónde, y cuántas vienen.
 *
 * **Ninguna consulta filtra por profesora en TypeScript.** Lo hace la política
 * `clases_de_la_profesora` en la base. Si se filtrara acá y la política
 * faltara, el bug sería invisible hasta que alguien mirara la API directa.
 */
export default async function MisClases() {
  await requiereNivel("profesora", "profesora");

  // Una semana atrás para poder mirar la clase de ayer, 60 adelante para ver
  // la parrilla completa que las alumnas pueden reservar.
  const clases = await getMisClases(-7, 60);

  const ahora = new Date().toISOString();
  const proximas = clases.datos.filter((c) => c.inicio >= ahora);
  const pasadas = clases.datos.filter((c) => c.inicio < ahora).reverse();

  const dias = new Map<string, typeof proximas>();
  for (const clase of proximas) {
    const clave = claveDia(clase.inicio);
    dias.set(clave, [...(dias.get(clave) ?? []), clase]);
  }

  return (
    <>
      <TituloPortal
        eyebrow="Portal de profesora"
        titulo="Mis clases"
        bajada="Tus clases de las próximas semanas, con cuántas alumnas van inscritas. Toca una para ver quiénes son."
      />

      <ErrorDeLectura que="tus clases" error={clases.error} />

      {clases.error ? null : proximas.length === 0 ? (
        <p className="text-xo-gris">
          No tienes clases programadas en las próximas semanas.
        </p>
      ) : (
        <div className="space-y-10">
          {[...dias.entries()].map(([clave, delDia]) => (
            <section key={clave}>
              <h2 className="xo-eyebrow border-b border-xo-negro/15 pb-2 text-xo-gris">
                {diaLegible(delDia[0].inicio)}
              </h2>

              <ul className="mt-4 space-y-3">
                {delDia.map((clase) => (
                  <li key={clase.id}>
                    <Link
                      href={`/profesora/clases/${clase.id}`}
                      className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4 transition-colors hover:border-xo-negro/50 ${
                        clase.cancelada
                          ? "border-xo-negro/20 bg-xo-negro/5"
                          : "border-xo-negro/20"
                      }`}
                    >
                      <div>
                        <p className="text-xo-negro">
                          <span className="font-semibold">
                            {horaLegible(clase.inicio)}
                          </span>{" "}
                          · {clase.cursoNombre}
                        </p>
                        <p className="text-sm text-xo-gris">
                          {clase.sedeNombre}, {clase.sedeComuna}
                        </p>
                        {clase.reemplazo?.cubro ? (
                          <p className="mt-1 text-sm text-xo-negro">
                            <span aria-hidden="true">✦ </span>
                            Cubres a {clase.reemplazo.cubro}
                          </p>
                        ) : null}
                        {clase.cancelada ? (
                          <p className="mt-1 text-sm text-xo-negro">
                            Cancelada
                            {clase.motivoCancelacion
                              ? ` · ${clase.motivoCancelacion}`
                              : ""}
                          </p>
                        ) : null}
                      </div>

                      <p className="xo-eyebrow whitespace-nowrap text-xo-gris">
                        {clase.inscritas}/{clase.cupoMaximo} inscritas
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {pasadas.length > 0 ? (
        <>
          <h2 className="xo-eyebrow mt-14 text-xo-gris">Los últimos días</h2>
          <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
            {pasadas.map((clase) => (
              <li key={clase.id}>
                <Link
                  href={`/profesora/clases/${clase.id}`}
                  className="flex flex-wrap justify-between gap-3 py-3 hover:underline"
                >
                  <span className="text-sm text-xo-gris">
                    {diaLegible(clase.inicio)} · {horaLegible(clase.inicio)} ·{" "}
                    {clase.cursoNombre}
                  </span>
                  <span className="text-sm text-xo-gris">
                    {clase.inscritas}/{clase.cupoMaximo}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </>
  );
}
