import type { Metadata, Viewport } from "next";
import { Bebas_Neue, Cormorant_Garamond, Montserrat } from "next/font/google";
import "./globals.css";

// Bebas: la voz de la página. Un solo peso, siempre en mayúsculas.
const bebas = Bebas_Neue({
  variable: "--font-bebas",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

// Cormorant: el contrapunto elegante. Se usa en itálica y con moderación.
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  display: "swap",
});

// Montserrat: neutra a propósito. Cuerpo, formularios y datos prácticos.
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  display: "swap",
});

/**
 * De dónde sale `metadataBase`, en orden.
 *
 * El fallback a localhost solo, sin la variable puesta, dejó el Open Graph
 * roto 18 días sin que nadie se enterara: la vista previa al compartir el link
 * apuntaba a una máquina que no existe. `VERCEL_PROJECT_PRODUCTION_URL` es
 * variable de sistema y siempre está en Vercel, así que el peor caso pasa de
 * "URL inválida en producción" a "el dominio de Vercel en vez del propio".
 *
 * Se descartan las cadenas vacías: una variable creada y sin valor es
 * exactamente el escenario del incidente, y `??` la dejaría pasar.
 */
function sitio(): string {
  const propio = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (propio) return propio;

  // Viene sin protocolo, por diseño de Vercel.
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercel) return `https://${vercel}`;

  return "http://localhost:3000";
}

const SITIO = sitio();

const TITULO = "XO Dance Studio — Academia de baile en Las Condes";
const DESCRIPCION =
  "Academia de baile en Las Condes. Cinco profes, grupos chicos y un lugar donde bailar también significa sentirte parte. Las clases parten en septiembre.";

export const metadata: Metadata = {
  metadataBase: new URL(SITIO),
  title: TITULO,
  description: DESCRIPCION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "es_CL",
    siteName: "XO Dance Studio",
    title: TITULO,
    description: DESCRIPCION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO,
    description: DESCRIPCION,
  },
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es-CL"
      className={`${bebas.variable} ${cormorant.variable} ${montserrat.variable} h-full`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
