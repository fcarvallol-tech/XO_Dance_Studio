import type { Metadata } from "next";
import Link from "next/link";
import {
  Correo,
  Destacado,
  Fuerte,
  Item,
  Lista,
  P,
  PaginaLegal,
  Seccion,
} from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Condiciones del Servicio — XO Dance Studio",
  description:
    "Condiciones de uso del sitio de XO Dance Studio: cuentas, precios, clases, imagen y propiedad intelectual.",
  alternates: { canonical: "/terminos" },
};

export default function Terminos() {
  return (
    <PaginaLegal
      titulo="Condiciones del Servicio"
      actualizado="28 de agosto de 2026"
    >
      <Seccion numero={1} titulo="Sobre estas condiciones">
        <P>
          Estas condiciones regulan el uso del sitio web de XO Dance Studio SpA,
          academia de baile ubicada en Las Condes, Santiago de Chile. Al usar el
          sitio o crear una cuenta, aceptas lo que sigue.
        </P>
        <P>
          <Fuerte>Contacto:</Fuerte> <Correo />
        </P>

        <Destacado>
          <p className="leading-[1.7] text-xo-negro/85">
            <Fuerte>Alcance actual.</Fuerte> Hoy el sitio permite conocer la
            academia, dejar tus datos para tomar clases y crear una cuenta.{" "}
            <Fuerte>
              La contratación y el pago de clases se hacen por WhatsApp o
              presencialmente
            </Fuerte>
            , no a través del sitio. Cuando incorporemos compra y reserva en
            línea, ampliaremos estas condiciones y te avisaremos antes de que
            apliquen.
          </p>
        </Destacado>
      </Seccion>

      <Seccion numero={2} titulo="Qué ofrece el sitio hoy">
        <Lista>
          <Item>
            Información sobre la academia, sus cursos, sus profesoras y sus
            precios
          </Item>
          <Item>Un formulario para dejar tus datos y coordinar una clase</Item>
          <Item>Cuentas de usuaria, para acceder a tu perfil</Item>
        </Lista>
        <P>
          Los horarios, la ubicación exacta y la disponibilidad de cupos se
          informan por WhatsApp.
        </P>
      </Seccion>

      <Seccion numero={3} titulo="Precios">
        <P>
          Los precios publicados están expresados en pesos chilenos e incluyen
          los impuestos que correspondan. Son referenciales y pueden cambiar.
        </P>
        <P>
          Las promociones tienen fecha de término indicada y aplican mientras
          estén vigentes. El precio que rige es el informado al momento de
          contratar.
        </P>
        <P>
          Como la contratación no ocurre en el sitio, la compra se perfecciona
          cuando acordamos contigo el servicio y su pago por los canales de la
          academia.
        </P>
      </Seccion>

      <Seccion numero={4} titulo="Cuentas">
        <Lista>
          <Item>Debes entregar datos veraces y mantenerlos actualizados.</Item>
          <Item>Tu cuenta es personal. No la compartas.</Item>
          <Item>
            El acceso es con tu cuenta de Google o con un enlace enviado a tu
            correo. Eres responsable de mantener seguro el acceso a ese correo.
          </Item>
          <Item>
            <Fuerte>Si eres menor de edad</Fuerte>, necesitas autorización de tu
            madre, padre o apoderado para usar el sitio y para inscribirte en
            clases.
          </Item>
          <Item>
            Podemos suspender o cerrar una cuenta que se use de forma indebida,
            con datos falsos o para perjudicar a otras personas.
          </Item>
        </Lista>
      </Seccion>

      <Seccion numero={5} titulo="Uso del sitio">
        <P>No está permitido usar el sitio para:</P>
        <Lista>
          <Item>Suplantar a otra persona o entregar datos falsos</Item>
          <Item>
            Intentar acceder a información de otras usuarias o a partes
            restringidas del sistema
          </Item>
          <Item>Interferir con el funcionamiento del sitio</Item>
          <Item>Copiar o reutilizar sus contenidos sin autorización</Item>
        </Lista>
      </Seccion>

      <Seccion numero={6} titulo="Clases y seguridad física">
        <P>El baile es actividad física. Al participar en nuestras clases:</P>
        <Lista>
          <Item>
            Declaras estar en condiciones de salud adecuadas para realizar
            actividad física, o contar con autorización médica.
          </Item>
          <Item>
            Debes informarnos de cualquier condición de salud, lesión o
            tratamiento que sea relevante para la práctica segura de la clase,
            incluyendo alergias.
          </Item>
          <Item>
            Si la alumna es menor de edad, esta declaración la hace su
            apoderado.
          </Item>
        </Lista>
        <P>
          XO Dance Studio no se hace responsable de lesiones derivadas de omitir
          información de salud relevante o de no seguir las indicaciones de la
          profesora.
        </P>
      </Seccion>

      <Seccion numero={7} titulo="Imagen">
        <P>
          Durante las clases y eventos podemos tomar fotos y videos con fines de
          difusión.
        </P>
        <P>
          <Fuerte>
            La autorización de uso de imagen es voluntaria, explícita y
            revocable.
          </Fuerte>{" "}
          Si no la otorgas, no publicaremos material donde aparezcas de forma
          identificable. Tratándose de menores, la autorización la da el
          apoderado.
        </P>
        <P>
          Para revocarla, escríbenos a <Correo />.
        </P>
      </Seccion>

      <Seccion numero={8} titulo="Propiedad intelectual">
        <P>
          El nombre XO Dance Studio, su logo, sus textos, fotografías, videos y
          coreografías originales son de propiedad de XO Dance Studio SpA o de
          quienes nos han autorizado su uso. No pueden reproducirse ni usarse
          comercialmente sin autorización escrita.
        </P>
      </Seccion>

      <Seccion numero={9} titulo="Disponibilidad del servicio">
        <P>
          Procuramos que el sitio esté siempre disponible, pero puede haber
          interrupciones por mantenimiento, fallas técnicas o causas fuera de
          nuestro control. No garantizamos disponibilidad ininterrumpida ni nos
          hacemos responsables de perjuicios derivados de una caída del sitio.
        </P>
        <P>
          Los horarios, cursos, profesoras, precios y ubicaciones pueden
          modificarse. Los cambios se informan por los canales de la academia.
        </P>
      </Seccion>

      <Seccion numero={10} titulo="Datos personales">
        <P>
          El tratamiento de tus datos se rige por nuestra{" "}
          <Link
            href="/privacidad"
            className="font-medium text-xo-negro underline underline-offset-4 hover:text-xo-gris"
          >
            Política de Privacidad
          </Link>
          , que forma parte de estas condiciones.
        </P>
      </Seccion>

      <Seccion numero={11} titulo="Cambios">
        <P>
          Podemos modificar estas condiciones. La fecha de la última
          actualización está al inicio. Si el cambio es relevante, te avisaremos
          antes de que aplique.
        </P>
      </Seccion>

      <Seccion numero={12} titulo="Ley aplicable">
        <P>
          Estas condiciones se rigen por la ley chilena. Cualquier controversia
          se somete a los tribunales competentes de Santiago de Chile.
        </P>
        <P>
          Nada en estas condiciones limita los derechos que te otorga la Ley N°
          19.496 sobre Protección de los Derechos de los Consumidores.
        </P>

        <Destacado>
          <p className="leading-[1.7] text-xo-negro">
            <Fuerte>XO Dance Studio SpA</Fuerte> · Las Condes, Santiago de Chile
            · <Correo />
          </p>
        </Destacado>
      </Seccion>
    </PaginaLegal>
  );
}
