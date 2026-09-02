/**
 * Lo que se muestra cuando una consulta falla.
 *
 * Existe para que un fallo de lectura **no se vea como ausencia de datos**. La
 * bandeja de transferencias estuvo diciendo "no hay transferencias esperando"
 * con cinco compras pendientes en la base: el error se convertía en lista
 * vacía, que es exactamente la pantalla del caso normal.
 *
 * La regla que impone: donde haya un vacío posible, primero se pregunta si
 * hubo error, y el estado vacío solo se muestra si **no** lo hubo.
 */
export function ErrorDeLectura({
  que,
  error,
  denegado,
}: {
  /** Qué no se pudo leer, en una palabra: "las transferencias", "tu saldo". */
  que: string;
  error: string | null;
  /**
   * Qué decir si la base respondió **42501**. Ese código no es un fallo: es la
   * respuesta correcta a pedir algo que no corresponde —una clase de otra
   * profesora, por ejemplo—. Sugerirle recargar a alguien que pidió algo ajeno
   * lo manda a intentarlo de nuevo para nada, y de paso esconde que el sistema
   * funcionó bien.
   */
  denegado?: string;
}) {
  if (!error) return null;

  if (error.includes("42501")) {
    return (
      <div
        role="status"
        className="mb-8 border-l-2 border-xo-negro/40 py-4 pl-5"
      >
        <p className="text-xo-negro">
          {denegado ?? `No tienes acceso a ${que}.`}
        </p>
      </div>
    );
  }

  return (
    <div
      role="alert"
      className="mb-8 border-l-2 border-xo-negro bg-xo-negro/5 py-4 pl-5"
    >
      <p className="font-medium text-xo-negro">No pudimos leer {que}.</p>
      <p className="mt-2 text-sm leading-relaxed text-xo-gris">
        Esto no significa que no haya nada: significa que la consulta falló y no
        sabemos qué hay. Recarga; si sigue, avísale a Felipe con el detalle.
      </p>
      <p className="mt-3 font-mono text-xs break-words text-xo-gris">{error}</p>
    </div>
  );
}

/**
 * Versión para el sitio público, sobre fondo negro. Mismo criterio, otros
 * colores: el rosa sobre negro sí sirve para texto (9.7:1).
 */
export function ErrorDeLecturaOscuro({
  que,
  error,
}: {
  que: string;
  error: string | null;
}) {
  if (!error) return null;

  return (
    <div role="alert" className="mb-8 border-l-2 border-xo-rosa py-4 pl-5">
      <p className="text-xo-rosa">No pudimos leer {que}.</p>
      <p className="mt-2 font-mono text-xs break-words text-xo-blanco/60">
        {error}
      </p>
    </div>
  );
}
