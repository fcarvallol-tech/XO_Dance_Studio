import Image from "next/image";

// Fase 1 — muestrario del sistema visual.
// Sirve para verificar tokens y tipografías antes de construir las secciones.
// Se reemplaza completo en la Fase 2.

const COLORES = [
  { token: "xo-negro", hex: "#1A1A1A", clase: "bg-xo-negro" },
  { token: "xo-negro-alt", hex: "#232323", clase: "bg-xo-negro-alt" },
  { token: "xo-rosa", hex: "#F7ADBF", clase: "bg-xo-rosa" },
  { token: "xo-rosa-claro", hex: "#F2D0DC", clase: "bg-xo-rosa-claro" },
  { token: "xo-blanco", hex: "#F7F7F7", clase: "bg-xo-blanco" },
  { token: "xo-gris", hex: "#6B6B6B", clase: "bg-xo-gris" },
];

export default function Home() {
  return (
    <main className="xo-grain relative mx-auto max-w-4xl px-6 py-20 sm:px-10">
      <Image
        src="/logo-xo.png"
        alt="XO Dance Studio"
        width={1448}
        height={1086}
        priority
        className="h-20 w-auto"
      />

      <p className="xo-eyebrow mt-16 text-xo-rosa">Fase 1 · sistema listo</p>
      <h1 className="mt-3 font-display text-5xl leading-none text-xo-rosa sm:text-7xl">
        Bailar también
        <br />
        es sentirte parte
      </h1>
      <p className="mt-6 font-serif-xo text-xl italic text-xo-rosa-claro sm:text-2xl">
        &ldquo;Un lugar donde bailar también significa sentirte parte.&rdquo;
      </p>
      <p className="mt-6 max-w-prose leading-relaxed text-xo-blanco/80">
        Esto es Montserrat en cuerpo de texto. Las tres tipografías están
        cargadas y los seis tokens de color responden. Las secciones reales se
        construyen en la Fase 2.
      </p>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-colors hover:bg-xo-rosa-claro"
        >
          Quiero mi clase de prueba gratis
        </button>
        <span aria-hidden="true" className="text-xo-rosa">
          ✦
        </span>
      </div>

      <hr className="my-16 border-xo-blanco/15" />

      <h2 className="font-display text-3xl text-xo-blanco sm:text-4xl">
        Tokens de color
      </h2>
      <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {COLORES.map((color) => (
          <li key={color.token}>
            <div
              className={`${color.clase} h-20 rounded-md border border-xo-blanco/15`}
            />
            <p className="mt-2 font-mono text-xs text-xo-rosa-claro">
              {color.token}
            </p>
            <p className="font-mono text-xs text-xo-blanco/50">{color.hex}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
