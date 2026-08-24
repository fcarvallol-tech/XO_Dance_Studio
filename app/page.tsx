import { Suspense } from "react";
import { Barra } from "@/components/Barra";
import { ClaseDePrueba } from "@/components/ClaseDePrueba";
import { Cursos } from "@/components/Cursos";
import { Footer } from "@/components/Footer";
import { Formulario } from "@/components/Formulario";
import { Hero } from "@/components/Hero";
import { Lineup } from "@/components/Lineup";
import { PreseleccionPorUrl } from "@/components/PreseleccionPorUrl";
import { QueEsXo } from "@/components/QueEsXo";
import { SeleccionProvider } from "@/components/Seleccion";

export default function Home() {
  return (
    <SeleccionProvider>
      {/* Lee ?profesora= de la URL. Aislado para no arrastrar la página
          entera fuera del prerender estático. */}
      <Suspense fallback={null}>
        <PreseleccionPorUrl />
      </Suspense>

      <Barra />
      <main id="contenido">
        <Hero />
        <QueEsXo />
        <Lineup />
        <Cursos />
        <ClaseDePrueba />
        <Formulario />
      </main>
      <Footer />
    </SeleccionProvider>
  );
}
