import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Portal, TituloPortal } from "@/components/Portal";
import { inicioSegunRol } from "@/lib/roles";
import { requiereSesionSinCompletar } from "@/lib/sesion";
import { validarPerfil, type ErroresPerfil } from "@/lib/perfil";
import { clienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Completar perfil — XO Dance Studio",
  robots: { index: false, follow: false },
};

type Props = { searchParams: Promise<{ error?: string }> };

/**
 * El paso que falta después del primer ingreso.
 *
 * **Vive fuera de los grupos `(cuenta)`, `(profesora)`, `(admin)` y `(owner)`,
 * y eso no es un detalle de organización.** Cuando estaba dentro de `(cuenta)`,
 * el layout de ese grupo redirigía acá a quien tuviera el perfil incompleto —
 * y como esta página también estaba cubierta por ese layout, volvía a correr y
 * a redirigir, en bucle, hasta el ERR_TOO_MANY_REDIRECTS. Ver PRD-0004 §12.
 *
 * Por lo mismo renderiza `<Portal>` ella misma, y usa
 * `requiereSesionSinCompletar`: es la única página que por definición se ve con
 * el perfil todavía incompleto.
 *
 * Se pide lo mínimo: Google trae el nombre pero no el teléfono, y sin teléfono
 * no hay cómo coordinar por WhatsApp, que hoy es todo el canal.
 *
 * La escritura pasa por el cliente con la sesión de la persona, no por la
 * service role key: RLS le deja editar su propia fila y los grants por columna
 * hacen que `rol` no sea alcanzable ni queriendo.
 */
export default async function CompletarPerfil({ searchParams }: Props) {
  const perfil = await requiereSesionSinCompletar();
  const { error } = await searchParams;

  if (perfil.perfilCompleto) redirect(inicioSegunRol(perfil.rol));

  async function guardar(datos: FormData) {
    "use server";

    const validacion = validarPerfil({
      nombre: datos.get("nombre"),
      telefono: datos.get("telefono"),
    });

    if (!validacion.ok) {
      const primero = Object.keys(validacion.errores)[0] as keyof ErroresPerfil;
      redirect(`/completar-perfil?error=${primero}`);
    }

    const actual = await requiereSesionSinCompletar();
    const supabase = await clienteServidor();

    const { error: fallo } = await supabase
      .from("perfiles")
      .update({
        nombre: validacion.datos.nombre,
        telefono: validacion.datos.telefono,
        perfil_completo_at: new Date().toISOString(),
      })
      .eq("id", actual.id);

    if (fallo) {
      console.error("No se pudo guardar el perfil:", fallo.message);
      redirect("/completar-perfil?error=guardar");
    }

    redirect(inicioSegunRol(actual.rol));
  }

  return (
    <Portal perfil={perfil}>
      <TituloPortal
        eyebrow="Falta poco"
        titulo="Completa tu perfil"
        bajada="Lo usamos para coordinar contigo por WhatsApp. Nada de esto se publica."
      />

      <form action={guardar} className="max-w-md space-y-6">
        <Campo
          id="nombre"
          etiqueta="¿Cómo te llamas?"
          error={error === "nombre" ? "Escribe tu nombre, con dos letras basta." : undefined}
        >
          <input
            id="nombre"
            name="nombre"
            type="text"
            autoComplete="name"
            defaultValue={perfil.nombre ?? ""}
            className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro focus:border-xo-negro"
          />
        </Campo>

        <Campo
          id="telefono"
          etiqueta="Tu WhatsApp"
          error={
            error === "telefono"
              ? "El número va sin el +56 9 y tiene 8 dígitos."
              : undefined
          }
        >
          <div className="mt-2 flex items-stretch">
            {/* shrink-0 y whitespace-nowrap: sin ellos el input `w-full`
                aprieta al prefijo hasta su min-content, que corta en el
                espacio de "+56 9" y lo parte en dos líneas. */}
            <span className="flex shrink-0 items-center rounded-l-lg border border-r-0 border-xo-negro/25 px-3 text-sm whitespace-nowrap text-xo-gris">
              +56 9
            </span>
            <input
              id="telefono"
              name="telefono"
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="1234 5678"
              className="w-full rounded-r-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro focus:border-xo-negro"
            />
          </div>
        </Campo>

        {error === "guardar" ? (
          <p role="alert" className="border-l-2 border-xo-negro pl-4 text-sm text-xo-negro">
            No pudimos guardar. Intenta de nuevo.
          </p>
        ) : null}

        <button
          type="submit"
          className="xo-eyebrow rounded-full bg-xo-rosa px-6 py-3.5 text-xo-negro transition-opacity hover:opacity-80"
        >
          Guardar y entrar
        </button>
      </form>
    </Portal>
  );
}

function Campo({
  id,
  etiqueta,
  error,
  children,
}: {
  id: string;
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="xo-eyebrow text-xo-gris">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p role="alert" className="mt-2 text-sm text-xo-negro">
          {error}
        </p>
      ) : null}
    </div>
  );
}
