import { redirect } from "next/navigation";
import { clienteServidor } from "./supabase/servidor";
import { esRol, tieneNivel, type Rol } from "./roles";

export type Perfil = {
  id: string;
  userId: string;
  rol: Rol;
  nombre: string | null;
  email: string | null;
  telefono: string | null;
  avatarUrl: string | null;
  profesoraId: string | null;
  perfilCompleto: boolean;
};

/**
 * Quién está pidiendo esta página, verificado contra el servidor.
 *
 * `getClaims()` y no `getSession()`: la sesión sale de una cookie que el
 * navegador puede haber escrito, y Supabase advierte explícitamente que no se
 * confíe en ella dentro de código de servidor. `getClaims` valida la firma.
 *
 * Devuelve `null` sin sesión. No redirige: eso lo deciden `requiereSesion` y
 * `requiereNivel`, para que también se pueda preguntar sin echar a nadie.
 */
export async function perfilActual(): Promise<Perfil | null> {
  const supabase = await clienteServidor();

  const { data, error } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (error || !userId) return null;

  // Lee con la sesión de la persona, no con la service role key: si la política
  // de RLS estuviera mal, esto devuelve vacío en vez de filtrar.
  const { data: fila } = await supabase
    .from("perfiles")
    .select(
      "id, user_id, rol, nombre, email, telefono, avatar_url, profesora_id, perfil_completo_at",
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!fila) return null;

  return {
    id: fila.id,
    userId: fila.user_id,
    // Si la base trajera algo fuera del enum, se trata como el rol más bajo.
    rol: esRol(fila.rol) ? fila.rol : "alumna",
    nombre: fila.nombre,
    email: fila.email,
    telefono: fila.telefono,
    avatarUrl: fila.avatar_url,
    profesoraId: fila.profesora_id,
    perfilCompleto: Boolean(fila.perfil_completo_at),
  };
}

/**
 * Exige sesión. Manda a entrar si no la hay, y a completar el perfil si falta,
 * salvo que ya se esté en esa página.
 */
export async function requiereSesion(rutaActual?: string): Promise<Perfil> {
  const perfil = await perfilActual();
  if (!perfil) {
    const destino = rutaActual
      ? `/entrar?volver=${encodeURIComponent(rutaActual)}`
      : "/entrar";
    redirect(destino);
  }

  if (!perfil.perfilCompleto && rutaActual !== "/completar-perfil") {
    redirect("/completar-perfil");
  }

  return perfil;
}

/**
 * Exige un nivel mínimo. `requiereNivel("admin")` deja pasar a owner sin
 * mencionarlo: la jerarquía es aritmética, no dos listas.
 *
 * Quien no alcanza el nivel va a su propio inicio, no a una página de error:
 * una profesora que escribe /admin en la barra no hizo nada malo.
 */
export async function requiereNivel(
  minimo: Rol,
  rutaActual?: string,
): Promise<Perfil> {
  const perfil = await requiereSesion(rutaActual);
  if (!tieneNivel(perfil.rol, minimo)) redirect("/mi-perfil");
  return perfil;
}
