"use client";

import { useState } from "react";
import { clienteNavegador } from "@/lib/supabase/navegador";

type Estado = "reposo" | "google" | "correo" | "enviado";

/**
 * Los dos caminos de entrada, sin contraseña ninguno.
 *
 * El magic link no es un extra: Google exige 13 años para cuenta propia y la
 * academia recibe antes, así que sin él hay alumnas que simplemente no pueden
 * entrar. Ver ADR-0006. Por eso los dos botones pesan igual y el correo no
 * queda escondido detrás de un "otras opciones".
 */
export function FormularioEntrar({ volver }: { volver: string }) {
  const [correo, setCorreo] = useState("");
  const [estado, setEstado] = useState<Estado>("reposo");
  const [fallo, setFallo] = useState<string | null>(null);

  const ocupado = estado === "google" || estado === "correo";
  const destino = `/auth/callback?volver=${encodeURIComponent(volver)}`;

  async function conGoogle() {
    setFallo(null);
    setEstado("google");
    try {
      const supabase = clienteNavegador();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL(destino, window.location.origin).toString() },
      });
      if (error) throw error;
      // Si todo va bien, el navegador ya se fue a Google.
    } catch {
      setFallo("No pudimos abrir Google. Prueba con tu correo.");
      setEstado("reposo");
    }
  }

  async function conCorreo(evento: React.FormEvent) {
    evento.preventDefault();
    setFallo(null);

    const limpio = correo.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(limpio)) {
      setFallo("Revisa el correo: parece que le falta algo.");
      return;
    }

    setEstado("correo");
    try {
      const supabase = clienteNavegador();
      const { error } = await supabase.auth.signInWithOtp({
        email: limpio,
        options: {
          emailRedirectTo: new URL(
            `/auth/confirmar?volver=${encodeURIComponent(volver)}`,
            window.location.origin,
          ).toString(),
        },
      });
      if (error) throw error;
      setEstado("enviado");
    } catch {
      setFallo("No pudimos mandar el correo. Intenta de nuevo en un momento.");
      setEstado("reposo");
    }
  }

  if (estado === "enviado") {
    return (
      <div
        role="status"
        className="border-l-2 border-xo-rosa pl-5 text-lg leading-relaxed text-xo-blanco/85"
      >
        Te mandamos un enlace a <strong className="text-xo-rosa-claro">{correo}</strong>.
        Ábrelo desde este mismo teléfono o computador y quedas dentro.
        <span className="mt-3 block text-sm text-xo-blanco/60">
          Si no llega en un par de minutos, mira en spam. El enlace sirve una
          sola vez.
        </span>
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={conGoogle}
        disabled={ocupado}
        className="xo-eyebrow inline-flex w-full items-center justify-center rounded-full bg-xo-rosa px-6 py-4 text-xo-negro transition-colors hover:bg-xo-rosa-claro disabled:cursor-not-allowed disabled:bg-xo-rosa/40"
      >
        {estado === "google" ? "Abriendo Google…" : "Entrar con Google"}
      </button>

      <div aria-hidden="true" className="my-8 flex items-center gap-4">
        <span className="h-px flex-1 bg-xo-blanco/15" />
        <span className="text-xs text-xo-rosa/60">✦</span>
        <span className="h-px flex-1 bg-xo-blanco/15" />
      </div>

      <form onSubmit={conCorreo} noValidate>
        <label htmlFor="correo" className="xo-eyebrow block text-xo-blanco/55">
          O con tu correo
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="tucorreo@ejemplo.cl"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
          aria-invalid={Boolean(fallo)}
          className="mt-3 w-full rounded-lg border border-xo-blanco/20 bg-xo-negro-alt px-4 py-3.5 text-xo-blanco placeholder:text-xo-blanco/35 focus:border-xo-rosa"
        />

        <button
          type="submit"
          disabled={ocupado}
          className="xo-eyebrow mt-4 inline-flex w-full items-center justify-center rounded-full border border-xo-rosa/60 px-6 py-4 text-xo-rosa transition-colors hover:border-xo-rosa hover:bg-xo-rosa hover:text-xo-negro disabled:cursor-not-allowed disabled:border-xo-rosa/25 disabled:text-xo-rosa/40"
        >
          {estado === "correo" ? "Enviando…" : "Mandarme un enlace"}
        </button>

        <p className="mt-4 text-sm leading-relaxed text-xo-blanco/60">
          No hay contraseñas. Te llega un enlace y con eso entras.
        </p>
      </form>

      {fallo ? (
        <p
          role="alert"
          className="mt-6 border-l-2 border-xo-rosa pl-4 text-sm leading-relaxed text-xo-rosa"
        >
          {fallo}
        </p>
      ) : null}
    </div>
  );
}
