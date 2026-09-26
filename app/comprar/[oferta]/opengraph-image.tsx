import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { porClaseDeOferta } from "@/lib/dominio/ofertas";
import { resolverOferta } from "@/lib/ofertas-consultas";
import { clp } from "@/lib/planes";

/**
 * La vista previa del link cuando se pega en un DM o en WhatsApp.
 *
 * Es la mitad del punto de este PRD: un link que se comparte y no muestra qué se
 * compra ni cuánto cuesta obliga a explicarlo otra vez por escrito, que es
 * justamente lo que se quería evitar.
 */
export const alt = "Comprar clases en XO Dance Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ImagenDeOferta({
  params,
}: {
  params: Promise<{ oferta: string }>;
}) {
  const { oferta: slug } = await params;
  const [bebas, logo, oferta] = await Promise.all([
    readFile(join(process.cwd(), "fuentes/BebasNeue-Regular.ttf")),
    readFile(join(process.cwd(), "public/logo-xo.png")),
    resolverOferta(slug),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#1A1A1A",
          padding: "64px 72px",
          fontFamily: "Bebas",
        }}
      >
        <img
          src={`data:image/png;base64,${logo.toString("base64")}`}
          alt=""
          height={72}
          width={109}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 30, color: "#F2D0DC", letterSpacing: "0.14em" }}>
            {oferta?.vigenteHasta ? "PROMOCIÓN" : "PACK DE CLASES"}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 96,
              lineHeight: 0.95,
              color: "#F7F7F7",
              marginTop: 16,
            }}
          >
            {(oferta?.titulo ?? "Comprar clases").toUpperCase()}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 120,
              lineHeight: 1,
              color: "#F7ADBF",
              marginTop: 12,
            }}
          >
            {oferta ? clp(oferta.precioClp) : ""}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 30, color: "#F2D0DC", letterSpacing: "0.1em" }}>
          {oferta
            ? `${clp(porClaseDeOferta(oferta))} POR CLASE · ${oferta.vigenciaDias} DÍAS PARA USARLAS`
            : "XO DANCE STUDIO"}
        </div>
      </div>
    ),
    { ...size, fonts: [{ name: "Bebas", data: bebas, style: "normal", weight: 400 }] },
  );
}
