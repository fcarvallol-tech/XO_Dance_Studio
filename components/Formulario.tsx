"use client";

import { useState } from "react";
import { Reveal } from "./Reveal";
import { useSeleccion } from "./Seleccion";
import { porSlug, type Curso, type Profesora } from "@/lib/catalogo";
import {
  EDAD_MAXIMA,
  EDAD_MINIMA,
  validarLead,
  type ErroresLead,
  type ParaQuien,
} from "@/lib/lead";

type Estado = "reposo" | "enviando" | "listo";

export function Formulario({
  cursos,
  profesoras,
}: {
  cursos: Curso[];
  profesoras: Profesora[];
}) {
  const { seleccion, setProfesoraId } = useSeleccion();

  const [nombre, setNombre] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [paraQuien, setParaQuien] = useState<ParaQuien>("propio");
  const [edadAlumna, setEdadAlumna] = useState("");
  const [errores, setErrores] = useState<ErroresLead>({});
  const [fallo, setFallo] = useState<string | null>(null);
  const [estado, setEstado] = useState<Estado>("reposo");

  // La profe viene preseleccionada si entró desde una ficha del lineup, desde
  // un perfil público o con ?profesora= en la URL. El curso solo viene cuando
  // el click salió de una tarjeta de curso: es contexto, no la pregunta.
  const profesoraId = seleccion.profesoraId;
  const cursoId = seleccion.cursoId;

  const profesora = porSlug(profesoras, profesoraId);
  // Las listas llegan del catálogo público, que solo trae lo activo: la
  // pantalla no puede nombrar un curso que la base después va a rechazar.
  const curso = porSlug(cursos, cursoId);

  // Volver al formulario desde otra tarjeta lo reabre en blanco, no en la
  // confirmación de la inscripción anterior. Ajustar el estado durante el
  // render es el patrón de React para esto; un efecto haría un render de más.
  const [seleccionPrevia, setSeleccionPrevia] = useState(seleccion);
  if (seleccion !== seleccionPrevia) {
    setSeleccionPrevia(seleccion);
    if (estado === "listo") setEstado("reposo");
  }

  async function enviar(evento: React.FormEvent) {
    evento.preventDefault();
    setFallo(null);

    const entrada = {
      nombre,
      whatsapp,
      paraQuien,
      edadAlumna: paraQuien === "hija" ? Number(edadAlumna) : null,
      cursoId,
      profesoraId,
      origen: seleccion.origen,
    };

    const validacion = validarLead(entrada);
    if (!validacion.ok) {
      setErrores(validacion.errores);
      return;
    }
    setErrores({});
    setEstado("enviando");

    try {
      const respuesta = await fetch("/api/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });

      if (!respuesta.ok) {
        const cuerpo = await respuesta.json().catch(() => null);
        setErrores(cuerpo?.errores ?? {});
        setFallo(
          cuerpo?.mensaje ??
            "No pudimos guardar tus datos. Revisa los campos y prueba de nuevo.",
        );
        setEstado("reposo");
        return;
      }

      setEstado("listo");
    } catch {
      setFallo(
        "Se cortó la conexión antes de guardar tus datos. Prueba de nuevo en un momento.",
      );
      setEstado("reposo");
    }
  }

  if (estado === "listo") {
    return (
      <SeccionFormulario>
        <Confirmacion
          nombre={nombre}
          profesora={profesora?.nombre}
          onVolver={() => setEstado("reposo")}
        />
      </SeccionFormulario>
    );
  }

  return (
    <SeccionFormulario>
      <p className="xo-eyebrow text-xo-rosa">Reservar clase</p>
      <h2 className="mt-4 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
        Elige con quién quieres bailar
      </h2>
      <p className="mt-5 text-xo-blanco/70">
        Cuatro datos y listo. Los horarios, las salas y los valores ya están más
        arriba: esto es para que sepamos que vienes y te avisemos cuando se
        abran las inscripciones.
      </p>

      <form onSubmit={enviar} noValidate className="mt-10 space-y-7">
        <Campo
          id="nombre"
          etiqueta="¿Cómo te llamas?"
          error={errores.nombre}
        >
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            aria-invalid={Boolean(errores.nombre)}
            aria-describedby={errores.nombre ? "error-nombre" : undefined}
            className={claseInput(Boolean(errores.nombre))}
          />
        </Campo>

        <Campo
          id="whatsapp"
          etiqueta="Tu WhatsApp"
          error={errores.whatsapp}
        >
          {/* El anillo de foco va en la caja completa: el input interno lleva
              outline-none para no dibujar un segundo anillo adentro. */}
          <div
            className={`flex items-stretch overflow-hidden focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-xo-rosa ${claseInput(
              Boolean(errores.whatsapp),
              true,
            )}`}
          >
            <span
              aria-hidden="true"
              className="flex shrink-0 items-center border-r border-xo-blanco/20 px-4 whitespace-nowrap text-xo-blanco/55"
            >
              +56 9
            </span>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              maxLength={8}
              placeholder="8436 2290"
              value={whatsapp}
              onChange={(evento) =>
                setWhatsapp(evento.target.value.replace(/\D/g, "").slice(0, 8))
              }
              aria-invalid={Boolean(errores.whatsapp)}
              aria-describedby={errores.whatsapp ? "error-whatsapp" : undefined}
              className="w-full bg-transparent px-4 py-3 text-xo-blanco placeholder:text-xo-blanco/30 focus:outline-none"
            />
          </div>
        </Campo>

        <fieldset>
          <legend className="xo-eyebrow text-xo-blanco/55">
            ¿Para quién es la clase?
          </legend>
          <div className="mt-3 flex gap-3">
            <Opcion
              nombre="paraQuien"
              valor="propio"
              actual={paraQuien}
              onChange={setParaQuien}
            >
              Para mí
            </Opcion>
            <Opcion
              nombre="paraQuien"
              valor="hija"
              actual={paraQuien}
              onChange={setParaQuien}
            >
              Para mi hija
            </Opcion>
          </div>
        </fieldset>

        {paraQuien === "hija" ? (
          <Campo
            id="edadAlumna"
            etiqueta="¿Qué edad tiene?"
            error={errores.edadAlumna}
          >
            <input
              id="edadAlumna"
              name="edadAlumna"
              type="number"
              inputMode="numeric"
              min={EDAD_MINIMA}
              max={EDAD_MAXIMA}
              value={edadAlumna}
              onChange={(evento) => setEdadAlumna(evento.target.value)}
              aria-invalid={Boolean(errores.edadAlumna)}
              aria-describedby={
                errores.edadAlumna ? "error-edadAlumna" : undefined
              }
              className={`${claseInput(Boolean(errores.edadAlumna))} max-w-28`}
            />
          </Campo>
        ) : null}

        <Campo
          id="profesoraId"
          etiqueta="¿Con quién quieres tomar clases?"
          error={errores.profesoraId}
        >
          <select
            id="profesoraId"
            name="profesoraId"
            value={profesoraId ?? ""}
            onChange={(evento) =>
              setProfesoraId(
                evento.target.value
                  ? (evento.target.value as typeof profesoraId)
                  : null,
              )
            }
            aria-invalid={Boolean(errores.profesoraId)}
            aria-describedby={
              errores.profesoraId ? "error-profesoraId" : undefined
            }
            className={claseInput(Boolean(errores.profesoraId))}
          >
            <option value="">Elige una profe</option>
            {profesoras.map((opcion) => (
              <option key={opcion.slug} value={opcion.slug}>
                {opcion.nombre} — {opcion.estilo}
              </option>
            ))}
          </select>
        </Campo>

        {curso ? (
          <p className="text-sm text-xo-rosa-claro">
            <span aria-hidden="true">✦ </span>
            Viniste desde {curso.nombre}. Se lo contamos a la profe cuando te
            escribamos.
          </p>
        ) : null}

        {fallo ? (
          <p
            role="alert"
            className="border-l-2 border-xo-rosa pl-4 text-sm leading-relaxed text-xo-rosa"
          >
            {fallo}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={estado === "enviando"}
          className="xo-eyebrow w-full rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-colors hover:bg-xo-rosa-claro disabled:cursor-not-allowed disabled:bg-xo-rosa/40 sm:w-auto"
        >
          {estado === "enviando"
            ? "Guardando tus datos…"
            : "Enviar y abrir WhatsApp"}
        </button>
      </form>
    </SeccionFormulario>
  );
}

function SeccionFormulario({ children }: { children: React.ReactNode }) {
  return (
    <section
      id="inscripcion"
      className="xo-grain relative scroll-mt-20 border-t border-xo-blanco/10 px-6 py-24 sm:px-10 sm:py-32"
    >
      <Reveal className="relative mx-auto max-w-xl">{children}</Reveal>
    </section>
  );
}

/**
 * PRD-0016 le sacó el salto a WhatsApp. Antes esta pantalla abría una pestaña a
 * `wa.me` con un mensaje precargado; ahora el lead se guarda y se confirma acá
 * mismo.
 *
 * Se fue con eso la pestaña que había que abrir **antes** del `await` para que
 * el navegador no la bloqueara, y el problema que CONTEXT.md §10 registró: en
 * escritorio sin sesión, `wa.me` manda a un código QR.
 *
 * El copy no promete una coordinación automática, porque hasta que exista la
 * compra en línea (PRD-0005) la respuesta la escribe una persona a mano.
 */
function Confirmacion({
  nombre,
  profesora,
  onVolver,
}: {
  nombre: string;
  profesora?: string;
  onVolver: () => void;
}) {
  return (
    <div role="status">
      <p className="xo-eyebrow text-xo-rosa">
        <span aria-hidden="true">✦ </span>Listo
      </p>
      <h2 className="mt-4 font-display text-[clamp(2.25rem,6vw,3.5rem)] leading-[0.95] text-xo-blanco">
        Quedaste anotada, {nombre.split(" ")[0]}
      </h2>
      <p className="mt-5 leading-relaxed text-xo-blanco/80">
        Le vamos a contar a {profesora ?? "la profe"} que preguntaste por ella.
        Te escribimos para decirte cómo inscribirte.
      </p>
      <p className="mt-3 leading-relaxed text-xo-blanco/60">
        Mientras tanto, los horarios y las salas están más arriba en esta misma
        página.
      </p>

      <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
        <button
          type="button"
          onClick={onVolver}
          className="xo-eyebrow text-xo-rosa underline-offset-4 hover:underline"
        >
          Anotar a alguien más
        </button>
      </div>
    </div>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="xo-eyebrow block text-xo-blanco/55">
        {etiqueta}
      </label>
      <div className="mt-3">{children}</div>
      {error ? (
        <p id={`error-${id}`} className="mt-2 text-sm text-xo-rosa">
          <span aria-hidden="true">✦ </span>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function Opcion({
  nombre,
  valor,
  actual,
  onChange,
  children,
}: {
  nombre: string;
  valor: ParaQuien;
  actual: ParaQuien;
  onChange: (valor: ParaQuien) => void;
  children: React.ReactNode;
}) {
  const activa = actual === valor;

  return (
    <label
      className={`cursor-pointer rounded-full border px-5 py-2.5 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-xo-rosa ${
        activa
          ? "border-xo-rosa bg-xo-rosa text-xo-negro"
          : "border-xo-blanco/20 text-xo-blanco/75 hover:border-xo-blanco/45"
      }`}
    >
      <input
        type="radio"
        name={nombre}
        value={valor}
        checked={activa}
        onChange={() => onChange(valor)}
        className="sr-only"
      />
      {children}
    </label>
  );
}

function claseInput(conError: boolean, soloCaja = false): string {
  const base = `w-full rounded-md border bg-xo-negro-alt ${
    conError ? "border-xo-rosa" : "border-xo-blanco/20"
  }`;
  return soloCaja ? base : `${base} px-4 py-3 text-xo-blanco`;
}
