import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { CrearRecuperativa } from "@/components/CrearRecuperativa";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { NOMBRE_CAUSA } from "@/lib/dominio/liquidacion";
import { getRecuperativas } from "@/lib/recuperativas-consultas";

export const metadata: Metadata = {
  title: "Clases recuperativas — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Lo que devolvió crear: se lee de la URL porque la fila ya salió de la lista. */
function avisoDeCreacion(avisadas: string | undefined, total: string | undefined): string | null {
  const a = Number(avisadas);
  const t = Number(total);
  if (avisadas === undefined || total === undefined || !Number.isInteger(a) || !Number.isInteger(t)) {
    return null;
  }
  if (t < 0) return "La recuperativa quedó creada, pero no se pudo leer a quién avisarle. Revisa Correos.";
  if (t === 0) return "La recuperativa quedó creada. Nadie tenía reserva en esa clase, así que no salió ningún correo.";
  if (a === t) return `La recuperativa quedó creada. ${t === 1 ? "Le avisamos a la alumna" : `Les avisamos a las ${t} alumnas`} que tenían reserva.`;
  return `La recuperativa quedó creada. Salieron ${a} de ${t} correos; el resto queda en Correos y se reintenta.`;
}

/** Elegir una clase que no se dictó y ponerle fecha a su recuperación (PRD-0027). */
export default async function Recuperativas({
  searchParams,
}: {
  searchParams: Promise<{ avisadas?: string; total?: string }>;
}) {
  await requiereNivel("admin", "admin");
  const [{ avisadas, total }, lectura] = await Promise.all([searchParams, getRecuperativas()]);
  const { porRecuperar, programadas, sedes, profesoras } = lectura.datos;
  const aviso = avisoDeCreacion(avisadas, total);

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Clases recuperativas"
        bajada="Una clase que no se dictó se recupera. Es una clase normal, con créditos, que sale en el calendario marcada como recuperativa. A las que tenían reserva les llega un correo y reservan solas."
      />

      {aviso ? (
        <p role="status" className="mb-8 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {aviso}
        </p>
      ) : null}

      <ErrorDeLectura que="las clases por recuperar" error={lectura.error} />

      {lectura.error ? null : (
        <>
          <h2 className="font-display text-3xl leading-none text-xo-negro">Por recuperar</h2>
          {porRecuperar.length === 0 ? (
            <p className="mt-4 text-xo-gris">No hay ninguna clase caída por recuperar.</p>
          ) : (
            <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
              {porRecuperar.map((clase) => (
                <li key={clase.id} className="flex flex-wrap items-center justify-between gap-4 py-4">
                  <div>
                    <p className="font-semibold text-xo-negro">{clase.curso}</p>
                    <p className="mt-1 text-sm text-xo-gris">
                      {cuandoLegible(clase.inicio)} · {clase.profesora} · {clase.sede}
                    </p>
                    <p className="mt-1 text-sm text-xo-gris">
                      {clase.causa ? NOMBRE_CAUSA[clase.causa] : "Sin causa registrada"} ·{" "}
                      {clase.afectadas === 1 ? "1 alumna con reserva" : `${clase.afectadas} alumnas con reserva`}
                    </p>
                  </div>
                  <CrearRecuperativa clase={clase} sedes={sedes} profesoras={profesoras} />
                </li>
              ))}
            </ul>
          )}

          <h2 className="mt-12 font-display text-3xl leading-none text-xo-negro">Programadas</h2>
          {programadas.length === 0 ? (
            <p className="mt-4 text-xo-gris">Todavía no hay ninguna.</p>
          ) : (
            <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
              {programadas.map((r) => (
                <li key={r.id} className="py-4">
                  <p className="font-semibold text-xo-negro">{r.curso}</p>
                  <p className="mt-1 text-sm text-xo-gris">
                    {cuandoLegible(r.inicio)} · {r.profesora} · {r.sede} · {r.cupoMaximo} lugares
                  </p>
                  {r.originalInicio ? (
                    <p className="mt-1 text-sm text-xo-gris">Recupera la del {cuandoLegible(r.originalInicio)}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  );
}
