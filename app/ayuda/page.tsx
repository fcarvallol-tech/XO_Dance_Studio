import type { Metadata } from "next";
import Link from "next/link";
import { MarcoSitio } from "@/components/MarcoSitio";
import { PREGUNTAS, pendientes } from "@/lib/ayuda";
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  WHATSAPP_VISIBLE,
  linkWhatsApp,
} from "@/lib/contacto";

/**
 * `/ayuda` — preguntas frecuentes, contacto y reclamos (PRD-0022 §8.1).
 *
 * **Lo legal se enlaza desde acá además de estar en el pie.** El pie es donde se
 * busca lo que uno ya sabe que existe; alguien con un problema entra a Ayuda, y
 * si lo que necesita es la política de privacidad —"¿qué hacen con los datos de
 * mi hija?"— no tiene por qué volver a buscar. Se enlaza, no se duplica.
 */
export const revalidate = 3600;

const TITULO = "Ayuda — XO Dance Studio";
const DESCRIPCION =
  "Cómo funcionan los packs, cómo se paga, qué pasa si no puedes ir, y cómo contactarnos.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/ayuda" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/ayuda",
  },
};

export default function Ayuda() {
  const faltan = pendientes();

  return (
    <MarcoSitio>
      <section className="xo-grain relative px-6 py-20 sm:px-10 sm:py-28">
        <div className="relative mx-auto max-w-3xl">
          <p className="xo-eyebrow text-xo-rosa">Ayuda</p>
          <h1 className="mt-4 font-display text-[clamp(2.5rem,9vw,4.5rem)] leading-[0.9] text-xo-blanco">
            Lo que suelen preguntarnos
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-xo-blanco/75">
            Y si lo tuyo no está acá, escríbenos: contestamos por WhatsApp y por
            Instagram.
          </p>

          {faltan > 0 ? (
            <p className="mt-8 border border-xo-rosa/40 px-5 py-4 text-sm leading-relaxed text-xo-rosa-claro">
              <strong className="font-semibold">
                {faltan} {faltan === 1 ? "respuesta" : "respuestas"} sin completar.
              </strong>{" "}
              Están marcadas abajo y las tiene que escribir Carla. No publicar
              así.
            </p>
          ) : null}

          {PREGUNTAS.map((bloque) => (
            <div key={bloque.titulo} className="mt-14">
              <h2 className="font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-none text-xo-rosa-claro">
                {bloque.titulo}
              </h2>

              <dl className="mt-6 divide-y divide-xo-blanco/15 border-y border-xo-blanco/15">
                {bloque.preguntas.map((p) => (
                  <div key={p.pregunta} className="py-6">
                    <dt className="text-lg font-semibold text-xo-blanco">
                      {p.pregunta}
                    </dt>
                    <dd
                      className={`mt-2 leading-relaxed ${
                        p.porConfirmar ? "text-xo-rosa-claro" : "text-xo-blanco/80"
                      }`}
                    >
                      {p.porConfirmar ? (
                        <span className="xo-eyebrow mr-2 text-xo-rosa">Falta</span>
                      ) : null}
                      {p.respuesta}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}

          {/* Contacto */}
          <h2 className="mt-16 font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-none text-xo-rosa-claro">
            Escríbenos
          </h2>
          <ul className="mt-6 space-y-4 text-lg">
            <li>
              <a
                href={linkWhatsApp("Hola! Tengo una duda 🌸")}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xo-rosa underline underline-offset-4"
              >
                WhatsApp {WHATSAPP_VISIBLE}
              </a>
              <span className="block text-sm text-xo-blanco/60">
                Es el más rápido.
              </span>
            </li>
            <li>
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xo-rosa underline underline-offset-4"
              >
                Instagram {INSTAGRAM_HANDLE}
              </a>
              <span className="block text-sm text-xo-blanco/60">
                Por mensaje directo.
              </span>
            </li>
          </ul>

          {/* Reclamos */}
          <h2 className="mt-16 font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-none text-xo-rosa-claro">
            Si algo salió mal
          </h2>
          <div className="mt-6 space-y-5 leading-relaxed text-xo-blanco/80">
            <p>
              Si tuviste un problema con una clase, con un pago o con cualquier
              cosa de la academia, queremos saberlo. No hay formulario: nos
              escribes por WhatsApp con la palabra{" "}
              <strong className="font-semibold text-xo-blanco">reclamo</strong> y
              lo tomamos como tal.
            </p>
            <p>Cuéntanos qué pasó, cuándo, y qué esperabas que pasara.</p>
            <p className="border border-xo-rosa/40 px-5 py-4 text-sm text-xo-rosa-claro">
              <span className="xo-eyebrow mr-2 text-xo-rosa">Falta</span>
              PENDIENTE: en cuántos días hábiles nos comprometemos a responder un
              reclamo. Sin ese plazo, esta sección promete menos de lo que
              debería.
            </p>
            <p>
              Si el problema es con un cobro, escríbenos igual: las devoluciones
              las resolvemos caso a caso y siempre las registra una persona.
            </p>
          </div>

          {/* Lo legal, enlazado y no duplicado */}
          <h2 className="mt-16 font-display text-[clamp(1.75rem,5vw,2.25rem)] leading-none text-xo-rosa-claro">
            Lo legal
          </h2>
          <ul className="mt-6 space-y-3 text-lg">
            <li>
              <Link
                href="/privacidad"
                className="text-xo-rosa underline underline-offset-4"
              >
                Política de Privacidad
              </Link>
              <span className="block text-sm text-xo-blanco/60">
                Qué datos guardamos, para qué, y qué puedes pedirnos.
              </span>
            </li>
            <li>
              <Link
                href="/terminos"
                className="text-xo-rosa underline underline-offset-4"
              >
                Condiciones del Servicio
              </Link>
              <span className="block text-sm text-xo-blanco/60">
                Cómo funcionan los packs, las reservas y las cancelaciones.
              </span>
            </li>
          </ul>
        </div>
      </section>
    </MarcoSitio>
  );
}
