"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { crearRecuperativa } from "@/lib/acciones";
import { cuandoLegible } from "@/lib/compras";
import { hoyEnSantiago } from "@/lib/semana";
import { SelectorSala } from "@/components/SelectorSala";
import type { OpcionesEspecial, SalaElegible } from "@/lib/especiales-admin";
import type { ClasePorRecuperar } from "@/lib/recuperativas-consultas";

const ENTRADA = "w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro";

/**
 * La categoría "Recuperativa" de la pantalla de crear clases (PRD-0027).
 *
 * Sin campos de marketing: curso, duración y horario vienen de la clase caída.
 * El cupo no se escribe. Los choques los decide la base y llegan en palabras,
 * para corregir la fecha sin salir de acá.
 */
export function FormularioRecuperativa({
  porRecuperar,
  opciones,
  claseInicial,
}: {
  porRecuperar: ClasePorRecuperar[];
  opciones: OpcionesEspecial;
  claseInicial: string | undefined;
}) {
  const router = useRouter();
  const [salas, setSalas] = useState<SalaElegible[]>(opciones.sedes);
  const [claseId, setClaseId] = useState(
    porRecuperar.some((c) => c.id === claseInicial) ? (claseInicial as string) : "",
  );
  const clase = porRecuperar.find((c) => c.id === claseId) ?? null;
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [sedeId, setSedeId] = useState(salaDe(clase, opciones.sedes));
  const [profesoraId, setProfesoraId] = useState(profesoraDe(clase, opciones.profesoras));
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const sala = salas.find((s) => s.id === sedeId);
  const otraProfesora = clase !== null && profesoraId !== "" && profesoraId !== clase.profesoraId;
  const valido = clase !== null && fecha !== "" && hora !== "" && sedeId !== "" && profesoraId !== "";

  function elegirClase(id: string) {
    const nueva = porRecuperar.find((c) => c.id === id) ?? null;
    setClaseId(id);
    setSedeId(salaDe(nueva, salas));
    setProfesoraId(profesoraDe(nueva, opciones.profesoras));
    setFallo(null);
  }

  function crear() {
    if (!clase) return;
    setFallo(null);
    iniciar(async () => {
      const r = await crearRecuperativa({ originalId: clase.id, fecha, hora, sedeId, profesoraId });
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      router.replace(`/admin/recuperativas?avisadas=${r.avisadas ?? 0}&total=${r.total ?? 0}`);
    });
  }

  if (porRecuperar.length === 0) {
    return <p className="text-xo-gris">No hay ninguna clase no dictada por recuperar.</p>;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <label htmlFor="original" className="xo-eyebrow text-xo-gris">
          Qué clase recupera *
        </label>
        <select
          id="original"
          value={claseId}
          onChange={(e) => elegirClase(e.target.value)}
          className={`mt-2 ${ENTRADA}`}
        >
          <option value="">Elige</option>
          {porRecuperar.map((c) => (
            <option key={c.id} value={c.id}>
              {c.curso} · {cuandoLegible(c.inicio)} · {c.profesora}
            </option>
          ))}
        </select>
      </div>

      {clase ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="fecha" className="xo-eyebrow text-xo-gris">
                Fecha *
              </label>
              <input
                id="fecha"
                type="date"
                min={hoyEnSantiago()}
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={`mt-2 ${ENTRADA}`}
              />
            </div>
            <div>
              <label htmlFor="hora" className="xo-eyebrow text-xo-gris">
                Hora *
              </label>
              <input
                id="hora"
                type="time"
                step={300}
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className={`mt-2 ${ENTRADA}`}
              />
            </div>
          </div>

          <div>
            <p className="xo-eyebrow mb-2 text-xo-gris">Sala *</p>
            <SelectorSala
              salas={salas}
              valor={sedeId}
              duracionMin={clase.duracionMin}
              onCambio={setSedeId}
              onSalaNueva={(nueva) => {
                setSalas((antes) => (antes.some((s) => s.id === nueva.id) ? antes : [...antes, nueva]));
                setSedeId(nueva.id);
              }}
            />
            {sala ? <p className="mt-2 text-sm text-xo-gris">{sala.capacidad} lugares, los de la sala.</p> : null}
          </div>

          <div>
            <label htmlFor="profesora" className="xo-eyebrow text-xo-gris">
              Profesora *
            </label>
            <select
              id="profesora"
              value={profesoraId}
              onChange={(e) => setProfesoraId(e.target.value)}
              className={`mt-2 ${ENTRADA}`}
            >
              <option value="">Elige</option>
              {opciones.profesoras.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            {otraProfesora ? (
              <p className="mt-2 text-sm text-xo-gris">Se le paga a quien la dicte, no a {clase.profesora}.</p>
            ) : null}
          </div>

          <p className="text-sm leading-relaxed text-xo-gris">
            {clase.afectadas === 0
              ? "Nadie tenía reserva en esa clase, así que no sale ningún correo."
              : `Le llega un correo a ${clase.afectadas === 1 ? "la alumna que tenía" : `las ${clase.afectadas} alumnas que tenían`} reserva. No se reserva por ellas, y el cupo es por orden de llegada: cualquiera con crédito puede tomarla.`}
          </p>

          {clase.conCreditoVencido > 0 ? (
            <p className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
              {clase.conCreditoVencido === 1
                ? "A una de ellas ya se le venció la clase devuelta:"
                : `A ${clase.conCreditoVencido} de ellas ya se les venció la clase devuelta:`}{" "}
              no va a poder reservar si no se le regala una en Personas.
            </p>
          ) : null}

          {fallo ? (
            <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
              {fallo}
            </p>
          ) : null}

          <button
            type="button"
            disabled={!valido || enviando}
            onClick={crear}
            className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Creando…" : "Crear clase"}
          </button>
        </>
      ) : null}
    </div>
  );
}

function salaDe(clase: ClasePorRecuperar | null, salas: SalaElegible[]): string {
  return clase && salas.some((s) => s.id === clase.sedeId) ? clase.sedeId : "";
}

function profesoraDe(clase: ClasePorRecuperar | null, profesoras: { id: string }[]): string {
  return clase && profesoras.some((p) => p.id === clase.profesoraId) ? clase.profesoraId : "";
}
