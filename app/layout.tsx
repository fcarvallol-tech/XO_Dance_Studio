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

const SITIO = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const TITULO = "XO Dance Studio — Baile urbano femenino en Las Condes";
const DESCRIPCION =
  "Academia de baile urbano femenino en Las Condes. Kids, Teens, Girly y K-Pop, con cinco profes y grupos chicos. Las clases parten en septiembre y la primera es gratis.";

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
