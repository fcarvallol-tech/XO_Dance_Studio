"use client";

import { useEffect, useState } from "react";
import { urlDeEmbed } from "@/lib/dominio/especiales";

/**
 * El Reel de la coreografía, **detrás de una fachada**.
 *
 * Antes de que la persona toque, en la página no existe nada de Instagram: ni
 * el iframe, ni `embed.js` —que no se usa nunca—, ni una imagen. Lo que se ve
 * es nuestra portada y un botón que dice lo que va a pasar.
 *
 * Por qué no es una optimización de carga (PRD-0018 §8.7): el primer request a
 * `/embed/` responde con `Set-Cookie: mid=…` de 400 días, incluso para un
 * código que no existe. O sea que **montar el iframe ya deja una cookie de
 * terceros**, sin que nadie haya apretado play. El toque es el consentimiento,
 * y `/privacidad` §9 lo dice con todas sus letras.
 *
 * Tampoco se carga el script de Instagram: lo único que hace `embed.js` es
 * armar este mismo iframe y escuchar un `MEASURE` con la altura. Las dos cosas
 * caben acá, sin un byte de JavaScript de Meta en nuestro origen.
 */
export function ReelFachada({
  codigo,
  portadaUrl,
  titulo,
}: {
  codigo: string | null;
  portadaUrl: string | null;
  titulo: string;
}) {
  const [montado, setMontado] = useState(false);
  const [altura, setAltura] = useState<number | null>(null);

  // El mismo mensaje que escucha embed.js. Si Instagram lo cambia, queda la
  // proporción fija de abajo, que es el fallback y no un caso raro.
  useEffect(() => {
    if (!montado) return;

    function alMedir(evento: MessageEvent) {
      if (evento.origin !== "https://www.instagram.com") return;
      try {
        const dato =
          typeof evento.data === "string" ? JSON.parse(evento.data) : evento.data;
        if (dato?.type !== "MEASURE") return;
        const alto = Number(dato?.details?.height);
        if (Number.isFinite(alto) && alto > 200 && alto < 2400) setAltura(alto);
      } catch {
        // Un mensaje que no es JSON no es asunto nuestro.
      }
    }

    window.addEventListener("message", alMedir);
    return () => window.removeEventListener("message", alMedir);
  }, [montado]);

  if (!codigo) {
    return portadaUrl ? (
      <Portada url={portadaUrl} titulo={titulo} />
    ) : (
      <SinPortada />
    );
  }

  if (!montado) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setMontado(true)}
          className="group block w-full cursor-pointer text-left"
        >
          <span className="relative block overflow-hidden bg-xo-negro-alt">
            {portadaUrl ? (
              <Portada url={portadaUrl} titulo={titulo} />
            ) : (
              <SinPortada />
            )}

            <span className="absolute inset-0 flex items-end justify-center bg-xo-negro/30 p-5 transition-colors group-hover:bg-xo-negro/45">
              <span className="xo-eyebrow inline-flex items-center rounded-full bg-xo-rosa px-5 py-3 text-xo-negro transition-colors group-hover:bg-xo-rosa-claro">
                Ver el Reel en Instagram
              </span>
            </span>
          </span>
        </button>

        <p className="mt-3 text-sm text-xo-blanco/60">
          Se carga desde Instagram.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div
        className="overflow-hidden bg-xo-negro-alt"
        style={altura ? { height: `${altura}px` } : undefined}
      >
        <iframe
          src={urlDeEmbed(codigo)}
          title={`Reel de ${titulo} en Instagram`}
          allow="encrypted-media"
          allowFullScreen
          scrolling="no"
          className={`w-full border-0 ${altura ? "h-full" : "aspect-[9/16]"}`}
        />
      </div>
      <p className="mt-3 text-sm text-xo-blanco/60">
        Se está cargando desde Instagram.
      </p>
    </div>
  );
}

/**
 * `<img>` y no `next/image` a propósito: la URL viene firmada, con un token que
 * cambia en cada renderizado, así que el optimizador no podría cachear nada y
 * además habría que declararle el host del bucket.
 */
function Portada({ url, titulo }: { url: string; titulo: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`Portada de ${titulo}`}
      className="block aspect-[4/5] w-full object-cover"
      loading="lazy"
    />
  );
}

/** Placeholder evidente: falta la foto, y se nota. No se rellena con nada. */
function SinPortada() {
  return (
    <span className="flex aspect-[4/5] w-full items-center justify-center border border-dashed border-xo-blanco/25 bg-xo-negro-alt">
      <span className="xo-eyebrow text-xo-blanco/50">Falta la portada</span>
    </span>
  );
}
