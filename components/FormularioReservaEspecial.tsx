"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reservarEspecial } from "@/lib/acciones";
import { clp } from "@/lib/planes";
import type { DatosTransferencia } from "@/lib/compras-consultas";
import type { EspecialPublica } from "@/lib/especiales-consultas";

/**
 * Reservar una clase especial: se transfiere y se avisa, igual que un pack.
 *
 * La diferencia con `FormularioCompra` es la que importa: acá **el cupo se toma
 * al avisar** (PRD-0018 §8.2). Por eso la pantalla dice hasta cuándo queda
 * tomado, y por eso el botón no dice "Ya transferí" a secas sino que deja claro
 * que con eso se guarda el lugar.
 *
 * El monto no viaja en el formulario: lo pone la base con el precio de la
 * clase, congelado en ese instante.
 */
export function FormularioReservaEspecial({
  especial,
  datos,
}: {
  especial: EspecialPublica;
  datos: DatosTransferencia;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();

  if (listo) {
    return (
      <div role="status" className="max-w-xl">
        <p className="xo-eyebrow text-xo-gris">
          <span aria-hidden="true">✦ </span>Tu cupo está tomado
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-xo-negro">
          Te guardamos el lugar
        </h2>
        <p className="mt-5 leading-relaxed text-xo-gris">
          Te llegó un correo con hasta cuándo te lo guardamos. Cuando veamos la
          transferencia en la cuenta, te confirmamos y queda cerrado.
        </p>
        <button
          type="button"
          onClick={() => router.push("/mis-clases")}
          className="xo-eyebrow mt-8 rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
        >
          Ver mis clases
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <h2 className="xo-eyebrow text-xo-gris">1 · Transfiere</h2>

        <dl className="mt-4 rounded-lg border border-xo-negro/20 p-5 text-sm">
          <Dato etiqueta="Banco" valor={datos.banco} />
          <Dato etiqueta="Tipo" valor={datos.tipoCuenta} />
          <Dato etiqueta="Cuenta" valor={datos.numero} />
          <Dato etiqueta="RUT" valor={datos.rut} />
          <Dato etiqueta="Titular" valor={datos.titular} />
          <Dato etiqueta="Correo" valor={datos.correo} />
          <div className="mt-4 border-t border-xo-negro/15 pt-4">
            <dt className="xo-eyebrow text-xo-gris">Monto</dt>
            <dd className="mt-1 text-2xl font-semibold text-xo-negro">
              {clp(especial.precioClp)}
            </dd>
          </div>
        </dl>

        <p className="mt-5 max-w-prose text-sm leading-relaxed text-xo-gris">
          Esta clase se paga aparte: no usa las clases de tu pack.
        </p>
      </div>

      <div>
        <h2 className="xo-eyebrow text-xo-gris">2 · Avísanos y te guardamos el cupo</h2>

        <form
          className="mt-4 space-y-4"
          action={(datosForm) => {
            setFallo(null);
            iniciar(async () => {
              const resultado = await reservarEspecial(datosForm);
              if (resultado.ok) setListo(true);
              else setFallo(resultado.mensaje);
            });
          }}
        >
          <input type="hidden" name="slug" value={especial.slug} />

          <div>
            <label htmlFor="titular" className="xo-eyebrow text-xo-gris">
              ¿Transfirió otra persona? (opcional)
            </label>
            <input
              id="titular"
              name="titular"
              type="text"
              placeholder="Nombre de quien transfirió"
              className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro placeholder:text-xo-gris"
            />
          </div>

          <div>
            <label htmlFor="nota" className="xo-eyebrow text-xo-gris">
              Algo que debamos saber (opcional)
            </label>
            <input
              id="nota"
              name="nota"
              type="text"
              className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
            />
          </div>

          <button
            type="submit"
            disabled={enviando}
            className="xo-eyebrow w-full rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Guardando tu cupo…" : `Ya transferí ${clp(especial.precioClp)}`}
          </button>

          <p className="text-sm leading-relaxed text-xo-gris">
            Apretar esto toma tu lugar de inmediato y nos avisa para revisar la
            cuenta. Si no vemos la transferencia a tiempo, el cupo se libera.
          </p>

          {fallo ? (
            <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
              {fallo}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-4 py-1.5">
      <dt className="text-xo-gris">{etiqueta}</dt>
      <dd className="text-right font-medium text-xo-negro">{valor}</dd>
    </div>
  );
}
