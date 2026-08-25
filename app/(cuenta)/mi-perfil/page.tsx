import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { NOMBRE_ROL } from "@/lib/roles";
import { requiereSesion } from "@/lib/sesion";
import { WHATSAPP_VISIBLE } from "@/lib/contacto";

export const metadata: Metadata = {
  title: "Mi perfil — XO Dance Studio",
  robots: { index: false, follow: false },
};

export default async function MiPerfil() {
  const perfil = await requiereSesion("cuenta");

  return (
    <>
      <TituloPortal
        eyebrow="Tu cuenta"
        titulo={perfil.nombre ?? "Mi perfil"}
        bajada="Acá van a vivir tus clases y tus reservas. Todavía no existen: por ahora esto solo confirma que tu cuenta quedó creada."
      />

      <dl className="max-w-lg divide-y divide-xo-negro/10 border-y border-xo-negro/10">
        <Dato etiqueta="Nombre" valor={perfil.nombre} />
        <Dato etiqueta="Correo" valor={perfil.email} />
        <Dato
          etiqueta="WhatsApp"
          valor={perfil.telefono ? `+56 9 ${perfil.telefono}` : null}
        />
        <Dato etiqueta="Rol" valor={NOMBRE_ROL[perfil.rol]} />
      </dl>

      <p className="mt-10 max-w-prose text-sm leading-relaxed text-xo-gris">
        ¿Algo mal? Escríbenos a {WHATSAPP_VISIBLE} y lo corregimos.
      </p>
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-6 py-4">
      <dt className="xo-eyebrow pt-1 text-xo-gris">{etiqueta}</dt>
      <dd className={valor ? "text-xo-negro" : "text-xo-gris italic"}>
        {valor ?? "Sin completar"}
      </dd>
    </div>
  );
}
