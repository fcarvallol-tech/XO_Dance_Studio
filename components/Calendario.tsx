"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { cancelarReserva, reservarClase } from "@/lib/acciones";
import { diaLegible, lugaresLibres, type ClaseDelCalendario } from "@/lib/compras";
import { clp } from "@/lib/planes";
import { rangoHorario } from "@/lib/dominio/horarios";
import { destaque, estadoParaAlumna, type Destaque, type EstadoParaAlumna } from "@/lib/dominio/reservas";
import { GrillaCalendario, type Ubicacion } from "@/components/GrillaCalendario";

/**
 * El calendario del portal de alumna: **la misma grilla del sitio público**, en
 * tema claro y con cada clase accionable (PRD-0007 §8, PRD-0006 §12).
 *
 * Antes era un listado por día. Ahora es `GrillaCalendario` —siete días,
 * tramos de media hora, un día a la vez bajo `lg`— y no una segunda grilla:
 * la estructura no puede divergir entre portales. Lo que pone este archivo es
 * **qué va dentro de cada clase** y qué pasa al tocarla.
 *
 * **Tocar una clase abre un diálogo, no reserva.** En un bloque de una hora
 * (56 px) no cabe un botón, y reservar de un toque en el teléfono es reservar
 * sin querer. El diálogo muestra el detalle y la acción que corresponde a su
 * estado (`estadoParaAlumna`): reservar, cancelar la suya, "se llenó", o "no
 * te quedan clases" con el enlace a comprar **en vez de** el botón.
 *
 * ---
 *
 * **El filtro destaca y atenúa a la vez** (PRD-0007 §8). Antes solo
 * atenuaba: el resto se ponía gris y la elegida no cambiaba, así que no se
 * leía qué se había elegido. Ahora:
 *
 * - **la elegida va con fondo `xo-rosa` y texto `xo-negro`**, el patrón de
 *   botón primario. Nunca texto rosa: sobre blanco da 1,7:1;
 * - **las demás siguen ahí, en `xo-gris` sobre blanco** (5,0:1). Atenuadas
 *   por color y no por opacidad: con opacidad el contraste depende de lo que
 *   haya debajo y nadie lo mide. Una clase atenuada sigue siendo información.
 *
 * **Las suyas van en negro, con o sin filtro.** "Reservada" es un estado de
 * ella, no del filtro: es lo que puede cancelar, y no puede desaparecer porque
 * eligió otra profesora.
 */
export function Calendario({
  clases,
  saldo,
  hoy,
}: {
  clases: ClaseDelCalendario[];
  saldo: number;
  hoy: string;
}) {
  const [profesora, setProfesora] = useState<string | null>(null);
  const [abierta, setAbierta] = useState<ClaseDelCalendario | null>(null);
  const [ocupada, setOcupada] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [, iniciar] = useTransition();
  const dialogo = useRef<HTMLDialogElement>(null);
  const volver = useRef<HTMLButtonElement>(null);

  const profesoras = [
    ...new Map(clases.map((c) => [c.profesoraSlug, c.profesoraNombre])).entries(),
  ];

  // El `<dialog>` nativo: fondo, foco atrapado y Escape, sin librería. El foco
  // entra en "Volver" después de abrir —`showModal` enfocaría el primer botón—
  // para que un toque o un Enter de más no reserve.
  useEffect(() => {
    const d = dialogo.current;
    if (!d) return;
    if (abierta && !d.open) {
      d.showModal();
      volver.current?.focus();
    }
    if (!abierta && d.open) d.close();
  }, [abierta]);

  function accion(
    fn: () => Promise<{ ok: true; correoEnviado?: boolean } | { ok: false; mensaje: string }>,
  ) {
    setFallo(null);
    setAviso(null);
    setOcupada(true);
    iniciar(async () => {
      const resultado = await fn();
      setAbierta(null);
      if (!resultado.ok) setFallo(resultado.mensaje);
      // La reserva quedó: esto no es un error, es una cortesía que no llegó
      // (PRD-0019 §8.6). Por eso va aparte del mensaje de fallo.
      else if (resultado.correoEnviado === false) {
        setAviso(
          "Reservaste, pero no pudimos mandarte el comprobante por correo. Tu clase está igual de reservada y lo reintentamos.",
        );
      }
      setOcupada(false);
    });
  }

  const estado = abierta ? estadoParaAlumna(abierta, saldo) : null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="xo-eyebrow mr-2 text-xo-gris">Profesora</span>
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
        <p role="alert" className="mt-6 border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}

      {/* No es un error: la operación salió bien y el correo no. Va en gris y
          sin `role="alert"` justamente por eso (PRD-0019 §8.6). */}
      {aviso ? (
        <p role="status" className="mt-6 text-sm leading-relaxed text-xo-gris">
          {aviso}
        </p>
      ) : null}

      <GrillaCalendario
        clases={clases}
        hoy={hoy}
        tema="claro"
        marca={profesora ? (c) => c.profesoraSlug === profesora : undefined}
        pie={
          saldo === 0
            ? "Cada línea es media hora. No te quedan clases: puedes mirar el calendario, y para reservar primero compra."
            : "Cada línea es media hora. Toca una clase para ver el detalle y reservarla."
        }
        bloque={(clase, ubicacion) => (
          <BloqueAlumna
            clase={clase}
            ubicacion={ubicacion}
            estado={estadoParaAlumna(clase, saldo)}
            resalte={destaque(clase.profesoraSlug, profesora)}
            onAbrir={() => {
              setFallo(null);
              setAviso(null);
              setAbierta(clase);
            }}
          />
        )}
      />

      <dialog
        ref={dialogo}
        aria-labelledby="titulo-clase"
        onClose={() => setAbierta(null)}
        className="m-auto w-[calc(100%-2rem)] max-w-md rounded-lg bg-xo-blanco p-6 text-xo-negro backdrop:bg-xo-negro/60 sm:p-8"
      >
        {abierta && estado ? (
          <>
            <p className="xo-eyebrow text-xo-gris">{diaLegible(abierta.inicio)}</p>
            <h2 id="titulo-clase" className="mt-2 font-display text-3xl leading-none text-xo-negro">
              {abierta.especial ? abierta.especial.titulo : abierta.cursoNombre}
            </h2>

            <dl className="mt-6 divide-y divide-xo-negro/10 border-y border-xo-negro/10 text-sm">
              <Fila etiqueta="Horario" valor={rangoHorario(abierta.inicio, abierta.fin)} />
              <Fila etiqueta="Profesora" valor={abierta.profesoraNombre} />
              <Fila etiqueta="Dónde" valor={`${abierta.sedeNombre}, ${abierta.sedeComuna}`} />
              {abierta.especial ? (
                <Fila
                  etiqueta="Precio"
                  valor={abierta.especial.precioClp !== null ? clp(abierta.especial.precioClp) : "En su página"}
                />
              ) : (
                <Fila
                  etiqueta="Lugares"
                  valor={
                    lugaresLibres(abierta) === 0
                      ? "Llena"
                      : `Quedan ${lugaresLibres(abierta)} de ${abierta.cupoMaximo}`
                  }
                />
              )}
            </dl>

            <Accion
              estado={estado}
              clase={abierta}
              saldo={saldo}
              ocupada={ocupada}
              onReservar={() => accion(() => reservarClase(abierta.id))}
              onCancelar={() => accion(() => cancelarReserva(abierta.reservaId as string))}
            />

            <button
              ref={volver}
              type="button"
              onClick={() => setAbierta(null)}
              className="xo-eyebrow mt-3 rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro transition-colors hover:border-xo-negro/50"
            >
              Volver
            </button>
          </>
        ) : null}
      </dialog>
    </div>
  );
}

/**
 * Una clase en la grilla. Lo que dice va por orden de importancia, porque lo
 * que no cabe se corta por abajo: nombre, luego hora y su estado —lugares,
 * "Llena" o "Reservada"—, luego profesora y, si hay alto, sala.
 */
function BloqueAlumna({
  clase,
  ubicacion,
  estado,
  resalte,
  onAbrir,
}: {
  clase: ClaseDelCalendario;
  ubicacion: Ubicacion;
  estado: EstadoParaAlumna;
  resalte: Destaque;
  onAbrir: () => void;
}) {
  const libres = lugaresLibres(clase);
  const mia = estado === "reservada";

  // Una sola fuente de colores por caso: fondo, texto principal y secundario
  // van juntos para que el contraste se pueda razonar —y medir— de a uno.
  const c = mia
    ? { caja: "border-xo-negro bg-xo-negro", texto: "text-xo-blanco", sub: "text-xo-rosa-claro" }
    : resalte === "destacada"
      ? { caja: "border-xo-rosa bg-xo-rosa", texto: "text-xo-negro", sub: "text-xo-negro" }
      : resalte === "atenuada"
        ? { caja: "border-xo-negro/10 bg-xo-blanco", texto: "text-xo-gris", sub: "text-xo-gris" }
        : {
            caja: "border-xo-negro/25 bg-xo-blanco hover:border-xo-negro/60",
            texto: "text-xo-negro",
            sub: "text-xo-gris",
          };

  return (
    <button
      type="button"
      onClick={onAbrir}
      style={ubicacion.style}
      data-estado={estado}
      data-resalte={resalte}
      className={`${ubicacion.className} text-left transition-colors ${c.caja}`}
    >
      <p className={`text-xs leading-tight font-semibold ${c.texto}`}>
        {clase.especial ? clase.especial.titulo : clase.cursoNombre}
      </p>
      <p className="mt-0.5 flex flex-wrap gap-x-2 text-[11px] leading-tight">
        <span className={c.sub}>{rangoHorario(clase.inicio, clase.fin)}</span>
        <span className={`font-semibold ${c.texto}`}>
          {mia
            ? "✦ Reservada"
            : estado === "especial"
              ? "Especial"
              : libres === 0
                ? "Llena"
                : `${libres} ${libres === 1 ? "lugar" : "lugares"}`}
        </span>
      </p>
      <p className={`mt-0.5 text-[11px] leading-tight ${c.sub}`}>{clase.profesoraNombre}</p>
      {ubicacion.tramos > 2 ? (
        <p className={`mt-0.5 text-[11px] leading-tight ${c.sub}`}>{clase.sedeNombre}</p>
      ) : null}
    </button>
  );
}

/** Lo que se puede hacer con esta clase, según su estado. */
function Accion({
  estado,
  clase,
  saldo,
  ocupada,
  onReservar,
  onCancelar,
}: {
  estado: EstadoParaAlumna;
  clase: ClaseDelCalendario;
  saldo: number;
  ocupada: boolean;
  onReservar: () => void;
  onCancelar: () => void;
}) {
  // Una especial suya no se cancela desde acá: soltar el cupo de una especial
  // es otra operación, con sus propias reglas, y vive en Mis reservas.
  if (estado === "reservada" && clase.especial) {
    return (
      <div className="mt-6">
        <p className="text-sm leading-relaxed text-xo-negro">
          <span aria-hidden="true">✦ </span>Esta clase especial ya es tuya.
        </p>
        <Link
          href="/mis-clases"
          className="xo-eyebrow mt-4 inline-flex rounded-full border border-xo-negro px-5 py-3 text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco"
        >
          Verla en Mis reservas
        </Link>
      </div>
    );
  }

  if (estado === "especial" && clase.especial) {
    // Se paga aparte: el botón de reservar con el pack no existe acá, porque
    // la base lo rechazaría (PRD-0018).
    return (
      <div className="mt-6">
        <p className="border-l-2 border-xo-negro pl-4 text-sm leading-relaxed text-xo-negro">
          Es una clase especial: se paga aparte, no con tus clases del pack.
        </p>
        <Link
          href={`/clases-especiales/${clase.especial.slug}`}
          className="xo-eyebrow mt-4 inline-flex rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80"
        >
          Ver la clase especial
        </Link>
      </div>
    );
  }

  if (estado === "reservada") {
    return (
      <div className="mt-6">
        <p className="text-sm leading-relaxed text-xo-negro">
          <span aria-hidden="true">✦ </span>Esta clase ya es tuya. Puedes cancelar hasta 30 minutos
          antes y recuperas la clase.
        </p>
        <button
          type="button"
          disabled={ocupada}
          onClick={onCancelar}
          className="xo-eyebrow mt-4 rounded-full border border-xo-negro px-5 py-3 text-xo-negro transition-colors hover:bg-xo-negro hover:text-xo-blanco disabled:opacity-50"
        >
          {ocupada ? "Cancelando…" : "Cancelar mi reserva"}
        </button>
      </div>
    );
  }

  if (estado === "llena") {
    return (
      <p className="mt-6 border-l-2 border-xo-negro pl-4 text-sm leading-relaxed text-xo-negro">
        Esta clase se llenó. Si alguien cancela, el lugar vuelve a aparecer acá.
      </p>
    );
  }

  if (estado === "sin-saldo") {
    // Lo dice en vez de dejarla apretar: el botón de reservar no existe acá.
    return (
      <div className="mt-6">
        <p className="border-l-2 border-xo-negro pl-4 text-sm leading-relaxed text-xo-negro">
          No te quedan clases para reservar. Compra un pack y vuelve a esta clase.
        </p>
        <Link
          href="/comprar"
          className="xo-eyebrow mt-4 inline-flex rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80"
        >
          Comprar clases
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={ocupada}
        onClick={onReservar}
        className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
      >
        {ocupada ? "Reservando…" : "Reservar esta clase"}
      </button>
      <p className="mt-3 text-sm text-xo-gris">
        Usa 1 de tus {saldo} {saldo === 1 ? "clase" : "clases"}.
      </p>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-xo-gris">{etiqueta}</dt>
      <dd className="text-right text-xo-negro">{valor}</dd>
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
  // El chip elegido usa el mismo rosa con texto negro que sus clases en la
  // grilla: así se lee qué filtro está puesto y a qué corresponde.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={`xo-eyebrow rounded-full border px-4 py-2 transition-colors ${
        activo
          ? "border-xo-rosa bg-xo-rosa text-xo-negro"
          : "border-xo-negro/20 text-xo-gris hover:border-xo-negro/50"
      }`}
    >
      {children}
    </button>
  );
}
