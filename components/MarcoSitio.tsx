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
 * **El `pt` de `<main>` es lo que hace posible el logo que sobresale.** El logo
 * es más alto que la barra y baja por debajo de ella; sin este espacio, taparía
 * lo primero de cada página. Vive acá y no en cada página a propósito: un margen
 * repetido en siete archivos es un margen que en el octavo se olvida.
 */
export function MarcoSitio({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BarraSitio />
      <main id="contenido" className="pt-10 sm:pt-16">
        {children}
      </main>
      <Footer />
    </>
  );
}
