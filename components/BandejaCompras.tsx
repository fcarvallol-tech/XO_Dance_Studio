"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { aprobarCompra, rechazarCompra } from "@/lib/acciones";
import { clp } from "@/lib/planes";
import { cuandoLegible, type Compra } from "@/lib/compras";

/**
 * Aprobar o rechazar transferencias declaradas.
 *
 * **Aprobar son dos pasos.** El primero abre un diálogo con lo que hay que
 * calzar con la cartola —alumna, monto, clases, a nombre de quién transfirió y
 * su nota— y recién ahí está el botón que acredita. No es fricción: es el
 * momento en que se compara con el banco, y antes ese dato ni siquiera se veía
 * (PRD-0017 §19). Rechazar pide motivo porque del otro lado hay alguien que
 * transfirió plata y necesita saber qué pasó — la base tampoco deja rechazar
 * sin él.
 */
export function BandejaCompras({ pendientes }: { pendientes: Compra[] }) {
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState<Compra | null>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const volver = useRef<HTMLButtonElement>(null);
  const [, iniciar] = useTransition();

  // El `<dialog>` nativo trae lo que un modal necesita sin librería: fondo,
  // foco atrapado y Escape para cerrar. Se abre y cierra desde el estado.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (confirmando && !d.open) {
      d.showModal();
      // Después de abrir, no antes: `showModal` enfoca el primer botón —que es
      // Aprobar— y el `autoFocus` de React no deja atributo que lo impida.
      volver.current?.focus();
    }
    if (!confirmando && d.open) d.close();
  }, [confirmando]);

  if (pendientes.length === 0) {
    return (
      <p className="text-xo-gris">
        No hay transferencias esperando. Cuando alguien declare un pago, aparece
        acá y llega un correo.
      </p>
    );
  }

  function correr(
    fn: () => Promise<{ ok: true; correoEnviado?: boolean } | { ok: false; mensaje: string }>,
    id: string,
  ) {
    setFallo(null);
    setAviso(null);
    setOcupada(id);
    iniciar(async () => {
      const resultado = await fn();
      setConfirmando(null);
      if (!resultado.ok) setFallo(resultado.mensaje);
      // La compra se acreditó igual. Que el correo no haya salido es otra cosa,
      // y quien aprueba tiene que enterarse acá y no en un log (PRD-0019 §1).
      else if (resultado.correoEnviado === false) {
        setAviso(
          "Quedó acreditada, pero el correo a la alumna no salió. Está registrado y se reintenta; lo puedes ver en Correos.",
        );
      }
      else {
        setRechazando(null);
        setMotivo("");
      }
      setOcupada(null);
    });
  }

  return (
    <div>
      {fallo ? (
        <p
          role="alert"
          className="mb-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
        >
          {fallo}
        </p>
      ) : null}

      {/* No es un error: la operación salió bien y el correo no. Va en gris y
          sin `role="alert"` justamente por eso (PRD-0019 §8.6). */}
      {aviso ? (
        <p role="status" className="mb-6 text-sm leading-relaxed text-xo-gris">
          {aviso}
        </p>
      ) : null}

      <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        {pendientes.map((compra) => (
          <li key={compra.id} className="py-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg text-xo-negro">
                  {compra.alumna ?? "Sin nombre"} ·{" "}
                  <strong className="font-semibold">{clp(compra.monto)}</strong>
                </p>
                <p className="text-sm text-xo-gris">
                  {compra.planNombre} · declarada {cuandoLegible(compra.declaradaAt)}
                  {compra.especial
                    ? ` · clase especial del ${cuandoLegible(compra.especial.inicio)}`
                    : ""}
                </p>
                {compra.correoAlumna &&
                !compra.correoAlumna.endsWith(".invalid") ? (
                  <p className="text-sm text-xo-gris">{compra.correoAlumna}</p>
                ) : null}
                <p className="mt-2 text-sm text-xo-negro">
                  <span className="text-xo-gris">A nombre de: </span>
                  {compra.titularDeclarado ?? (
                    <span className="text-xo-gris">no indicó a otra persona</span>
                  )}
                </p>
                {compra.notaAlumna ? (
                  <p className="text-sm text-xo-negro">
                    <span className="text-xo-gris">Nota: </span>
                    {compra.notaAlumna}
                  </p>
                ) : null}
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={ocupada === compra.id}
                  onClick={() => setConfirmando(compra)}
                  className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 whitespace-nowrap text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
                >
                  {ocupada === compra.id ? "…" : "Aprobar"}
                </button>
                <button
                  type="button"
                  disabled={ocupada === compra.id}
                  onClick={() =>
                    setRechazando(rechazando === compra.id ? null : compra.id)
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:border-xo-negro/50 disabled:opacity-50"
                >
                  Rechazar
                </button>
              </div>
            </div>

            {rechazando === compra.id ? (
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <label htmlFor={`motivo-${compra.id}`} className="sr-only">
                  Motivo del rechazo
                </label>
                <input
                  id={`motivo-${compra.id}`}
                  type="text"
                  value={motivo}
                  onChange={(evento) => setMotivo(evento.target.value)}
                  placeholder="Motivo: se lo mandamos a ella"
                  className="min-w-64 flex-1 rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-2.5 text-sm text-xo-negro placeholder:text-xo-gris"
                />
                <button
                  type="button"
                  disabled={!motivo.trim() || ocupada === compra.id}
                  onClick={() =>
                    correr(() => rechazarCompra(compra.id, motivo), compra.id)
                  }
                  className="xo-eyebrow rounded-full border border-xo-negro px-5 py-2.5 whitespace-nowrap text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-40"
                >
                  Confirmar rechazo
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-aprobar"
        onClose={() => setConfirmando(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        {confirmando ? (
          <>
            <p className="xo-eyebrow text-xo-gris">Compáralo con la cartola</p>
            <h2
              id="titulo-aprobar"
              className="mt-2 font-display text-3xl leading-none text-xo-negro"
            >
              Aprobar transferencia
            </h2>

            <dl className="mt-6 divide-y divide-xo-negro/10 border-y border-xo-negro/10 text-sm">
              <Fila etiqueta="Alumna" valor={confirmando.alumna ?? "Sin nombre"} />
              <Fila etiqueta="Monto" valor={clp(confirmando.monto)} fuerte />
              <Fila
                etiqueta={confirmando.especial ? "Clase especial" : "Clases"}
                valor={
                  confirmando.especial
                    ? `${confirmando.planNombre} · ${cuandoLegible(confirmando.especial.inicio)}`
                    : // El nombre del plan ya es la cantidad ("4 clases"):
                      // juntarlos decía "4 · 4 clases".
                      `${confirmando.clases} ${confirmando.clases === 1 ? "clase" : "clases"}`
                }
              />
              <Fila
                etiqueta="A nombre de"
                valor={confirmando.titularDeclarado ?? "No indicó a otra persona"}
                apagado={!confirmando.titularDeclarado}
              />
              <Fila
                etiqueta="Nota"
                valor={confirmando.notaAlumna ?? "Sin nota"}
                apagado={!confirmando.notaAlumna}
              />
              <Fila etiqueta="Declarada" valor={cuandoLegible(confirmando.declaradaAt)} />
            </dl>

            <p className="mt-5 text-sm leading-relaxed text-xo-gris">
              {confirmando.especial
                ? "Aprobar le confirma el lugar en la clase especial y le avisa por correo."
                : "Aprobar acredita las clases al tiro y le avisa por correo."}{" "}
              No se deshace desde acá.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={ocupada === confirmando.id}
                onClick={() =>
                  correr(() => aprobarCompra(confirmando.id), confirmando.id)
                }
                className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
              >
                {/* Una especial no acredita créditos: confirma un cupo
                    (PRD-0018). El botón dice lo que de verdad pasa. */}
                {ocupada === confirmando.id
                  ? "Aprobando…"
                  : confirmando.especial
                    ? "Aprobar y confirmar su lugar"
                    : `Aprobar y acreditar ${confirmando.clases} ${
                        confirmando.clases === 1 ? "clase" : "clases"
                      }`}
              </button>
              {/* El foco entra acá y no en Aprobar: un Enter apurado vuelve
                  atrás en vez de acreditar. */}
              <button
                ref={volver}
                type="button"
                onClick={() => setConfirmando(null)}
                className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro transition-colors hover:border-xo-negro/50"
              >
                Volver
              </button>
            </div>
          </>
        ) : null}
      </dialog>
    </div>
  );
}

function Fila({
  etiqueta,
  valor,
  fuerte = false,
  apagado = false,
}: {
  etiqueta: string;
  valor: string;
  fuerte?: boolean;
  apagado?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-xo-gris">{etiqueta}</dt>
      <dd
        className={`text-right ${
          fuerte ? "text-lg font-semibold text-xo-negro" : apagado ? "text-xo-gris" : "text-xo-negro"
        }`}
      >
        {valor}
      </dd>
    </div>
  );
}
