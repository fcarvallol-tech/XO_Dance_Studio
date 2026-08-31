import { BotonInscripcion } from "./BotonInscripcion";
import { Reveal } from "./Reveal";
import {
  cuando,
  horariosDeCurso,
  nombreDe,
  profesorasDeCurso,
  type Curso,
  type Horario,
  type Profesora,
  type Sede,
} from "@/lib/catalogo";
import { POR_CONFIRMAR } from "@/lib/tipos";

/** Cómo se dice cada dificultad en pantalla. */
const NIVEL = {
  principiante: "Principiante",
  intermedio: "Intermedio",
  avanzado: "Avanzado",
} as const;

export function Cursos({
  cursos,
  profesoras,
  sedes,
  horarios,
}: {
  cursos: Curso[];
  profesoras: Profesora[];
  sedes: Sede[];
  horarios: Horario[];
}) {
  return (
    <section
      id="cursos"
      className="xo-grain relative scroll-mt-20 border-t border-xo-blanco/10 px-6 py-24 sm:px-10 sm:py-32"
    >
      <Reveal className="relative mx-auto max-w-6xl">
        <p className="xo-eyebrow text-xo-rosa">Los cursos</p>
        <h2 className="mt-4 max-w-2xl font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
          Elige dónde quieres partir
        </h2>
        <p className="mt-5 max-w-md text-xo-blanco/70">
          Cada uno con sus horarios y su sala. El valor no depende del curso:
          compras clases y las usas donde quieras, y eso está en{" "}
          <a
            href="#planes"
            className="text-xo-rosa underline-offset-4 hover:underline"
          >
            los planes
          </a>
          .
        </p>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-lg bg-xo-blanco/15 sm:grid-cols-2">
          {cursos.map((curso) => (
            <li key={curso.slug} className="bg-xo-negro-alt">
              <Tarjeta
                curso={curso}
                profesoras={profesoras}
                sedes={sedes}
                horarios={horarios}
              />
            </li>
          ))}
          {/* Con un número impar de cursos en dos columnas, el hueco final
              deja ver el color de los divisores. La celda lo tapa. El
              catálogo ya cambió una vez, así que se calcula, no se asume. */}
          {cursos.length % 2 === 1 ? (
            <li aria-hidden="true" className="hidden bg-xo-negro-alt sm:block" />
          ) : null}
        </ul>
      </Reveal>
    </section>
  );
}

function Tarjeta({
  curso,
  profesoras,
  sedes,
  horarios,
}: {
  curso: Curso;
  profesoras: Profesora[];
  sedes: Sede[];
  horarios: Horario[];
}) {
  // Quién dicta el curso se deriva de los horarios: la tabla cursos_profesoras
  // se eliminó en PRD-0016 porque no tenía nada que horarios no tuviera.
  const nombres = profesorasDeCurso(horarios, profesoras, curso.slug).map(
    (p) => p.nombre,
  );
  const suyos = horariosDeCurso(horarios, curso.slug);

  return (
    <article className="flex h-full flex-col p-7 sm:p-9">
      <p className="xo-eyebrow text-xo-rosa-claro">{curso.publico}</p>

      <h3 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-none text-xo-rosa">
        {curso.nombre}
      </h3>

      <p className="mt-5 leading-relaxed text-xo-blanco/80">
        {curso.descripcion}
      </p>

      <dl className="mt-8 space-y-3 border-t border-xo-blanco/15 pt-6 text-sm">
        <Dato etiqueta="Estilo" valor={curso.estilo} />
        <Dato etiqueta="Nivel" valor={NIVEL[curso.dificultad]} />
        <Dato etiqueta="Profes" valor={nombres.join(", ")} />
        <Dato
          etiqueta="Cupos"
          valor={curso.cupos === null ? null : `${curso.cupos} disponibles`}
        />
      </dl>

      {/* Los horarios ya no caben en una línea: un curso tiene varios, y cada
          uno trae día, hora, profesora y sede. */}
      <div className="mt-6 border-t border-xo-blanco/15 pt-6">
        <p className="xo-eyebrow text-xo-blanco/45">Horarios</p>

        {suyos.length === 0 ? (
          <p className="mt-3 text-sm text-xo-blanco/40 italic">{POR_CONFIRMAR}</p>
        ) : (
          <ul className="mt-3 space-y-2.5">
            {suyos.map((horario) => (
              <li key={horario.id} className="text-sm leading-snug">
                <span className="text-xo-blanco/85">{cuando(horario)}</span>
                <span className="block text-xo-blanco/55">
                  {nombreDe(profesoras, horario.profesoraSlug)} ·{" "}
                  {nombreDe(sedes, horario.sedeSlug)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-8 pt-2">
        <BotonInscripcion
          origen="tarjeta-curso"
          cursoId={curso.slug}
          variante="borde"
        >
          Reservar clase
        </BotonInscripcion>
      </div>
    </article>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  const pendiente = !valor;

  return (
    <div className="flex justify-between gap-6">
      <dt className="xo-eyebrow shrink-0 pt-1 text-xo-blanco/45">{etiqueta}</dt>
      <dd
        className={`text-right ${
          pendiente ? "text-xo-blanco/40 italic" : "text-xo-blanco/85"
        }`}
      >
        {valor ?? POR_CONFIRMAR}
      </dd>
    </div>
  );
}
