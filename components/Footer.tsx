import Image from "next/image";
import Link from "next/link";
import {
  INSTAGRAM_HANDLE,
  INSTAGRAM_URL,
  UBICACION,
  WHATSAPP_VISIBLE,
  linkWhatsApp,
} from "@/lib/contacto";

export function Footer() {
  return (
    <footer className="xo-grain relative border-t border-xo-blanco/10 px-6 py-16 sm:px-10">
      <div className="relative mx-auto flex max-w-6xl flex-col gap-10 sm:flex-row sm:items-end sm:justify-between">
        <Image
          src="/logo-xo.png"
          alt="XO Dance Studio"
          width={1192}
          height={789}
          className="h-14 w-auto"
        />

        <ul className="space-y-3 text-sm sm:text-right">
          <li>
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xo-rosa underline-offset-4 hover:underline"
            >
              {INSTAGRAM_HANDLE}
            </a>
          </li>
          <li>
            <a
              href={linkWhatsApp("Hola! Vengo de la web 🌸")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xo-rosa underline-offset-4 hover:underline"
            >
              {WHATSAPP_VISIBLE}
            </a>
          </li>
          <li className="text-xo-blanco/60">{UBICACION}</li>
        </ul>
      </div>

      {/* Legales aparte del contacto: no compiten con el CTA y quedan donde
          se las busca, al final de todo. */}
      <div className="relative mx-auto mt-12 max-w-6xl border-t border-xo-blanco/10 pt-6">
        <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
          <li>
            <Link
              href="/privacidad"
              className="text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
            >
              Política de Privacidad
            </Link>
          </li>
          <li>
            <Link
              href="/terminos"
              className="text-xo-blanco/60 underline-offset-4 transition-colors hover:text-xo-rosa hover:underline"
            >
              Condiciones del Servicio
            </Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
