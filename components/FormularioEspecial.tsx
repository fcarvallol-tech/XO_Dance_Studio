"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  borrarBorradorEspecial,
  crearEspecial,
  editarEspecial,
  publicarEspecial,
} from "@/lib/acciones";
import { codigoDeReel } from "@/lib/dominio/especiales";
import { clp } from "@/lib/planes";
import type { EspecialAdmin, OpcionesEspecial } from "@/lib/especiales-admin";

/**
 * Crear y editar una clase especial.
 *
 * **El precio solo lo fija owner.** A admin se le muestra el valor de arranque
 * y el campo va bloqueado; la regla vive en la base, no acá (PRD-0018 §8.6),
 * así que esto es cortesía visual y no la validación.
 *
 * La portada se sube después de guardar, porque el archivo se nombra con el id
 * de la clase. Es el orden real: se guarda el borrador, se le sube la foto, se
 * mira la vista previa y recién ahí se publica.
 */
export function FormularioEspecial({
  especial,
  opciones,
  esOwner,
}: {
  especial: EspecialAdmin | null;
  opciones: OpcionesEspecial;
  esOwner: boolean;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const [reel, setReel] = useState(
    especial?.reelCodigo ? `https://www.instagram.com/reel/${especial.reelCodigo}/` : "",
  );
  const [subiendo, setSubiendo] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  const reelValido = reel.trim() === "" || codigoDeReel(reel) !== null;
  const precio = especial?.precioClp ?? opciones.precioDefault;

  function guardar(datos: FormData) {
    setFallo(null);
    setAviso(null);
    iniciar(async () => {
      const resultado = especial
        ? await editarEspecial(datos)
        : await crearEspecial(datos);

      if (!resultado.ok) {
        setFallo(resultado.mensaje ?? "No se pudo guardar.");
        return;
      }
      if (!especial && "id" in resultado && resultado.id) {
        router.push(`/admin/especiales/${resultado.id}`);
        return;
      }
      setAviso("Guardado.");
      router.refresh();
    });
  }

  async function subirPortada() {
    const elegido = archivo.current?.files?.[0];
    if (!elegido || !especial) return;

    setSubiendo(true);
    setFallo(null);
    try {
      const cuerpo = new FormData();
      cuerpo.set("clase_id", especial.id);
      cuerpo.set("portada", elegido);
      const respuesta = await fetch("/api/especiales/portada", {
        method: "POST",
        body: cuerpo,
      });
      const datos = await respuesta.json();
      if (!respuesta.ok) {
        setFallo(datos.mensaje ?? "No se pudo subir la portada.");
        return;
      }
      setAviso("Portada subida.");
      router.refresh();
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <div className="max-w-3xl">
      {especial && especial.reservas > 0 ? (
        <p className="mb-8 border-l-2 border-xo-negro bg-xo-negro/5 py-3 pl-4 text-sm text-xo-negro">
          Esta clase tiene <strong>{especial.reservas}</strong>{" "}
          {especial.reservas === 1 ? "reserva" : "reservas"}. Si cambias la fecha
          o la hora, avísales por WhatsApp: el sistema todavía no manda ese aviso.
        </p>
      ) : null}

      <form action={guardar} className="space-y-8">
        {especial ? <input type="hidden" name="id" value={especial.id} /> : null}

        <Campo etiqueta="Título de la coreografía" requerido>
          <input
            name="titulo"
            required
            defaultValue={especial?.titulo ?? ""}
            className={ENTRADA}
          />
        </Campo>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo etiqueta="Canción y artista">
            <input name="cancion" defaultValue={especial?.cancion ?? ""} className={ENTRADA} />
          </Campo>

          <Campo etiqueta="Dificultad">
            <select
              name="dificultad"
              defaultValue={especial?.dificultad ?? "intermedio"}
              className={ENTRADA}
            >
              <option value="principiante">Principiante</option>
              <option value="intermedio">Intermedio</option>
              <option value="avanzado">Avanzado</option>
            </select>
          </Campo>
        </div>

        <Campo etiqueta="Descripción corta">
          <textarea
            name="descripcion"
            rows={3}
            defaultValue={especial?.descripcion ?? ""}
            className={ENTRADA}
          />
        </Campo>

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo etiqueta="Estilo" requerido>
            <select
              name="curso_id"
              required
              defaultValue={especial?.cursoId ?? ""}
              className={ENTRADA}
            >
              <option value="">Elige</option>
              {opciones.cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Profesora" requerido>
            <select
              name="profesora_id"
              required
              defaultValue={especial?.profesoraId ?? ""}
              className={ENTRADA}
            >
              <option value="">Elige</option>
              {opciones.profesoras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>

          <Campo etiqueta="Sede" requerido>
            <select name="sede_id" required defaultValue={especial?.sedeId ?? ""} className={ENTRADA}>
              <option value="">Elige</option>
              {opciones.sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
          </Campo>
        </div>

        <div className="grid gap-6 sm:grid-cols-3">
          <Campo etiqueta="Día y hora" requerido>
            <input
              type="datetime-local"
              name="inicio"
              required
              defaultValue={especial ? paraCampoLocal(especial.inicio) : ""}
              className={ENTRADA}
            />
          </Campo>

          <Campo etiqueta="Duración (minutos)">
            <input
              type="number"
              name="duracion_min"
              min={30}
              max={180}
              step={15}
              defaultValue={especial?.duracionMin ?? 60}
              className={ENTRADA}
            />
          </Campo>

          <Campo etiqueta="Cupo">
            <input
              type="number"
              name="cupo_maximo"
              min={1}
              max={22}
              defaultValue={especial?.cupoMaximo ?? 22}
              className={ENTRADA}
            />
          </Campo>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <Campo etiqueta="Precio">
            <input
              type="number"
              name="precio_clp"
              min={0}
              step={500}
              defaultValue={precio ?? ""}
              disabled={!esOwner}
              className={`${ENTRADA} ${esOwner ? "" : "bg-xo-negro/5 text-xo-gris"}`}
            />
            <p className="mt-2 text-sm text-xo-gris">
              {esOwner ? (
                opciones.precioDefault !== null ? (
                  <>
                    Nace en {clp(opciones.precioDefault)} y lo cambias en cada
                    clase. Ese valor de arranque se edita en parámetros.
                  </>
                ) : (
                  <>Nadie cargó el valor de arranque; escribe el precio de esta clase.</>
                )
              ) : opciones.precioDefault !== null ? (
                <>
                  Lo fija owner. Esta clase va con el valor de arranque,{" "}
                  {clp(opciones.precioDefault)}.
                </>
              ) : (
                <>
                  Falta el valor de arranque en parámetros y solo owner puede
                  escribir un precio: pídeselo antes de guardar.
                </>
              )}
            </p>
          </Campo>

          <Campo etiqueta="Mínimo de alumnas (informativo)">
            <input
              type="number"
              name="minimo_alumnas"
              min={0}
              max={22}
              defaultValue={especial?.minimoAlumnas ?? ""}
              className={ENTRADA}
            />
            <p className="mt-2 text-sm text-xo-gris">
              Desde cuántas alumnas la profesora iguala una clase normal se
              calcula con el costo de sala y el sueldo base, que todavía no
              están en la base (PRD-0009 §8.3). No se muestra un número
              inventado.
            </p>
          </Campo>
        </div>

        <Campo etiqueta="Link del Reel">
          <input
            name="reel_url"
            value={reel}
            onChange={(e) => setReel(e.target.value)}
            placeholder="https://www.instagram.com/reel/…"
            className={ENTRADA}
          />
          {!reelValido ? (
            <p className="mt-2 text-sm text-xo-negro">
              Eso no es un Reel ni un post de Instagram. Se acepta
              instagram.com/reel/… o instagram.com/p/…
            </p>
          ) : null}
        </Campo>

        <label className="flex max-w-xl items-start gap-3 text-sm text-xo-negro">
          <input type="checkbox" required className="mt-1" />
          <span>
            En el Reel aparece solo la profesora, o hay autorización firmada de
            quien más aparezca. Si hay menores identificables, la autorización
            existe.
          </span>
        </label>

        {fallo ? (
          <p role="alert" className="border-l-2 border-xo-negro py-2 pl-4 text-xo-negro">
            {fallo}
          </p>
        ) : null}
        {aviso ? (
          <p role="status" className="text-sm text-xo-gris">
            {aviso}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={enviando || !reelValido}
          className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {enviando ? "Guardando…" : especial ? "Guardar cambios" : "Guardar borrador"}
        </button>
      </form>

      {especial ? (
        <section className="mt-14 border-t border-xo-negro/10 pt-10">
          <h2 className="xo-eyebrow text-xo-gris">Portada</h2>
          <p className="mt-3 max-w-xl leading-relaxed text-xo-gris">
            Es lo que se ve antes de tocar el Reel y lo que sale al compartir el
            link por WhatsApp. Obligatoria para publicar. jpg o webp, hasta 1 MB,
            vertical 4:5.
          </p>

          <div className="mt-6 flex flex-wrap items-start gap-8">
            {especial.portadaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={especial.portadaUrl}
                alt="Portada de la clase"
                className="w-40 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-50 w-40 items-center justify-center rounded-lg border border-dashed border-xo-negro/30 text-sm text-xo-gris">
                Sin portada
              </div>
            )}

            <div>
              <input
                ref={archivo}
                type="file"
                accept="image/jpeg,image/webp"
                className="block text-sm text-xo-gris"
              />
              <button
                type="button"
                onClick={subirPortada}
                disabled={subiendo}
                className="xo-eyebrow mt-4 rounded-full border border-xo-negro px-5 py-3 text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-40"
              >
                {subiendo ? "Subiendo…" : "Subir portada"}
              </button>
            </div>
          </div>

          <h2 className="xo-eyebrow mt-12 text-xo-gris">Publicar</h2>
          {especial.publicada ? (
            <p className="mt-3 text-xo-negro">
              Publicada. Se ve en{" "}
              <a
                href={`/clases-especiales/${especial.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-4"
              >
                /clases-especiales/{especial.slug}
              </a>
              .
            </p>
          ) : (
            <>
              <p className="mt-3 max-w-xl leading-relaxed text-xo-gris">
                Publicar exige Reel, portada, profesora, sede y fecha futura. Si
                falta algo, la base lo dice al apretar.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await publicarEspecial(especial.id);
                      if (!r.ok) setFallo(r.mensaje ?? "No se pudo publicar.");
                      else router.refresh();
                    })
                  }
                  className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-40"
                >
                  Publicar
                </button>

                <button
                  type="button"
                  disabled={enviando}
                  onClick={() =>
                    iniciar(async () => {
                      const r = await borrarBorradorEspecial(especial.id);
                      if (!r.ok) setFallo(r.mensaje ?? "No se pudo borrar.");
                      else router.push("/admin/especiales");
                    })
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro/30 px-6 py-3.5 text-xo-gris transition-colors hover:border-xo-negro hover:text-xo-negro disabled:opacity-40"
                >
                  Borrar borrador
                </button>
              </div>
            </>
          )}
        </section>
      ) : null}
    </div>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro focus:border-xo-negro focus:outline-none";

function Campo({
  etiqueta,
  requerido,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="xo-eyebrow text-xo-gris">
        {etiqueta}
        {requerido ? " *" : ""}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

/**
 * El valor del `datetime-local`: la hora **de Santiago**, no la del navegador
 * de quien edita. Si alguien abre el formulario desde otra zona, la hora que ve
 * tiene que seguir siendo la de la clase.
 */
function paraCampoLocal(iso: string): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const dato = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "";
  return `${dato("year")}-${dato("month")}-${dato("day")}T${dato("hour")}:${dato("minute")}`;
}
