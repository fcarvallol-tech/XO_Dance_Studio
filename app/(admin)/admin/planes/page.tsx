import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { CopiarLink } from "@/components/CopiarLink";
import { requiereNivel } from "@/lib/sesion";
import { porClaseDeOferta } from "@/lib/dominio/ofertas";
import { getOfertas } from "@/lib/ofertas-consultas";
import { clp } from "@/lib/planes";
import { sitio } from "@/lib/sitio";

export const metadata: Metadata = {
  title: "Planes y links — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * Los packs con su link para compartir (PRD-0020 §3.7).
 *
 * El link es lo único que esta página agrega hoy: los precios se editan en el
 * Table Editor hasta que exista PRD-0012. Cuando exista, es acá.
 */
export default async function Planes() {
  await requiereNivel("admin", "admin");
  const ofertas = await getOfertas();
  const base = sitio();

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Planes y links"
        bajada="El link de cada pack, para pegarlo en un DM. Se abre sin cuenta, muestra qué se compra y pide entrar recién al transferir."
      />

      <ul className="divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        {ofertas.map((oferta) => (
          <li key={oferta.slug} className="flex flex-wrap justify-between gap-4 py-5">
            <div>
              <p className="font-semibold text-xo-negro">
                {oferta.titulo} · {clp(oferta.precioClp)}
                {oferta.precioNormalClp !== null ? (
                  <span className="ml-2 font-normal text-xo-gris">
                    antes <s>{clp(oferta.precioNormalClp)}</s>
                    {oferta.vigenteHasta ? ` · hasta el ${oferta.vigenteHasta}` : ""}
                  </span>
                ) : null}
              </p>
              <p className="mt-1 text-sm text-xo-gris">
                {clp(porClaseDeOferta(oferta))} por clase · {oferta.vigenciaDias}{" "}
                días para usarlas
              </p>
              <p className="mt-1 text-sm break-all text-xo-gris">
                {base}/comprar/{oferta.slug}
              </p>
            </div>

            <div className="self-center">
              <CopiarLink url={`${base}/comprar/${oferta.slug}`} />
            </div>
          </li>
        ))}
      </ul>

      <p className="mt-10 max-w-xl text-sm leading-relaxed text-xo-gris">
        Los precios y las promociones se editan por ahora en el Table Editor de
        Supabase, en la tabla <code>planes</code>. El link no cambia cuando cambia
        el precio: muestra siempre el vigente al abrirlo.
      </p>
    </>
  );
}
