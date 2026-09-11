import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { cuandoLegible } from "@/lib/compras";
import {
  getEspecialPorSlug,
  getPortadaComoDataUri,
} from "@/lib/especiales-consultas";
import { clp } from "@/lib/planes";

/**
 * La vista previa del link cuando se pega en WhatsApp o Instagram.
 *
 * Quien arma esa vista previa lee **nuestro** HTML: no ejecuta JavaScript ni
 * mira dentro de un iframe, así que el Reel no aporta nada acá. Por eso la
 * portada propia es obligatoria (PRD-0018 §8.7) y por eso esta imagen se
 * compone en el servidor, con la portada descargada por la service role.
 *
 * Si la portada falta, sale la ficha sola en negro antes que ninguna imagen:
 * un link sin foto es feo, uno con una foto ajena es un problema.
 */
export const alt = "Clase especial de XO Dance Studio";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ImagenDeEspecial({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [bebas, dato, portada] = await Promise.all([
    readFile(join(process.cwd(), "fuentes/BebasNeue-Regular.ttf")),
    getEspecialPorSlug(slug),
    getPortadaComoDataUri(slug),
  ]);

  const especial = dato?.especial;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          backgroundColor: "#1A1A1A",
          fontFamily: "Bebas",
        }}
      >
        {portada ? (
          <img
            src={portada}
            alt=""
            width={472}
            height={630}
            style={{ width: 472, height: 630, objectFit: "cover" }}
          />
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            padding: "64px 64px 64px 56px",
          }}
        >
          <div style={{ fontSize: 28, color: "#F7ADBF", letterSpacing: "0.16em" }}>
            CLASE ESPECIAL
          </div>

          <div
            style={{
              display: "flex",
              fontSize: especial && especial.titulo.length > 22 ? 76 : 100,
              lineHeight: 0.9,
              color: "#F7F7F7",
              marginTop: 24,
            }}
          >
            {especial?.titulo.toUpperCase() ?? "CLASE ESPECIAL"}
          </div>

          {especial ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                marginTop: 36,
                fontSize: 30,
                color: "#F2D0DC",
                letterSpacing: "0.08em",
              }}
            >
              <div>CON {especial.profesora.toUpperCase()}</div>
              <div style={{ marginTop: 10 }}>
                {cuandoLegible(especial.inicio).toUpperCase()}
              </div>
              <div style={{ marginTop: 10, color: "#F7ADBF" }}>
                {especial.sede.toUpperCase()} · {clp(especial.precioClp)}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Bebas", data: bebas, style: "normal", weight: 400 }],
    },
  );
}
