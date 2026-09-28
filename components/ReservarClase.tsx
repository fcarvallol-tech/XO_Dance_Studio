"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { reservarClase } from "@/lib/acciones";
import { lugaresLibres, type ClaseDelCalendario } from "@/lib/compras";
import { rangoHorario } from "@/lib/dominio/horarios";

/**
 * Reservar **una** clase, la que trae la URL.
 *
 * Los tres estados que importan y que la pantalla tiene que distinguir, porque
 * lo que hay que hacer en cada uno es distinto: ya la tiene reservada, no le
 * quedan clases compradas, o puede reservar.
 */
export function ReservarClase({
  clase,
  saldo,
}: {
  clase: ClaseDelCalendario;
  saldo: number;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();

  const libres = lugaresLibres(clase);

  if (listo || clase.reservaId) {
    return (
      <div role="status" className="max-w-xl">
        <p className="xo-eyebrow text-xo-gris">
          <span aria-hidden="true">✦ </span>
          {listo ? "Reservada" : "Ya la tienes"}
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-xo-negro">
          {listo ? "Tu clase está reservada" : "Ya reservaste esta clase"}
        </h2>

        {aviso ? <p className="mt-4 text-sm leading-relaxed text-xo-gris">{aviso}</p> : null}

        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => router.push("/mis-clases")}
            className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
          >
            Ver mis clases
          </button>
          <Link
            href="/calendario"
            className="xo-eyebrow self-center text-xo-negro underline underline-offset-4"
          >
            Reservar otra
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl">
      <dl className="rounded-lg border border-xo-negro/20 p-5">
        <Dato etiqueta="Horario" valor={rangoHorario(clase.inicio, clase.fin)} />
        <Dato etiqueta="Profesora" valor={clase.profesoraNombre} />
        <Dato etiqueta="Dónde" valor={`${clase.sedeNombre}, ${clase.sedeComuna}`} />
        <Dato
          etiqueta="Lugares"
          valor={libres === 0 ? "Llena" : `Quedan ${libres} de ${clase.cupoMaximo}`}
        />
      </dl>

      {libres === 0 ? (
        <div className="mt-8 border-l-2 border-xo-negro pl-5">
          <p className="text-lg leading-relaxed text-xo-negro">
            Esta clase ya se llenó.
          </p>
          <Link
            href="/calendario"
            className="xo-eyebrow mt-6 inline-block text-xo-negro underline underline-offset-4"
          >
            Ver las otras clases
          </Link>
        </div>
      ) : saldo <= 0 ? (
        <div className="mt-8 border-l-2 border-xo-negro pl-5">
          <p className="text-lg leading-relaxed text-xo-negro">
            No te quedan clases compradas.
          </p>
          <p className="mt-3 leading-relaxed text-xo-gris">
            Compra un pack y vuelve: esta clase te va a estar esperando si
            todavía quedan lugares.
          </p>
          <Link
            href="/comprar"
            className="xo-eyebrow mt-6 inline-flex items-center rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
          >
            Ver los packs
          </Link>
        </div>
      ) : (
        <>
          <p className="mt-6 text-xo-gris">
            Te quedan{" "}
            <strong className="text-xo-negro">
              {saldo} {saldo === 1 ? "clase" : "clases"}
            </strong>
            . Al reservar se descuenta una.
          </p>

          <button
            type="button"
            disabled={enviando}
            onClick={() => {
              setFallo(null);
              iniciar(async () => {
                const resultado = await reservarClase(clase.id);
                if (!resultado.ok) setFallo(resultado.mensaje);
                else {
                  if (resultado.correoEnviado === false) {
                    setAviso(
                      "No pudimos mandarte el comprobante por correo. Tu clase está igual de reservada y lo reintentamos.",
                    );
                  }
                  setListo(true);
                }
              });
            }}
            className="xo-eyebrow mt-8 rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-40"
          >
            {enviando ? "Reservando…" : "Reservar esta clase"}
          </button>

          <p className="mt-4 text-sm leading-relaxed text-xo-gris">
            Puedes cancelar hasta 30 minutos antes y recuperas tu clase.
          </p>
        </>
      )}

      {fallo ? (
        <p role="alert" className="mt-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-xo-gris">{etiqueta}</dt>
      <dd className="text-right font-medium text-xo-negro">{valor}</dd>
    </div>
  );
}
