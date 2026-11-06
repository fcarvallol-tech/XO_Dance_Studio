"use client";

import { useState, useTransition } from "react";
import { crearSalaOcasional } from "@/lib/acciones";
import { costoDeSalaEnClase, type SalaCreada } from "@/lib/dominio/salas";
import { clp } from "@/lib/planes";
import type { SalaElegible } from "@/lib/especiales-admin";

const ENTRADA = "w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro";
const OTRA = "__otra";

/**
 * Elegir una sala, o cargar una arrendada (PRD-0027 §7.5).
 *
 * La sala nueva es una fila de `sedes`, no un precio de la clase. La capacidad y
 * el precio son obligatorios, acá por cortesía y en la base de verdad. La base
 * compara por dirección: si coincide, no crea y acá se ofrece la que existe.
 *
 * El costo solo se ve mientras se escribe. Nunca se lee de la base.
 */
export function SelectorSala({
  salas,
  valor,
  duracionMin,
  onCambio,
  onSalaNueva,
}: {
  salas: SalaElegible[];
  valor: string;
  /** Para decir cuánto va a costar esa clase. `null` si todavía no se sabe. */
  duracionMin: number | null;
  onCambio: (id: string) => void;
  onSalaNueva: (sala: SalaElegible) => void;
}) {
  const [cargando, setCargando] = useState(false);
  const [nombre, setNombre] = useState("");
  const [direccion, setDireccion] = useState("");
  const [comuna, setComuna] = useState("");
  const [capacidad, setCapacidad] = useState("");
  const [costo, setCosto] = useState("");
  const [coincide, setCoincide] = useState<SalaCreada | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  const nCapacidad = Number(capacidad);
  const nCosto = Number(costo);
  const capacidadValida = capacidad !== "" && Number.isInteger(nCapacidad) && nCapacidad >= 1;
  const costoValido = costo !== "" && Number.isInteger(nCosto) && nCosto >= 0;
  const valida =
    nombre.trim() !== "" && direccion.trim() !== "" && comuna.trim() !== "" && capacidadValida && costoValido;

  function elegida(sala: SalaCreada) {
    onSalaNueva({
      id: sala.id,
      nombre: sala.nombre,
      comuna: sala.comuna,
      capacidad: sala.capacidad,
      ocasional: sala.ocasional,
    });
    setCargando(false);
    setCoincide(null);
  }

  function guardar(esOtra: boolean) {
    setFallo(null);
    iniciar(async () => {
      const r = await crearSalaOcasional({
        nombre: nombre.trim(),
        direccion: direccion.trim(),
        comuna: comuna.trim(),
        capacidad: nCapacidad,
        costoHoraClp: nCosto,
        esOtra,
      });
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      if (!r.sala) return;
      if (r.sala.creada) elegida(r.sala);
      else setCoincide(r.sala);
    });
  }

  return (
    <div>
      <select
        aria-label="Sala"
        value={cargando ? OTRA : valor}
        onChange={(e) => {
          const v = e.target.value;
          setCargando(v === OTRA);
          setCoincide(null);
          setFallo(null);
          onCambio(v === OTRA ? "" : v);
        }}
        className={ENTRADA}
      >
        <option value="">Elige</option>
        {salas.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
            {s.ocasional ? " (arrendada)" : ""}
          </option>
        ))}
        <option value={OTRA}>Otra sala…</option>
      </select>

      {cargando ? (
        <div className="mt-4 space-y-4 border-l-2 border-xo-negro/20 pl-4">
          <label className="block text-sm text-xo-negro">
            Nombre de la sala *
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} className={`mt-1 ${ENTRADA}`} />
          </label>
          <label className="block text-sm text-xo-negro">
            Dirección *
            <input
              value={direccion}
              onChange={(e) => {
                setDireccion(e.target.value);
                setCoincide(null);
              }}
              placeholder="Calle y número"
              className={`mt-1 ${ENTRADA}`}
            />
          </label>
          <label className="block text-sm text-xo-negro">
            Comuna *
            <input value={comuna} onChange={(e) => setComuna(e.target.value)} className={`mt-1 ${ENTRADA}`} />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm text-xo-negro">
              Capacidad *
              <input
                type="number"
                min={1}
                step={1}
                value={capacidad}
                onChange={(e) => setCapacidad(e.target.value)}
                className={`mt-1 ${ENTRADA}`}
              />
              <span className="mt-1 block text-xo-gris">De aquí sale el cupo de la clase.</span>
            </label>
            <label className="block text-sm text-xo-negro">
              Precio por hora *
              <input
                type="number"
                min={0}
                step={500}
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
                className={`mt-1 ${ENTRADA}`}
              />
              {costoValido && duracionMin ? (
                <span className="mt-1 block text-xo-gris">
                  Esta clase, de {duracionMin} minutos, costaría {clp(costoDeSalaEnClase(nCosto, duracionMin))}.
                </span>
              ) : null}
            </label>
          </div>

          {fallo ? (
            <p role="alert" className="border-l-2 border-xo-negro pl-3 text-sm text-xo-negro">
              {fallo}
            </p>
          ) : null}

          {coincide ? (
            <div role="status" className="border-l-2 border-xo-negro pl-3 text-sm text-xo-negro">
              <p>
                Esa dirección ya la tenemos: <strong>{coincide.nombre}</strong>, {coincide.direccion},{" "}
                {coincide.comuna}. {coincide.capacidad} lugares.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => elegida(coincide)}
                  className="xo-eyebrow rounded-full bg-xo-rosa px-4 py-2 text-xo-negro transition-opacity hover:opacity-80"
                >
                  Usar esa sala
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => guardar(true)}
                  className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-40"
                >
                  Es otra sala
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={!valida || enviando}
              onClick={() => guardar(false)}
              className="xo-eyebrow rounded-full border border-xo-negro px-4 py-2 text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-40"
            >
              {enviando ? "Guardando…" : "Guardar sala"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}
