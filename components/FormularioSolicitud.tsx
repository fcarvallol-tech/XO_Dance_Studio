"use client";

import { useState, useTransition } from "react";
import { pedirHorario } from "@/lib/acciones";
import { nombreDia } from "@/lib/catalogo";
import type { Curso, Sede } from "@/lib/catalogo";

/**
 * Pedir un bloque nuevo.
 *
 * Deja proponer un curso del catálogo **o** uno que todavía no existe: una
 * profesora que quiere abrir un estilo nuevo es exactamente el caso que este
 * formulario tiene que permitir, no bloquear.
 */
export function FormularioSolicitud({
  cursos,
  sedes,
}: {
  cursos: Curso[];
  sedes: Sede[];
}) {
  const [nuevo, setNuevo] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();

  if (listo) {
    return (
      <div role="status" className="max-w-xl border-l-2 border-xo-negro pl-5">
        <p className="text-lg text-xo-negro">Pedido enviado.</p>
        <p className="mt-2 leading-relaxed text-xo-gris">
          Administración lo revisa y te responde acá mismo. Vas a ver la
          respuesta abajo, en tus pedidos.
        </p>
        <button
          type="button"
          onClick={() => setListo(false)}
          className="xo-eyebrow mt-6 text-xo-negro underline underline-offset-4"
        >
          Pedir otro horario
        </button>
      </div>
    );
  }

  return (
    <form
      className="max-w-xl space-y-5"
      action={(datos) => {
        setFallo(null);
        iniciar(async () => {
          const resultado = await pedirHorario(datos);
          if (resultado.ok) setListo(true);
          else setFallo(resultado.mensaje);
        });
      }}
    >
      <div className="flex flex-wrap gap-4">
        <div className="flex-1">
          <label htmlFor="dia" className="xo-eyebrow text-xo-gris">
            Día
          </label>
          <select
            id="dia"
            name="dia"
            defaultValue="1"
            className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
          >
            {[1, 2, 3, 4, 5, 6, 7].map((dia) => (
              <option key={dia} value={dia}>
                {nombreDia(dia)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex-1">
          <label htmlFor="hora" className="xo-eyebrow text-xo-gris">
            Hora
          </label>
          <input
            id="hora"
            name="hora"
            type="time"
            defaultValue="20:00"
            className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
          />
        </div>
      </div>

      <div>
        <label htmlFor="curso" className="xo-eyebrow text-xo-gris">
          Curso
        </label>
        {nuevo ? (
          <input
            id="propuesto"
            name="propuesto"
            type="text"
            placeholder="El estilo que quieres hacer"
            className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro placeholder:text-xo-gris"
          />
        ) : (
          <select
            id="curso"
            name="curso"
            className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
          >
            {cursos.map((curso) => (
              <option key={curso.slug} value={curso.slug}>
                {curso.nombre}
              </option>
            ))}
          </select>
        )}
        <button
          type="button"
          onClick={() => setNuevo(!nuevo)}
          className="xo-eyebrow mt-2 text-xo-gris underline underline-offset-4 hover:text-xo-negro"
        >
          {nuevo ? "Elegir uno del catálogo" : "Quiero proponer uno nuevo"}
        </button>
      </div>

      <div>
        <label htmlFor="sede" className="xo-eyebrow text-xo-gris">
          Sala (opcional)
        </label>
        <select
          id="sede"
          name="sede"
          defaultValue=""
          className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
        >
          <option value="">Cualquiera</option>
          {sedes.map((sede) => (
            <option key={sede.slug} value={sede.slug}>
              {sede.nombre}, {sede.comuna}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="mensaje" className="xo-eyebrow text-xo-gris">
          Cuéntanos por qué (opcional)
        </label>
        <textarea
          id="mensaje"
          name="mensaje"
          rows={3}
          className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
        />
      </div>

      <button
        type="submit"
        disabled={enviando}
        className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {enviando ? "Enviando…" : "Pedir este horario"}
      </button>

      {fallo ? (
        <p
          role="alert"
          className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}
    </form>
  );
}
