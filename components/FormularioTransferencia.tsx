"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { comprobarAmiga, declararTransferencia } from "@/lib/acciones";
import { esParaAmiga, porClaseDeOferta, type Oferta } from "@/lib/dominio/ofertas";
import { clp } from "@/lib/planes";
import type { DatosTransferencia } from "@/lib/compras-consultas";

/**
 * Declarar la transferencia de una oferta **ya elegida**.
 *
 * Es la mitad de abajo del viejo `FormularioCompra`, sin el selector de packs:
 * quien llega acá lo hizo desde un link que ya decía qué compraba, y volver a
 * preguntárselo es hacerle elegir dos veces lo mismo (PRD-0020 §1).
 *
 * El monto **no viaja en el formulario**: se manda el slug de la oferta y el
 * servidor calcula cuánto vale. Si el precio viniera del cliente, cualquiera
 * podría declarar que pagó $1.
 */
export function FormularioTransferencia({
  oferta,
  datos,
}: {
  oferta: Oferta;
  datos: DatosTransferencia;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [listo, setListo] = useState(false);
  const [sinCorreo, setSinCorreo] = useState(false);
  const [enviando, iniciar] = useTransition();
  // PRD-0026: el correo de la amiga **ya comprobado por el servidor**. Mientras
  // sea null no se muestran los datos para transferir: si se enterara de que
  // su amiga no tiene cuenta después de transferir, se sentiría trampa.
  const paraAmiga = esParaAmiga(oferta);
  const [amiga, setAmiga] = useState<string | null>(null);
  const puedeTransferir = !paraAmiga || amiga !== null;

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
          {paraAmiga ? " A tu amiga también le escribimos cuando la suya esté en su cuenta." : ""}
        </p>
        {/* El aviso quedó registrado igual: esto es solo que el acuse por
            correo no salió. En gris y sin alarma (PRD-0019 §8.6). */}
        {sinCorreo ? (
          <p className="mt-3 text-sm leading-relaxed text-xo-gris">
            No pudimos mandarte el correo con este aviso, pero quedó registrado.
            Tu compra aparece en Mis reservas.
          </p>
        ) : null}
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
        <h2 className="xo-eyebrow text-xo-gris">1 · Lo que vas a comprar</h2>

        <div className="mt-4 rounded-lg border border-xo-negro/20 p-5">
          <p className="text-2xl font-semibold text-xo-negro">{oferta.titulo}</p>
          <p className="mt-2 text-sm text-xo-gris">
            {clp(porClaseDeOferta(oferta))} por clase · {oferta.vigenciaDias} días
            para usarlas
          </p>
          {oferta.precioNormalClp !== null ? (
            <p className="mt-2 text-sm text-xo-gris">
              Precio normal <s>{clp(oferta.precioNormalClp)}</s>
              {oferta.vigenteHasta ? ` · este precio vale para compras hasta el ${oferta.vigenteHasta}` : ""}
            </p>
          ) : null}
        </div>

        <p className="mt-5 max-w-prose text-sm leading-relaxed text-xo-gris">
          Sirven para cualquier horario del calendario, con cualquier profe y en
          cualquiera de nuestras salas.
        </p>

        {paraAmiga ? <AvisoAmiga oferta={oferta} /> : null}
      </div>

      <div>
        {paraAmiga ? (
          <PasoAmiga confirmada={amiga} alConfirmar={setAmiga} />
        ) : null}

        {puedeTransferir ? (
          <>
        <h2 className={`xo-eyebrow text-xo-gris ${paraAmiga ? "mt-10" : ""}`}>
          {paraAmiga ? "3" : "2"} · Transfiere
        </h2>

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
              {clp(oferta.precioClp)}
            </dd>
          </div>
        </dl>

        <h2 className="xo-eyebrow mt-10 text-xo-gris">{paraAmiga ? "4" : "3"} · Avísanos</h2>

        <form
          className="mt-4 space-y-4"
          action={(datosForm) => {
            setFallo(null);
            iniciar(async () => {
              const resultado = await declararTransferencia(datosForm);
              if (resultado.ok) {
                setSinCorreo(resultado.correoEnviado === false);
                setListo(true);
              }
              else setFallo(resultado.mensaje);
            });
          }}
        >
          <input type="hidden" name="oferta" value={oferta.slug} />
          {amiga ? <input type="hidden" name="correo_amiga" value={amiga} /> : null}

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
          </>
        ) : null}
      </div>
    </div>
  );
}

/** Lo mismo que dice la vitrina, repetido acá: nadie llega a transferir sin leerlo. */
function AvisoAmiga({ oferta }: { oferta: Oferta }) {
  const suyas = oferta.clases - oferta.clasesParaAmiga;
  return (
    <p className="mt-5 max-w-prose border-l-2 border-xo-negro pl-4 text-sm leading-relaxed text-xo-negro">
      {suyas === 1 ? "Una clase es tuya" : `${suyas} clases son tuyas`} y{" "}
      {oferta.clasesParaAmiga === 1 ? "la otra va" : `${oferta.clasesParaAmiga} van`} a la cuenta
      de tu amiga. <strong>Tu amiga tiene que tener cuenta en XO</strong> con el correo que nos
      des: si todavía no la tiene, pídele que se cree una antes de seguir.
    </p>
  );
}

/**
 * El correo de la amiga, comprobado en el servidor antes de mostrar a dónde
 * transferir. La respuesta es solo "tiene cuenta" o "no tiene cuenta": nunca
 * su nombre (PRD-0026 §8.4). Y cada comprobación cuenta para el límite de
 * intentos, que vive en la base.
 */
function PasoAmiga({
  confirmada,
  alConfirmar,
}: {
  confirmada: string | null;
  alConfirmar: (correo: string | null) => void;
}) {
  const [correo, setCorreo] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [comprobando, iniciar] = useTransition();

  if (confirmada) {
    return (
      <div>
        <h2 className="xo-eyebrow text-xo-gris">2 · Tu amiga</h2>
        <p className="mt-4 text-sm text-xo-negro">
          <span aria-hidden="true">✦ </span>
          <strong className="break-all">{confirmada}</strong> tiene cuenta. Su clase llega a esa
          cuenta cuando confirmemos tu transferencia.
        </p>
        <button
          type="button"
          onClick={() => alConfirmar(null)}
          className="xo-eyebrow mt-3 text-xo-negro underline underline-offset-4"
        >
          Cambiar el correo
        </button>
      </div>
    );
  }

  const listo = correo.trim().includes("@");

  return (
    <form
      onSubmit={(evento) => {
        evento.preventDefault();
        if (!listo) return;
        setMensaje(null);
        const valor = correo.trim();
        iniciar(async () => {
          const r = await comprobarAmiga(valor);
          if (!r.ok) setMensaje(r.mensaje);
          else if (r.tieneCuenta) alConfirmar(valor);
          else
            setMensaje(
              "Ese correo no tiene cuenta en XO. Pídele a tu amiga que se cree una con ese mismo correo, o revisa si está bien escrito.",
            );
        });
      }}
    >
      <h2 className="xo-eyebrow text-xo-gris">2 · Tu amiga</h2>
      <label htmlFor="correo_amiga" className="mt-4 block text-sm text-xo-negro">
        El correo con que tu amiga entra a XO
      </label>
      <input
        id="correo_amiga"
        type="email"
        required
        autoComplete="off"
        value={correo}
        onChange={(e) => {
          setCorreo(e.target.value);
          setMensaje(null);
        }}
        className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro"
      />
      <button
        type="submit"
        disabled={!listo || comprobando}
        className="xo-eyebrow mt-4 w-full rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {comprobando ? "Comprobando…" : "Continuar"}
      </button>
      <p className="mt-3 text-sm leading-relaxed text-xo-gris">
        Solo te decimos si ese correo tiene cuenta, nada más de ella.
      </p>
      {mensaje ? (
        <p role="alert" className="mt-4 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {mensaje}
        </p>
      ) : null}
    </form>
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
