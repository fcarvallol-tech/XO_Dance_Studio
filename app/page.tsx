import { Suspense } from "react";
import { AnclasViejas } from "@/components/AnclasViejas";
import { CaminosPortada } from "@/components/CaminosPortada";
import { Hero } from "@/components/Hero";
import { MarcoSitio } from "@/components/MarcoSitio";
import { ProfesorasPortada } from "@/components/ProfesorasPortada";
import { getCatalogoPublico } from "@/lib/catalogo-consultas";

/**
 * La portada, **mínima** desde PRD-0022: el hero con el eslogan y los packs.
 *
 * Todo lo demás se mudó a su página —profesoras, sedes, cursos, qué es XO— y la
 * razón es la que dio Felipe: **no abrumar con información mezclada**. Quien
 * llega ya sabe qué es XO, porque viene de Instagram; lo que necesita es
 * encontrar rápido lo que vino a hacer.
 *
 * Se lee con el cliente público, sin cookies, así que sigue siendo estática.
 */
export const revalidate = 3600;

export default async function Home() {
  const { profesoras } = await getCatalogoPublico();

  return (
    <MarcoSitio>
      {/* Rescata /#planes y compañía, que siguen publicados en Instagram.
          Aislado para no arrastrar la portada fuera del prerender. */}
      <Suspense fallback={null}>
        <AnclasViejas />
      </Suspense>

      <Hero />
      {/* La alternancia de fondos: el hero negro, los caminos en rosado y las
          profes de vuelta en negro. Cada corte marca que cambia el tema, y el
          pie cierra en negro. Sobre el rosado todo el texto es negro: `xo-rosa`
          sobre claro da 1.7:1 y `BRAND.md` lo prohíbe para texto. */}
      <CaminosPortada />
      <ProfesorasPortada profesoras={profesoras} />
    </MarcoSitio>
  );
}
