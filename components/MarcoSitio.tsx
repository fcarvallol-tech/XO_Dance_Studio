import { BarraSitio } from "./BarraSitio";
import { Footer } from "./Footer";

/**
 * El marco de todas las páginas públicas: una barra, un pie.
 *
 * Antes había **tres** cabeceras distintas —la de la landing, la de las páginas
 * públicas nuevas y la del perfil de profesora—, cada una con su propio logo y
 * su propia acción a la derecha. Con siete páginas eso deja de ser una
 * duplicación tolerable y pasa a ser tres sitios que se parecen.
 *
 * **El `pt` de `<main>` es lo que hace posible el bulto del logo.** La barra
 * baja con el logo para formar una sola pieza, y sin este espacio ese bulto
 * taparía lo primero de cada página. Vive acá y no en cada página a propósito:
 * un margen repetido en siete archivos es uno que en el octavo se olvida.
 */
export function MarcoSitio({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BarraSitio />
      <main id="contenido" className="pt-14 sm:pt-24">
        {children}
      </main>
      <Footer />
    </>
  );
}
