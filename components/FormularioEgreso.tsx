"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registrarEgreso } from "@/lib/acciones";
import type { OpcionesEgreso } from "@/lib/finanzas-consultas";

/**
 * Registrar un egreso. Cinco campos y nada más: qué día, en qué, qué se pagó,
 * cuánto y en qué sede si aplica.
 *
 * Lo que valida el navegador —fecha no futura, monto positivo— es comodidad.
 * La validación es `registrar_egreso`, en la base, y sus mensajes son los que
 * se muestran cuando algo no pasa.
 */
export function FormularioEgreso({
  opciones,
  hoy,
}: {
  opciones: OpcionesEgreso;
  /** `YYYY-MM-DD` en Santiago. Lo calcula el servidor, no el navegador. */
  hoy: string;
}) {
  const router = useRouter();
  const [fallo, setFallo] = useState<string | null>(null);
  const [enviando, iniciar] = useTransition();

  function guardar(datos: FormData) {
    setFallo(null);
    iniciar(async () => {
      const resultado = await registrarEgreso(datos);
      if (!resultado.ok) {
        setFallo(resultado.mensaje ?? "No se pudo registrar.");
        return;
      }
      router.push("/owner/finanzas");
      router.refresh();
    });
  }

  if (opciones.categorias.length === 0) {
    return (
      <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
        No hay categorías activas para elegir. Se cargan en la tabla{" "}
        <code className="text-xs">categorias_egreso</code>; sin al menos una, no se puede
        registrar nada.
      </p>
    );
  }

  // `onSubmit` y no `action`: con `action`, React vacía el formulario al
  // terminar la acción, también cuando la base rechazó el egreso, y la
  // persona tendría que escribir todo de nuevo por un cero en el monto.
  return (
    <form
      onSubmit={(ev) => {
        ev.preventDefault();
        guardar(new FormData(ev.currentTarget));
      }}
      className="max-w-xl space-y-8"
    >
      <div className="grid gap-6 sm:grid-cols-2">
        <Campo etiqueta="Fecha en que se pagó" requerido>
          <input name="fecha" type="date" required defaultValue={hoy} max={hoy} className={ENTRADA} />
        </Campo>

        <Campo etiqueta="Categoría" requerido>
          <select name="categoria" required defaultValue="" className={ENTRADA}>
            <option value="">Elige</option>
            {opciones.categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      <Campo etiqueta="Qué se pagó" requerido>
        <input
          name="descripcion"
          required
          maxLength={200}
          placeholder="Arriendo de sala de septiembre"
          className={ENTRADA}
        />
      </Campo>

      <div className="grid gap-6 sm:grid-cols-2">
        <Campo etiqueta="Monto en pesos" requerido>
          <input
            name="monto_clp"
            required
            inputMode="numeric"
            pattern="[0-9.]+"
            placeholder="68000"
            className={ENTRADA}
          />
        </Campo>

        <Campo etiqueta="Sede">
          <select name="sede_id" defaultValue="" className={ENTRADA}>
            <option value="">No aplica</option>
            {opciones.sedes.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </Campo>
      </div>

      {fallo ? (
        <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
          {fallo}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={enviando}
          className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-40"
        >
          {enviando ? "Registrando…" : "Registrar egreso"}
        </button>
        <p className="text-sm text-xo-gris">
          Si te equivocas, se anula desde la lista y se registra de nuevo. No se edita.
        </p>
      </div>
    </form>
  );
}

const ENTRADA =
  "w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro focus:border-xo-negro focus:outline-none";

function Campo({
  etiqueta,
  requerido,
  children,
}: {
  etiqueta: string;
  requerido?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="xo-eyebrow text-xo-gris">
        {etiqueta}
        {requerido ? " *" : ""}
      </span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}
