"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { declararTransferencia } from "@/lib/acciones";
import { clp, porClase, precioVigente, type Plan } from "@/lib/planes";
import type { DatosTransferencia } from "@/lib/compras-consultas";

/**
 * Los dos pasos de comprar sin pasarela: elegir el pack y avisar que se
 * transfirió.
 *
 * El monto **no viaja en el formulario**. Se envía el slug del plan y el
 * servidor calcula cuánto vale, promoción incluida. Si el precio viniera del
 * cliente, cualquiera podría declarar que pagó $1.
 */
export function FormularioCompra({
  planes,
  datos,
}: {
  planes: Plan[];
  datos: DatosTransferencia;
}) {
  const router = useRouter();
  const [elegido, setElegido] = useState<Plan | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [enviando, iniciar] = useTransition();

  if (listo) {
    return (
      <div role="status" className="max-w-xl">
        <p className="xo-eyebrow text-xo-gris">
          <span aria-hidden="true">✦ </span>Recibido
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.75rem,4vw,2.5rem)] leading-none text-xo-negro">
          Nos avisaste. Ahora revisamos.
        </h2>
        <p className="mt-5 leading-relaxed text-xo-gris">
          Miramos la cuenta y te acreditamos las clases. Te llega un correo
          cuando estén listas y ahí ya puedes reservar.
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <button
            type="button"
            onClick={() => router.push("/mis-clases")}
            className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
          >
            Ver mis clases
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div>
        <h2 className="xo-eyebrow text-xo-gris">1 · Elige el pack</h2>

        <ul className="mt-4 space-y-3">
          {planes.map((plan) => {
            const activo = elegido?.slug === plan.slug;
            return (
              <li key={plan.slug}>
                <button
                  type="button"
                  onClick={() => setElegido(plan)}
                  aria-pressed={activo}
                  className={`flex w-full items-baseline justify-between gap-4 rounded-lg border px-5 py-4 text-left transition-colors ${
                    activo
                      ? "border-xo-negro bg-xo-negro/5"
                      : "border-xo-negro/20 hover:border-xo-negro/50"
                  }`}
                >
                  <span>
                    <span className="block font-semibold text-xo-negro">
                      {plan.nombre}
                    </span>
                    <span className="block text-sm text-xo-gris">
                      {clp(porClase(plan))} por clase
                    </span>
                  </span>
                  <span className="text-right">
                    {plan.promo !== null ? (
                      <span className="mr-2 text-sm text-xo-gris line-through">
                        {clp(plan.precio)}
                      </span>
                    ) : null}
                    <span className="text-lg font-semibold text-xo-negro">
                      {clp(precioVigente(plan))}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <p className="mt-5 max-w-prose text-sm leading-relaxed text-xo-gris">
          Las clases sirven para cualquier horario de la parrilla, con cualquier
          profe y en cualquiera de las dos salas. Tienes 60 días para usarlas.
        </p>
      </div>

      <div>
        <h2 className="xo-eyebrow text-xo-gris">2 · Transfiere</h2>

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
              {elegido ? clp(precioVigente(elegido)) : "Elige un pack"}
            </dd>
          </div>
        </dl>

        <h2 className="xo-eyebrow mt-10 text-xo-gris">3 · Avísanos</h2>

        <form
          className="mt-4 space-y-4"
          action={(datosForm) => {
            setFallo(null);
            iniciar(async () => {
              const resultado = await declararTransferencia(datosForm);
              if (resultado.ok) setListo(true);
              else setFallo(resultado.mensaje);
            });
          }}
        >
          <input type="hidden" name="plan" value={elegido?.slug ?? ""} />

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
            disabled={!elegido || enviando}
            className="xo-eyebrow w-full rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {enviando ? "Enviando…" : "Ya transferí"}
          </button>

          <p className="text-sm leading-relaxed text-xo-gris">
            Apretar esto no cobra nada: nos avisa para que revisemos la cuenta.
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
