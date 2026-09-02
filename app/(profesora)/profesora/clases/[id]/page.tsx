import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { cuandoLegible } from "@/lib/compras";
import { getClase, getInscritas } from "@/lib/profesora-consultas";

export const metadata: Metadata = {
  title: "Una clase que dicto — XO Dance Studio",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ id: string }> };

/**
 * El detalle de una clase: quiénes vienen y cuántas sobre 22.
 *
 * **Solo nombres.** Ni correo, ni teléfono, ni nada más, tampoco para las
 * clases pasadas. No es una decisión de esta pantalla: `inscritas_de_clase`
 * devuelve tres columnas y no hay forma de pedirle otra. Si una profesora
 * necesita contactar a una alumna, pasa por administración.
 */
export default async function DetalleClase({ params }: Props) {
  await requiereNivel("profesora", "profesora");
  const { id } = await params;

  const [clase, inscritas] = await Promise.all([getClase(id), getInscritas(id)]);

  // La base ya rechaza una clase ajena con 42501; esto es para un id que no
  // existe.
  if (!clase.error && !clase.datos) notFound();

  const llena =
    clase.datos && clase.datos.inscritas >= clase.datos.cupoMaximo;

  return (
    <>
      <Link
        href="/profesora/mis-clases"
        className="xo-eyebrow text-xo-gris underline-offset-4 hover:text-xo-negro hover:underline"
      >
        <span aria-hidden="true">← </span>Mis clases
      </Link>

      <div className="mt-6">
        <TituloPortal
          eyebrow={clase.datos ? cuandoLegible(clase.datos.inicio) : "La clase"}
          titulo={clase.datos?.cursoNombre ?? "La clase"}
          bajada={
            clase.datos
              ? `${clase.datos.sedeNombre}, ${clase.datos.sedeComuna}`
              : undefined
          }
        />
      </div>

      <ErrorDeLectura que="esta clase" error={clase.error} />

      {clase.datos?.cancelada ? (
        <p className="mb-8 border-l-2 border-xo-negro py-3 pl-5 text-xo-negro">
          Esta clase está cancelada
          {clase.datos.motivoCancelacion
            ? `: ${clase.datos.motivoCancelacion}`
            : "."}
        </p>
      ) : null}

      {clase.datos?.reemplazo?.cubro ? (
        <p className="mb-8 text-xo-gris">
          <span aria-hidden="true" className="text-xo-negro">
            ✦{" "}
          </span>
          Estás cubriendo a {clase.datos.reemplazo.cubro} en esta clase.
        </p>
      ) : null}

      {clase.datos ? (
        <p className="mb-8 text-lg text-xo-negro">
          <strong className="font-semibold">
            {clase.datos.inscritas}/{clase.datos.cupoMaximo}
          </strong>{" "}
          inscritas{llena ? " · sala llena" : ""}
        </p>
      ) : null}

      <h2 className="xo-eyebrow text-xo-gris">Quiénes vienen</h2>
      <ErrorDeLectura que="la lista de inscritas" error={inscritas.error} />

      {inscritas.error ? null : inscritas.datos.length === 0 ? (
        <p className="mt-3 text-xo-gris">Todavía no hay nadie inscrita.</p>
      ) : (
        <ol className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10">
          {inscritas.datos.map((alumna, indice) => (
            <li key={alumna.reservaId} className="flex gap-4 py-3">
              <span className="w-6 text-sm text-xo-gris">{indice + 1}</span>
              <span className="text-xo-negro">{alumna.nombre}</span>
            </li>
          ))}
        </ol>
      )}

      <p className="mt-8 max-w-prose text-sm leading-relaxed text-xo-gris">
        Si necesitas contactar a alguna, escríbele a administración: desde acá
        solo se ven los nombres.
      </p>
    </>
  );
}
