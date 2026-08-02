import Image from "next/image";
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
    </footer>
  );
}
