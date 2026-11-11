"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarNoSeRecupera } from "@/lib/acciones-liquidacion";

/**
 * "No se va a recuperar" (Felipe, 07/11/2026). Una clase pendiente de
 * recuperación paga $0; con la marca paga la base en el mes en que se marca.
 * Pide confirmar porque es decidir pagar una clase que no se hizo. Quitarla la
 * vuelve a pendiente, mientras ese mes no esté cerrado: eso lo cuida la base.
 */
export function MarcarNoSeRecupera({ claseId, marcada }: { claseId: string; marcada: boolean }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function enviar() {
    setFallo(null);
    iniciar(async () => {
      const r = await marcarNoSeRecupera({ claseId, marcar: !marcada });
      if (!r.ok) {
        setFallo(r.mensaje);
        return;
      }
      setConfirmando(false);
      router.refresh();
    });
  }

  if (!confirmando) {
    return (
      <button
        type="button"
        onClick={() => setConfirmando(true)}
        className="mt-2 block text-sm text-xo-gris underline underline-offset-4"
      >
        {marcada ? "Quitar la marca «no se va a recuperar»" : "Marcar que no se va a recuperar"}
      </button>
    );
  }

  return (
    <div className="mt-3 max-w-md space-y-3 border-l-2 border-xo-negro/20 pl-4">
      <p className="text-sm text-xo-negro">
        {marcada
          ? "Vuelve a quedar pendiente: no se paga hasta que se recupere o la marques de nuevo."
          : "Se le paga la base en el mes de hoy, aunque la clase no se hizo. Después ya no se puede recuperar sin quitar la marca."}
      </p>
      {fallo ? (
        <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={enviando}
          onClick={enviar}
          className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {marcada ? "Quitar la marca" : "Confirmar"}
        </button>
        <button
          type="button"
          onClick={() => setConfirmando(false)}
          className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
