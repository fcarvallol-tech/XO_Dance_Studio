import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "XO Dance Studio — Baile urbano femenino en Las Condes",
  description:
    "Academia de baile urbano femenino en Las Condes. Kids, Teens, Girly y K-Pop. Las clases parten en septiembre y tu primera clase es gratis.",
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
