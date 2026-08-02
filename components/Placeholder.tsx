/**
 * Hueco visible para material que todavía no existe.
 * Se borra solo: en cuanto `lib/profesoras.ts` tenga rutas de video o foto,
 * los componentes dejan de renderizar esto.
 */
export function Placeholder({
  etiqueta,
  className = "",
}: {
  etiqueta: string;
  className?: string;
}) {
  return (
    <div
      className={`flex items-center justify-center border border-dashed border-xo-rosa/40 bg-xo-negro-alt p-6 text-center ${className}`}
    >
      <span className="xo-eyebrow text-xo-rosa/70">
        <span aria-hidden="true">✦ </span>
        {etiqueta}
      </span>
    </div>
  );
}
