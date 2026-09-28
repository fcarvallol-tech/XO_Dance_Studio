import { Suspense } from "react";
import { AnclasViejas } from "@/components/AnclasViejas";
import { Hero } from "@/components/Hero";
import { MarcoSitio } from "@/components/MarcoSitio";
import { Planes } from "@/components/Planes";
import { getDesdePrecioEspecial } from "@/lib/especiales-consultas";
import { getPlanes } from "@/lib/planes-consultas";

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
  const [planes, desdeEspecial] = await Promise.all([
    getPlanes(),
    getDesdePrecioEspecial(),
  ]);

  return (
    <MarcoSitio>
      {/* Rescata /#planes y compañía, que siguen publicados en Instagram.
          Aislado para no arrastrar la portada fuera del prerender. */}
      <Suspense fallback={null}>
        <AnclasViejas />
      </Suspense>

      <Hero />
      <Planes planes={planes} desdeEspecial={desdeEspecial} />
    </MarcoSitio>
  );
}
