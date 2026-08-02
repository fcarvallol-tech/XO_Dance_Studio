import { Barra } from "@/components/Barra";
import { ClaseDePrueba } from "@/components/ClaseDePrueba";
import { Cursos } from "@/components/Cursos";
import { Footer } from "@/components/Footer";
import { Formulario } from "@/components/Formulario";
import { Hero } from "@/components/Hero";
import { Lineup } from "@/components/Lineup";
import { QueEsXo } from "@/components/QueEsXo";
import { SeleccionProvider } from "@/components/Seleccion";

export default function Home() {
  return (
    <SeleccionProvider>
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
