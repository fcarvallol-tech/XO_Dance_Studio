import type { Metadata } from "next";
import { TituloPortal } from "@/components/Portal";
import { CambiarRol } from "@/components/CambiarRol";
import { NOMBRE_ROL, esRol, type Rol } from "@/lib/roles";
import { nombreDe } from "@/lib/catalogo";
import { getCatalogoCompleto } from "@/lib/catalogo-consultas";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { clienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Administración — XO Dance Studio",
  robots: { index: false, follow: false },
};

type FilaPerfil = {
  id: string;
  nombre: string | null;
  email: string | null;
  rol: string;
  profesora_id: string | null;
  created_at: string;
};

/**
 * Personas y roles. Es lo único operativo que tiene sentido antes de que exista
 * el resto del ERP: sin esto no hay forma de nombrar a la primera profesora.
 *
 * La consulta va con la sesión de quien mira, no con la service role key: si la
 * política `perfiles_admin_lee_todos` estuviera mal, esta tabla sale vacía en
 * vez de filtrar datos.
 */
export default async function Admin() {
  const actor = await requiereNivel("admin", "admin");
  const supabase = await clienteServidor();
  // Completo, no público: un admin tiene que poder ver también lo desactivado.
  const { profesoras, error: errorCatalogo } = await getCatalogoCompleto();
  const activas = profesoras.filter((p) => p.activa);

  const { data, error } = await supabase
    .from("perfiles")
    .select("id, nombre, email, rol, profesora_id, created_at")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  const perfiles = (data ?? []) as FilaPerfil[];

  return (
    <>
      <TituloPortal
        eyebrow="Administración"
        titulo="Personas y roles"
        bajada="Cada cambio de rol queda registrado con quién lo hizo y cuándo. No puedes cambiar el tuyo ni repartir un rol más alto que el tuyo. Dejar a alguien como profesora obliga a decir cuál del catálogo es: si no, entra al portal y no ve ninguna clase."
      />

      <ErrorDeLectura
        que="los perfiles"
        error={error ? `${error.message} (${error.code})` : null}
      />
      <ErrorDeLectura que="el catálogo de profesoras" error={errorCatalogo} />

      <div className="overflow-x-auto">
        <table className="w-full min-w-[52rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-xo-negro/20">
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Rol</Th>
              <Th>Profesora</Th>
              <Th>Cambiar a</Th>
            </tr>
          </thead>
          <tbody>
            {perfiles.map((fila) => (
              <tr key={fila.id} className="border-b border-xo-negro/10">
                <td className="py-3 pr-4 text-xo-negro">
                  {fila.nombre ?? <span className="text-xo-gris italic">Sin nombre</span>}
                </td>
                <td className="py-3 pr-4 text-sm text-xo-gris">{fila.email}</td>
                <td className="py-3 pr-4 text-sm text-xo-negro">
                  {esRol(fila.rol) ? NOMBRE_ROL[fila.rol] : fila.rol}
                </td>
                <td className="py-3 pr-4 text-sm text-xo-negro">
                  {fila.profesora_id ? (
                    nombreDe(profesoras, fila.profesora_id)
                  ) : (
                    <span className="text-xo-gris">—</span>
                  )}
                </td>
                <td className="py-3">
                  {fila.id === actor.id ? (
                    <span className="text-sm text-xo-gris italic">Eres tú</span>
                  ) : (
                    <CambiarRol
                      perfilId={fila.id}
                      rolActual={esRol(fila.rol) ? fila.rol : ("alumna" as Rol)}
                      profesoraActual={fila.profesora_id}
                      nivelActor={actor.rol}
                      profesoras={activas}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {perfiles.length === 0 && !error ? (
        <p className="text-xo-gris">Todavía no hay nadie registrado.</p>
      ) : null}
    </>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="xo-eyebrow py-3 pr-4 text-xo-gris">{children}</th>;
}
