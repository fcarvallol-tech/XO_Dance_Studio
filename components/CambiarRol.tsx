"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOMBRE_ROL, ROLES, nivelRol, type Rol } from "@/lib/roles";
import type { Profesora } from "@/lib/catalogo";

/**
 * Cambia el rol de una persona llamando a POST /api/roles.
 *
 * Elegir `profesora` obliga a decir **cuál** de las del catálogo es. Sin eso el
 * perfil queda con `profesora_id` nulo, entra al portal y no ve ninguna clase.
 * Por eso el cambio no se aplica al soltar el desplegable: se abre un paso de
 * confirmación con el motivo, que igual queda registrado.
 *
 * Acá solo se filtra qué se ofrece, para no mostrar opciones que la base va a
 * rechazar igual. Quien decide es `public.cambiar_rol`: esto es comodidad, no
 * seguridad. Si alguien llama la API a mano, la base y la ruta lo paran.
 */
export function CambiarRol({
  perfilId,
  rolActual,
  profesoraActual,
  nivelActor,
  profesoras,
}: {
  perfilId: string;
  rolActual: Rol;
  profesoraActual: string | null;
  nivelActor: Rol;
  /** Las activas del catálogo. Llegan por props: esto es cliente. */
  profesoras: Profesora[];
}) {
  const router = useRouter();
  const [rol, setRol] = useState<Rol>(rolActual);
  const [profesoraId, setProfesoraId] = useState(
    profesoraActual ?? profesoras[0]?.slug ?? "",
  );
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  // No se reparte lo que no se tiene, y no se toca a quien está más arriba.
  const disponibles = ROLES.filter((r) => nivelRol(r) <= nivelRol(nivelActor));

  if (nivelRol(rolActual) > nivelRol(nivelActor)) {
    return <span className="text-sm text-xo-gris italic">Fuera de tu nivel</span>;
  }

  const cambio = rol !== rolActual || (rol === "profesora" && profesoraId !== profesoraActual);

  async function guardar() {
    setFallo(null);
    setEnviando(true);

    try {
      const respuesta = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          perfilId,
          rol,
          motivo,
          profesoraId: rol === "profesora" ? profesoraId : null,
        }),
      });

      const datos = (await respuesta.json()) as { mensaje?: string };
      if (!respuesta.ok) {
        setFallo(datos.mensaje ?? "No se pudo cambiar el rol.");
        setEnviando(false);
        return;
      }

      setMotivo("");
      setEnviando(false);
      router.refresh();
    } catch {
      setFallo("No se pudo conectar. Intenta de nuevo.");
      setEnviando(false);
    }
  }

  return (
    <div className="min-w-56 space-y-2">
      <label htmlFor={`rol-${perfilId}`} className="sr-only">
        Rol de esta persona
      </label>
      <select
        id={`rol-${perfilId}`}
        value={rol}
        disabled={enviando}
        onChange={(evento) => setRol(evento.target.value as Rol)}
        className="w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-3 py-2 text-sm text-xo-negro disabled:opacity-50"
      >
        {disponibles.map((opcion) => (
          <option key={opcion} value={opcion}>
            {NOMBRE_ROL[opcion]}
          </option>
        ))}
      </select>

      {rol === "profesora" ? (
        <>
          <label htmlFor={`profe-${perfilId}`} className="sr-only">
            ¿Cuál de las profesoras es?
          </label>
          <select
            id={`profe-${perfilId}`}
            value={profesoraId}
            disabled={enviando}
            onChange={(evento) => setProfesoraId(evento.target.value)}
            className="w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-3 py-2 text-sm text-xo-negro disabled:opacity-50"
          >
            {profesoras.map((profesora) => (
              <option key={profesora.slug} value={profesora.slug}>
                {profesora.nombre}
              </option>
            ))}
          </select>
        </>
      ) : null}

      {cambio ? (
        <>
          <label htmlFor={`motivo-${perfilId}`} className="sr-only">
            Motivo del cambio
          </label>
          <input
            id={`motivo-${perfilId}`}
            type="text"
            value={motivo}
            disabled={enviando}
            onChange={(evento) => setMotivo(evento.target.value)}
            placeholder="Motivo (queda registrado)"
            className="w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-3 py-2 text-sm text-xo-negro placeholder:text-xo-gris disabled:opacity-50"
          />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={guardar}
              disabled={enviando}
              className="xo-eyebrow rounded-full bg-xo-rosa px-4 py-2 text-xo-negro transition-opacity hover:opacity-80 disabled:opacity-50"
            >
              {enviando ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              disabled={enviando}
              onClick={() => {
                setRol(rolActual);
                setProfesoraId(profesoraActual ?? profesoras[0]?.slug ?? "");
                setMotivo("");
                setFallo(null);
              }}
              className="xo-eyebrow rounded-full border border-xo-negro/20 px-4 py-2 text-xo-negro transition-colors hover:border-xo-negro/50"
            >
              Cancelar
            </button>
          </div>
        </>
      ) : null}

      {fallo ? (
        <p role="alert" className="text-xs leading-snug text-xo-negro">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}
