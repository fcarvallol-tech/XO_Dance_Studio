"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearRecuperativa } from "@/lib/acciones";
import { cuandoLegible } from "@/lib/compras";
import { hoyEnSantiago } from "@/lib/semana";
import type { ClasePorRecuperar, DatosRecuperativas } from "@/lib/recuperativas-consultas";

const CAMPO = "mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro";

/**
 * Ponerle fecha a la recuperación de una clase (PRD-0027).
 *
 * El cupo no se escribe: se muestra el de la sala elegida. Los choques —el mismo
 * día que otra clase del horario, la sala ocupada— los decide la base y llegan
 * acá en palabras, para que se corrija la fecha sin salir del diálogo.
 */
export function CrearRecuperativa({
  clase,
  sedes,
  profesoras,
}: {
  clase: ClasePorRecuperar;
  sedes: DatosRecuperativas["sedes"];
  profesoras: DatosRecuperativas["profesoras"];
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [sedeId, setSedeId] = useState(
    sedes.some((s) => s.id === clase.sedeId) ? clase.sedeId : (sedes[0]?.id ?? ""),
  );
  const [profesoraId, setProfesoraId] = useState(
    profesoras.some((p) => p.id === clase.profesoraId) ? clase.profesoraId : (profesoras[0]?.id ?? ""),
  );
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierto && !d.open) d.showModal();
    if (!abierto && d.open) d.close();
  }, [abierto]);

  const cupo = sedes.find((s) => s.id === sedeId)?.capacidad;
  const otraProfesora = profesoraId !== clase.profesoraId;
  const valido = fecha !== "" && hora !== "" && sedeId !== "" && profesoraId !== "";

  function crear() {
    setFallo(null);
    iniciar(async () => {
      const r = await crearRecuperativa({ originalId: clase.id, fecha, hora, sedeId, profesoraId });
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setAbierto(false);
      router.replace(`/admin/recuperativas?avisadas=${r.avisadas ?? 0}&total=${r.total ?? 0}`);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setFallo(null);
          setAbierto(true);
        }}
        className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/50"
      >
        Crear recuperativa
      </button>

      <dialog
        ref={dialogo}
        aria-labelledby={`recuperativa-${clase.id}`}
        onClose={() => setAbierto(false)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-left text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        <p className="xo-eyebrow text-xo-gris">Recupera la del {cuandoLegible(clase.inicio)}</p>
        <h2 id={`recuperativa-${clase.id}`} className="mt-2 font-display text-3xl leading-none text-xo-negro">
          {clase.curso}
        </h2>

        <div className="mt-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor={`fecha-${clase.id}`} className="xo-eyebrow text-xo-gris">
                Fecha
              </label>
              <input
                id={`fecha-${clase.id}`}
                type="date"
                min={hoyEnSantiago()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={CAMPO}
              />
            </div>
            <div>
              <label htmlFor={`hora-${clase.id}`} className="xo-eyebrow text-xo-gris">
                Hora
              </label>
              <input
                id={`hora-${clase.id}`}
                type="time"
                step={300}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={CAMPO}
              />
            </div>
          </div>
          <div>
            <label htmlFor={`sede-${clase.id}`} className="xo-eyebrow text-xo-gris">
              Sala
            </label>
            <select id={`sede-${clase.id}`} value={sedeId} onChange={(e) => setSedeId(e.target.value)} className={CAMPO}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nombre}
                </option>
              ))}
            </select>
            {cupo !== undefined ? (
              <p className="mt-2 text-sm text-xo-gris">{cupo} lugares, los de la sala.</p>
            ) : null}
          </div>
          <div>
            <label htmlFor={`profesora-${clase.id}`} className="xo-eyebrow text-xo-gris">
              Profesora
            </label>
            <select
              id={`profesora-${clase.id}`}
              value={profesoraId}
              onChange={(e) => setProfesoraId(e.target.value)}
              className={CAMPO}
            >
              {profesoras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {otraProfesora ? (
              <p className="mt-2 text-sm text-xo-gris">Se le paga a quien la dicte, no a {clase.profesora}.</p>
            ) : null}
          </div>
        </div>

        <p className="mt-5 text-sm leading-relaxed text-xo-gris">
          {clase.afectadas === 0
            ? "Nadie tenía reserva en esa clase, así que no sale ningún correo."
            : `Le llega un correo a ${clase.afectadas === 1 ? "la alumna que tenía" : `las ${clase.afectadas} alumnas que tenían`} reserva. No se reserva por ellas: tienen su clase de vuelta y reservan solas.`}
        </p>

        {clase.conCreditoVencido > 0 ? (
          <p className="mt-3 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
            {clase.conCreditoVencido === 1
              ? "A una de ellas ya se le venció la clase devuelta:"
              : `A ${clase.conCreditoVencido} de ellas ya se les venció la clase devuelta:`}{" "}
            no va a poder reservar si no se le regala una en Personas.
          </p>
        ) : null}

        {fallo ? (
          <p role="alert" className="mt-4 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
            {fallo}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!valido || enviando}
            onClick={crear}
            className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Creando…" : "Crear recuperativa"}
          </button>
          <button
            type="button"
            onClick={() => setAbierto(false)}
            className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro transition-colors hover:border-xo-negro/50"
          >
            Volver
          </button>
        </div>
      </dialog>
    </>
  );
}
