"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NOMBRE_ROL, ROLES, nivelRol, type Rol } from "@/lib/roles";

/**
 * Cambia el rol de una persona llamando a POST /api/roles.
 *
 * Acá solo se filtra qué se ofrece, para no mostrar opciones que la base va a
 * rechazar igual. Quien decide es `public.cambiar_rol`: esto es comodidad, no
 * seguridad. Si alguien llama la API a mano con otro rol, la base lo para.
 */
export function CambiarRol({
  perfilId,
  rolActual,
  nivelActor,
}: {
  perfilId: string;
  rolActual: Rol;
  nivelActor: Rol;
}) {
  const router = useRouter();
  const [estado, setEstado] = useState<"reposo" | "enviando">("reposo");
  const [fallo, setFallo] = useState<string | null>(null);

  // No se reparte lo que no se tiene, y no se toca a quien está más arriba.
  const disponibles = ROLES.filter(
    (rol) => nivelRol(rol) <= nivelRol(nivelActor),
  );
  const inalcanzable = nivelRol(rolActual) > nivelRol(nivelActor);

  if (inalcanzable) {
    return <span className="text-sm text-xo-gris italic">Fuera de tu nivel</span>;
  }

  async function cambiar(rol: Rol) {
    if (rol === rolActual) return;

    const motivo = window.prompt(
      `¿Por qué pasa a ${NOMBRE_ROL[rol]}? Queda registrado.`,
      "",
    );
    // Cancelar es cancelar. Una cadena vacía sí es un motivo en blanco válido.
    if (motivo === null) return;

    setFallo(null);
    setEstado("enviando");

    try {
      const respuesta = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perfilId, rol, motivo }),
      });

      const datos = (await respuesta.json()) as { mensaje?: string };
      if (!respuesta.ok) {
        setFallo(datos.mensaje ?? "No se pudo cambiar el rol.");
        setEstado("reposo");
        return;
      }

      router.refresh();
      setEstado("reposo");
    } catch {
      setFallo("No se pudo conectar. Intenta de nuevo.");
      setEstado("reposo");
    }
  }

  return (
    <div>
      <label htmlFor={`rol-${perfilId}`} className="sr-only">
        Cambiar el rol de esta persona
      </label>
      <select
        id={`rol-${perfilId}`}
        value={rolActual}
        disabled={estado === "enviando"}
        onChange={(evento) => cambiar(evento.target.value as Rol)}
        className="rounded-lg border border-xo-negro/25 bg-xo-blanco px-3 py-2 text-sm text-xo-negro disabled:opacity-50"
      >
        {disponibles.map((rol) => (
          <option key={rol} value={rol}>
            {NOMBRE_ROL[rol]}
          </option>
        ))}
      </select>

      {fallo ? (
        <p role="alert" className="mt-1 max-w-56 text-xs leading-snug text-xo-negro">
          {fallo}
        </p>
      ) : null}
    </div>
  );
}
