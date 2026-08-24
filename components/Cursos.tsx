import { BotonInscripcion } from "./BotonInscripcion";
import { Reveal } from "./Reveal";
import { CURSOS_ACTIVOS, type Curso } from "@/lib/cursos";
import { nombresDe } from "@/lib/profesoras";
import { POR_CONFIRMAR } from "@/lib/tipos";

export function Cursos() {
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
          Todos parten en septiembre. Los horarios y los valores te los
          contamos por WhatsApp.
        </p>

        <ul className="mt-14 grid gap-px overflow-hidden rounded-lg bg-xo-blanco/15 sm:grid-cols-2">
          {CURSOS_ACTIVOS.map((curso) => (
            <li key={curso.id} className="bg-xo-negro-alt">
              <Tarjeta curso={curso} />
            </li>
          ))}
          {/* Con un número impar de cursos en dos columnas, el hueco final
              deja ver el color de los divisores. La celda lo tapa. El
              catálogo ya cambió una vez, así que se calcula, no se asume. */}
          {CURSOS_ACTIVOS.length % 2 === 1 ? (
            <li aria-hidden="true" className="hidden bg-xo-negro-alt sm:block" />
          ) : null}
        </ul>
      </Reveal>
    </section>
  );
}

function Tarjeta({ curso }: { curso: Curso }) {
  const profesoras = nombresDe(curso.profesoras);

  return (
    <article className="flex h-full flex-col p-7 sm:p-9">
      <p className="xo-eyebrow text-xo-rosa-claro">{curso.publico}</p>

      <h3 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.25rem)] leading-none text-xo-rosa">
        {curso.nombre}
      </h3>

      <p className="mt-5 leading-relaxed text-xo-blanco/80">
        {curso.descripcion}
      </p>

      {curso.formato ? (
        <p className="mt-6 border-l-2 border-xo-rosa/60 pl-4 font-serif-xo text-lg italic leading-snug text-xo-rosa-claro">
          {curso.formato}
        </p>
      ) : null}

      <dl className="mt-8 space-y-3 border-t border-xo-blanco/15 pt-6 text-sm">
        <Dato etiqueta="Estilo" valor={curso.estilo} />
        <Dato etiqueta="Profes" valor={profesoras.join(", ")} />
        <Dato etiqueta="Horario" valor={curso.horario} />
        <Dato etiqueta="Valor" valor={curso.precio} />
        <Dato
          etiqueta="Cupos"
          valor={curso.cupos === null ? null : `${curso.cupos} disponibles`}
        />
      </dl>

      <div className="mt-8 pt-2">
        <BotonInscripcion
          origen="tarjeta-curso"
          cursoId={curso.id}
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
