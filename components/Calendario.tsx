"use client";

import { useState, useTransition } from "react";
import { cancelarReserva, reservarClase } from "@/lib/acciones";
import {
  claveDia,
  diaLegible,
  horaLegible,
  lugaresLibres,
  type ClaseDelCalendario,
} from "@/lib/compras";

/**
 * Las clases de los próximos 60 días, agrupadas por día.
 *
 * El filtro por profesora **atenúa en vez de esconder**, como pide BRAND.md §6:
 * se mantiene el contexto de la semana completa y se destaca lo relevante.
 *
 * **La jerarquía va por saturación, no por opacidad.** Bajar la opacidad
 * degrada el texto justo cuando el fondo es claro, que es lo que ese mismo
 * documento advierte que no puede pasar. Lo que retrocede pierde el color de
 * marca y el peso, no la legibilidad: sigue en `xo-negro` y `xo-gris`, que son
 * los contrastes que BRAND.md §4 aprueba.
 */
export function Calendario({
  clases,
  saldo,
}: {
  clases: ClaseDelCalendario[];
  saldo: number;
}) {
  const [profesora, setProfesora] = useState<string | null>(null);
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [, iniciar] = useTransition();

  const profesoras = [
    ...new Map(clases.map((c) => [c.profesoraSlug, c.profesoraNombre])).entries(),
  ];

  const dias = new Map<string, ClaseDelCalendario[]>();
  for (const clase of clases) {
    const clave = claveDia(clase.inicio);
    dias.set(clave, [...(dias.get(clave) ?? []), clase]);
  }

  function accion(
    fn: () => Promise<{ ok: true } | { ok: false; mensaje: string }>,
    id: string,
  ) {
    setFallo(null);
    setOcupada(id);
    iniciar(async () => {
      const resultado = await fn();
      if (!resultado.ok) setFallo(resultado.mensaje);
      setOcupada(null);
    });
  }

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-center gap-2">
        <span className="xo-eyebrow mr-2 text-xo-gris">Filtrar</span>
        <Chip activo={profesora === null} onClick={() => setProfesora(null)}>
          Todas
        </Chip>
        {profesoras.map(([slug, nombre]) => (
          <Chip
            key={slug}
            activo={profesora === slug}
            onClick={() => setProfesora(profesora === slug ? null : slug)}
          >
            {nombre}
          </Chip>
        ))}
      </div>

      {fallo ? (
        <p
          role="alert"
          className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}

      <div className="space-y-10">
        {[...dias.entries()].map(([clave, delDia]) => (
          <section key={clave}>
            <h2 className="xo-eyebrow border-b border-xo-negro/15 pb-2 text-xo-gris">
              {diaLegible(delDia[0].inicio)}
            </h2>

            <ul className="mt-4 space-y-3">
              {delDia.map((clase) => {
                const atenuada =
                  profesora !== null && clase.profesoraSlug !== profesora;
                const libres = lugaresLibres(clase);
                const mia = clase.reservaId !== null;

                return (
                  <li
                    key={clase.id}
                    className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border px-5 py-4 transition-colors ${
                      mia ? "border-xo-negro bg-xo-negro/5" : "border-xo-negro/20"
                    } ${atenuada ? "border-xo-negro/10 bg-transparent" : ""}`}
                  >
                    <div>
                      <p className={atenuada ? "text-xo-gris" : "text-xo-negro"}>
                        <span className="font-semibold">
                          {horaLegible(clase.inicio)}
                        </span>{" "}
                        · {clase.cursoNombre}
                      </p>
                      <p className="text-sm text-xo-gris">
                        {clase.profesoraNombre} · {clase.sedeNombre},{" "}
                        {clase.sedeComuna}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm text-xo-gris">
                        {libres === 0
                          ? "Sin cupos"
                          : `Quedan ${libres} de ${clase.cupoMaximo}`}
                      </span>

                      {mia ? (
                        <button
                          type="button"
                          disabled={ocupada === clase.id}
                          onClick={() =>
                            accion(
                              () => cancelarReserva(clase.reservaId as string),
                              clase.id,
                            )
                          }
                          className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-50"
                        >
                          {ocupada === clase.id ? "…" : "Cancelar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={libres === 0 || saldo === 0 || ocupada === clase.id}
                          onClick={() => accion(() => reservarClase(clase.id), clase.id)}
                          className="xo-eyebrow rounded-full bg-xo-rosa px-4 py-2 whitespace-nowrap text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {ocupada === clase.id ? "…" : "Reservar"}
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

function Chip({
  activo,
  onClick,
  children,
}: {
  activo: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`xo-eyebrow rounded-full border px-4 py-2 transition-colors ${
        activo
          ? "border-xo-negro bg-xo-negro text-xo-blanco"
          : "border-xo-negro/20 text-xo-gris hover:border-xo-negro/50"
      }`}
    >
      {children}
    </button>
  );
}
