import { Suspense } from "react";
import { Barra } from "@/components/Barra";
import { ClaseDePrueba } from "@/components/ClaseDePrueba";
import { Cursos } from "@/components/Cursos";
import { Footer } from "@/components/Footer";
import { Formulario } from "@/components/Formulario";
import { Hero } from "@/components/Hero";
import { Lineup } from "@/components/Lineup";
import { Planes } from "@/components/Planes";
import { PreseleccionPorUrl } from "@/components/PreseleccionPorUrl";
import { QueEsXo } from "@/components/QueEsXo";
import { SeleccionProvider } from "@/components/Seleccion";
import { getCatalogoPublico } from "@/lib/catalogo-consultas";

/**
 * La landing sigue siendo estática. El catálogo se lee con el cliente público,
 * que no toca cookies, así que la página se prerenderiza igual que antes; lo
 * que cambia es cada cuánto se regenera.
 *
 * Una hora es la red de seguridad. El camino normal es el webhook de Supabase
 * contra /api/revalidar, que la deja fresca en segundos. Ver PRD-0015 §5.
 */
export const revalidate = 3600;

export default async function Home() {
  const { cursos, profesoras } = await getCatalogoPublico();

  return (
    <SeleccionProvider>
      {/* Lee ?profesora= de la URL. Aislado para no arrastrar la página
          entera fuera del prerender estático. */}
      <Suspense fallback={null}>
        <PreseleccionPorUrl slugsValidos={profesoras.map((p) => p.slug)} />
      </Suspense>

      <Barra />
      <main id="contenido">
        <Hero />
        <QueEsXo />
        <Lineup cursos={cursos} profesoras={profesoras} />
        <Cursos cursos={cursos} profesoras={profesoras} />
        <Planes />
        <ClaseDePrueba />
        <Formulario cursos={cursos} profesoras={profesoras} />
      </main>
      <Footer />
    </SeleccionProvider>
  );
}
