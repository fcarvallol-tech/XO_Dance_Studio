import Link from "next/link";
import {
  hoyEnSantiago,
  nombreDelDia,
  numeroDelDia,
  rangoLegible,
  sumarDias,
} from "@/lib/semana";
import type { ClaseDeGrilla, DiaDeGrilla } from "@/lib/profesora-consultas";

/**
 * La semana completa de la academia, con los días como columnas.
 *
 * Muestra **todos** los horarios, no solo los suyos, y eso es deliberado: una
 * profesora que va a pedir un bloque necesita saber qué está ocupado y en qué
 * sede. Sin la parrilla completa pide a ciegas.
 *
 * ---
 *
 * **La jerarquía va por saturación, no por opacidad.** Las suyas llevan el rosa
 * de marca como fondo con texto negro —el patrón de botón primario que permite
 * `estilo.md`— y las ajenas se quedan sin color, no desvanecidas. Bajar la
 * opacidad sobre fondo claro degrada el texto justo cuando `BRAND.md` §6
 * advierte que no puede pasar: una clase ajena sigue siendo información y tiene
 * que leerse. Retrocede por no tener color, no por estar a medio borrar.
 *
 * De las ajenas se ve curso, hora, sede y profesora. **Nunca inscritas ni
 * conteo**, y no porque acá se oculten: `inscritas` llega `null` desde la
 * consulta porque RLS no devuelve reservas de clases ajenas.
 *
 * Es un componente de servidor: la navegación son enlaces, no estado.
 */
export function GrillaSemanal({
  lunes,
  dias,
  hayClases,
  limiteGeneracion,
}: {
  lunes: string;
  dias: DiaDeGrilla[];
  hayClases: boolean;
  /** Hasta qué día están materializadas las clases. Ver `generar_clases`. */
  limiteGeneracion: string;
}) {
  const hoy = hoyEnSantiago();
  const anterior = sumarDias(lunes, -7);
  const siguiente = sumarDias(lunes, 7);
  const masAlláDeLoGenerado = lunes > limiteGeneracion;

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h2 className="font-display text-2xl leading-none text-xo-negro">
          {rangoLegible(lunes)}
        </h2>

        <div className="flex items-center gap-2">
          <Flecha href={`?semana=${anterior}`} etiqueta="Semana anterior">
            ←
          </Flecha>
          <Link
            href="/profesora/mis-clases"
            className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/50"
          >
            Esta semana
          </Link>
          <Flecha href={`?semana=${siguiente}`} etiqueta="Semana siguiente">
            →
          </Flecha>
        </div>
      </div>

      {/* Siete columnas siempre, con scroll en móvil. Los días vacíos son
          información: si va a pedir un horario, el martes libre importa tanto
          como el lunes ocupado. */}
      <div className="overflow-x-auto">
        <div className="grid min-w-[52rem] grid-cols-7 gap-px bg-xo-negro/10">
          {dias.map(({ dia, clases }) => (
            <div key={dia} className="min-w-0 bg-xo-blanco">
              <div
                className={`px-3 py-2 ${
                  dia === hoy ? "bg-xo-negro/5" : ""
                }`}
              >
                <p className="xo-eyebrow text-xo-gris">{nombreDelDia(dia)}</p>
                <p
                  className={`mt-0.5 text-lg leading-none ${
                    dia === hoy ? "font-semibold text-xo-negro" : "text-xo-negro/70"
                  }`}
                >
                  {numeroDelDia(dia)}
                </p>
              </div>

              <div className="space-y-2 p-2">
                {clases.length === 0 ? (
                  <p className="px-1 py-3 text-xs text-xo-gris">Libre</p>
                ) : (
                  clases.map((clase) => <Bloque key={clase.id} clase={clase} />)
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {!hayClases ? (
        <p className="mt-6 text-xo-gris">
          {masAlláDeLoGenerado
            ? "Las clases de esta semana todavía no están generadas. Se materializan con unos días de anticipación."
            : "No hay clases esta semana."}
        </p>
      ) : null}
    </section>
  );
}

function Flecha({
  href,
  etiqueta,
  children,
}: {
  href: string;
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={etiqueta}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-xo-negro/20 text-xo-negro transition-colors hover:border-xo-negro/50"
    >
      <span aria-hidden="true">{children}</span>
    </Link>
  );
}

function Bloque({ clase }: { clase: ClaseDeGrilla }) {
  const contenido = (
    <>
      <p
        className={`text-sm font-semibold ${
          clase.cancelada ? "line-through" : ""
        } ${clase.mia ? "text-xo-negro" : "text-xo-negro"}`}
      >
        {clase.hora}
      </p>
      <p
        className={`mt-0.5 text-sm leading-snug ${
          clase.cancelada ? "line-through" : ""
        } ${clase.mia ? "text-xo-negro" : "text-xo-negro"}`}
      >
        {clase.cursoNombre}
      </p>
      <p
        className={`mt-1 text-xs leading-snug ${
          clase.mia ? "text-xo-negro/70" : "text-xo-gris"
        }`}
      >
        {/* En las suyas el nombre sobra: ya sabe que es ella. */}
        {clase.mia ? clase.sedeNombre : `${clase.profesoraNombre} · ${clase.sedeNombre}`}
      </p>

      {clase.cancelada ? (
        <p className="mt-1 text-xs font-medium text-xo-negro">Cancelada</p>
      ) : clase.inscritas !== null ? (
        <p className="mt-1 text-xs font-medium text-xo-negro">
          {clase.inscritas}/{clase.cupoMaximo}
        </p>
      ) : null}
    </>
  );

  // Las suyas llevan al detalle con la lista de inscritas. Las ajenas no van a
  // ninguna parte, y no deben parecer que sí: sin hover, sin cursor de mano.
  if (!clase.mia) {
    return (
      <div className="rounded-md border border-xo-negro/15 px-2.5 py-2">
        {contenido}
      </div>
    );
  }

  return (
    <Link
      href={`/profesora/clases/${clase.id}`}
      className={`block rounded-md px-2.5 py-2 transition-opacity hover:opacity-90 ${
        clase.cancelada ? "bg-xo-rosa/40" : "bg-xo-rosa"
      }`}
    >
      {contenido}
    </Link>
  );
}
