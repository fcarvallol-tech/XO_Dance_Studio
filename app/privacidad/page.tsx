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
  Sub,
} from "@/components/PaginaLegal";

export const metadata: Metadata = {
  title: "Política de Privacidad — XO Dance Studio",
  description:
    "Qué datos recoge XO Dance Studio, para qué los usa, con quién los comparte y qué derechos tienes sobre ellos. Ley N° 19.628 y Ley N° 21.719.",
  alternates: { canonical: "/privacidad" },
};

export default function Privacidad() {
  return (
    <PaginaLegal
      titulo="Política de Privacidad"
      actualizado="28 de agosto de 2026"
    >
      <Seccion numero={1} titulo="Quiénes somos">
        <P>
          XO Dance Studio SpA (&quot;XO Dance Studio&quot;,
          &quot;nosotras&quot;) es una academia de baile con salas en Providencia
          y Las Condes, Santiago de Chile. Somos responsables del tratamiento de los datos
          personales que recogemos a través de este sitio.
        </P>
        <P>
          <Fuerte>Contacto para temas de datos personales:</Fuerte> <Correo />
        </P>
        <P>
          Esta política explica qué datos recogemos, para qué los usamos, con
          quién los compartimos y qué derechos tienes sobre ellos. Se rige por
          la Ley N° 19.628 sobre Protección de la Vida Privada y su reforma, la
          Ley N° 21.719.
        </P>
      </Seccion>

      <Seccion numero={2} titulo="Qué datos recogemos">
        <Sub>2.1 Si nos dejas tus datos para reservar una clase</Sub>
        <P>
          Cuando completas el formulario de contacto del sitio, recogemos:
        </P>
        <Lista>
          <Item>Tu nombre</Item>
          <Item>Tu número de WhatsApp</Item>
          <Item>Si la clase es para ti o para tu hija</Item>
          <Item>
            La edad de la alumna, solo cuando la clase es para una menor
          </Item>
          <Item>La profesora o el curso que te interesa</Item>
          <Item>Desde qué sección del sitio llegaste al formulario</Item>
        </Lista>
        <P>
          Estos datos se usan para contactarte y coordinar tu clase. Al enviar
          el formulario se abre una conversación de WhatsApp con nosotras: esa
          conversación se rige por las condiciones de WhatsApp, que no
          controlamos.
        </P>

        <Sub>2.2 Si creas una cuenta</Sub>
        <P>
          Puedes entrar con tu cuenta de Google o pidiendo un enlace de acceso a
          tu correo. En ambos casos recogemos:
        </P>
        <Lista>
          <Item>Tu correo electrónico</Item>
          <Item>Tu nombre</Item>
          <Item>
            Tu foto de perfil, si entras con Google y la tienes configurada
          </Item>
          <Item>
            Tu número de WhatsApp, que te pedimos al completar el perfil
          </Item>
        </Lista>
        <P>
          <Fuerte>No guardamos contraseñas.</Fuerte> El sistema no las usa: el
          acceso es con Google o con un enlace enviado a tu correo.
        </P>

        <Sub>2.3 Datos de uso del sitio</Sub>
        <P>
          Usamos herramientas de analítica que registran de forma agregada
          cuántas personas visitan el sitio, desde qué país y qué páginas ven.
          Estos datos no se usan para identificarte individualmente.
        </P>
        <P>
          Si en el futuro incorporamos herramientas de analítica más detalladas,
          actualizaremos esta política antes de hacerlo.
        </P>
      </Seccion>

      <Seccion numero={3} titulo="Datos de menores de edad">
        <P>
          Buena parte de nuestras alumnas son menores de edad, así que tratamos
          estos datos con especial cuidado.
        </P>
        <Lista>
          <Item>
            Cuando el formulario indica que la clase es para una hija, pedimos
            únicamente su edad. No pedimos su nombre, su RUT ni ningún otro dato
            en esa etapa.
          </Item>
          <Item>
            Los datos de una menor solo se recogen con conocimiento y
            autorización de su madre, padre o apoderado.
          </Item>
          <Item>
            <Fuerte>El uso de imagen es opcional y explícito.</Fuerte> No
            publicamos fotos ni videos donde aparezca una alumna identificable
            sin autorización previa. Esa autorización se puede revocar en
            cualquier momento escribiéndonos.
          </Item>
          <Item>
            Los datos de menores nunca se publican en el sitio, no aparecen en
            direcciones web ni se comparten con terceros con fines comerciales.
          </Item>
        </Lista>
      </Seccion>

      <Seccion numero={4} titulo="Para qué usamos tus datos">
        <Lista>
          <Item>Contactarte y coordinar clases, horarios y ubicación</Item>
          <Item>Administrar tu cuenta y tus clases</Item>
          <Item>
            Llevar el registro académico y administrativo de la academia
          </Item>
          <Item>Responder tus consultas</Item>
          <Item>Cumplir obligaciones legales y tributarias</Item>
        </Lista>
        <P>
          <Fuerte>
            No vendemos tus datos a nadie, ni los cedemos con fines
            publicitarios.
          </Fuerte>
        </P>
      </Seccion>

      <Seccion numero={5} titulo="Con quién los compartimos">
        <P>
          Para operar usamos proveedores tecnológicos que procesan datos por
          cuenta nuestra:
        </P>

        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[30rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-xo-negro/20">
                <Th>Proveedor</Th>
                <Th>Para qué</Th>
                <Th>Dónde</Th>
              </tr>
            </thead>
            <tbody>
              <Fila
                proveedor="Supabase"
                para="Base de datos y autenticación"
                donde="Servidores fuera de Chile"
              />
              <Fila
                proveedor="Vercel"
                para="Alojamiento del sitio"
                donde="Servidores fuera de Chile"
              />
              <Fila
                proveedor="Google"
                para="Inicio de sesión con cuenta de Google"
                donde="Servidores fuera de Chile"
              />
            </tbody>
          </table>
        </div>

        <P>
          Esto implica que tus datos pueden almacenarse fuera de Chile. Elegimos
          proveedores que ofrecen resguardos de seguridad y confidencialidad
          adecuados.
        </P>
        <P>
          También podemos entregar datos cuando una autoridad competente lo
          requiera legalmente.
        </P>
        <P>
          Nuestras profesoras acceden únicamente a la información necesaria para
          hacer clases: el listado de alumnas de sus cursos.{" "}
          <Fuerte>
            No acceden a datos de contacto, ni a información de pagos, ni a
            antecedentes de salud.
          </Fuerte>
        </P>
      </Seccion>

      <Seccion numero={6} titulo="Cuánto tiempo los conservamos">
        <Lista>
          <Item>
            <Fuerte>
              Datos de contacto de personas que no se inscribieron:
            </Fuerte>{" "}
            hasta 2 años desde el último contacto, para poder retomar la
            conversación.
          </Item>
          <Item>
            <Fuerte>Datos de alumnas y cuentas:</Fuerte> mientras la relación
            esté vigente, y después por el plazo que exijan las obligaciones
            legales y tributarias.
          </Item>
          <Item>
            <Fuerte>Registros de acceso y seguridad:</Fuerte> por períodos
            acotados, con fines de seguridad.
          </Item>
        </Lista>
        <P>
          Puedes pedirnos que eliminemos tus datos antes de esos plazos, salvo
          cuando debamos conservarlos por obligación legal.
        </P>
      </Seccion>

      <Seccion numero={7} titulo="Tus derechos">
        <P>La ley te da derecho a:</P>
        <Lista>
          <Item>
            <Fuerte>Acceder</Fuerte> a los datos que tenemos sobre ti
          </Item>
          <Item>
            <Fuerte>Rectificarlos</Fuerte> si están equivocados o incompletos
          </Item>
          <Item>
            <Fuerte>Eliminarlos</Fuerte>, cuando corresponda
          </Item>
          <Item>
            <Fuerte>Oponerte</Fuerte> a determinados usos
          </Item>
          <Item>
            <Fuerte>Revocar</Fuerte> una autorización que hayas dado, como el
            uso de imagen
          </Item>
        </Lista>
        <P>
          Para ejercerlos, escríbenos a <Correo /> indicando tu nombre y qué
          necesitas. Responderemos en el plazo que establece la ley. Si el
          titular de los datos es una menor, la solicitud la hace su madre,
          padre o apoderado.
        </P>
      </Seccion>

      <Seccion numero={8} titulo="Seguridad">
        <P>
          Aplicamos medidas técnicas para proteger tus datos: el acceso a la
          base está restringido por usuario y por rol, la información sensible
          viaja cifrada, y solo las personas que administran la academia pueden
          ver los datos de contacto.
        </P>
        <P>
          Ningún sistema es completamente invulnerable. Si ocurriera un
          incidente de seguridad que afecte tus datos, te informaremos conforme
          a la ley.
        </P>
      </Seccion>

      <Seccion numero={9} titulo="Cookies y sesión">
        <P>
          Usamos cookies estrictamente necesarias para mantener tu sesión
          iniciada. Sin ellas no es posible acceder a tu cuenta. No usamos
          cookies publicitarias ni de seguimiento entre sitios.
        </P>
      </Seccion>

      <Seccion numero={10} titulo="Cambios a esta política">
        <P>
          Podemos actualizar esta política cuando cambien nuestros servicios o
          la normativa. La fecha de la última actualización está al inicio del
          documento. Si el cambio es relevante, te avisaremos por los canales
          que tengamos contigo.
        </P>
      </Seccion>

      <Seccion numero={11} titulo="Consultas">
        <Destacado>
          <p className="leading-[1.7] text-xo-negro">
            <Correo />
            <br />
            XO Dance Studio SpA · Providencia y Las Condes, Santiago de Chile
          </p>
        </Destacado>
        <P>
          Ver también las{" "}
          <Link
            href="/terminos"
            className="font-medium text-xo-negro underline underline-offset-4 hover:text-xo-gris"
          >
            Condiciones del Servicio
          </Link>
          .
        </P>
      </Seccion>
    </PaginaLegal>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="xo-eyebrow py-3 pr-6 align-bottom text-xo-gris">
      {children}
    </th>
  );
}

function Fila({
  proveedor,
  para,
  donde,
}: {
  proveedor: string;
  para: string;
  donde: string;
}) {
  return (
    <tr className="border-b border-xo-negro/10">
      <td className="py-3 pr-6 font-medium text-xo-negro">{proveedor}</td>
      <td className="py-3 pr-6 text-xo-negro/85">{para}</td>
      <td className="py-3 text-xo-negro/85">{donde}</td>
    </tr>
  );
}
