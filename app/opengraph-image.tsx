import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { INICIO_CLASES, UBICACION } from "@/lib/contacto";

// El link se comparte por WhatsApp e Instagram: la preview es la primera
// impresión de la marca. Se genera en build, no en cada request.
export const alt = "XO Dance Studio — academia de baile en Providencia y Las Condes";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [bebas, logo] = await Promise.all([
    readFile(join(process.cwd(), "fuentes/BebasNeue-Regular.ttf")),
    readFile(join(process.cwd(), "public/logo-xo.png")),
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
          height={96}
          width={145}
        />

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 132,
              lineHeight: 0.85,
              color: "#F7ADBF",
              letterSpacing: "0.02em",
            }}
          >
            ACÁ NADIE
          </div>
          <div
            style={{
              fontSize: 132,
              lineHeight: 0.85,
              color: "#F7ADBF",
              letterSpacing: "0.02em",
            }}
          >
            BAILA SOLA
          </div>
        </div>

        {/* El separador va como rombo dibujado: Bebas no trae el glifo ✦. */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            fontSize: 30,
            color: "#F2D0DC",
            letterSpacing: "0.14em",
          }}
        >
          {INICIO_CLASES.toUpperCase()}
          <div
            style={{
              width: 10,
              height: 10,
              margin: "0 22px",
              backgroundColor: "#F7ADBF",
              transform: "rotate(45deg)",
            }}
          />
          {UBICACION.toUpperCase()}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Bebas", data: bebas, style: "normal", weight: 400 }],
    },
  );
}
