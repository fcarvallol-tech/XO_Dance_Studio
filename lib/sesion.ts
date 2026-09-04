import { cache } from "react";
import { redirect } from "next/navigation";
import { clienteServidor } from "./supabase/servidor";
import { esRol, inicioSegunRol, tieneNivel, type Rol } from "./roles";
import { RUTA_NEUTRAL, cubiertaPor, type Grupo } from "./rutas";

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
 * **Memoizada por petición con `cache()` de React, y no es un lujo.** Cada
 * página del portal la llama dos veces —una en el layout del grupo y otra en la
 * página misma, las dos vía `requiereSesion`— y sin esto cada llamada creaba su
 * propio cliente, descargaba el JWKS y consultaba `perfiles` de nuevo. Medido:
 * dos ejecuciones por petición, y la primera de cada cliente paga ~174 ms de
 * JWKS antes de la consulta.
 *
 * `cache()` dura lo que dura la petición: no es un caché entre visitantes ni
 * entre navegaciones, así que no puede servir el perfil de otra persona.
 *
 * `getClaims()` y no `getSession()`: la sesión sale de una cookie que el
 * navegador puede haber escrito, y Supabase advierte explícitamente que no se
 * confíe en ella dentro de código de servidor. `getClaims` valida la firma.
 *
 * Devuelve `null` sin sesión. No redirige: eso lo deciden `requiereSesion` y
 * `requiereNivel`, para que también se pueda preguntar sin echar a nadie.
 */
export const perfilActual = cache(async function perfilActual(): Promise<Perfil | null> {
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
});

/**
 * Un guard **nunca** puede mandar a una ruta cubierta por el layout que lo está
 * ejecutando: ese layout vuelve a correr, vuelve a redirigir, y el navegador
 * corta con ERR_TOO_MANY_REDIRECTS. Es lo que pasó con `/completar-perfil`.
 *
 * Hoy ninguna combinación cae acá, porque `/completar-perfil` vive fuera de los
 * grupos. Esto es la red: si alguien vuelve a mover una ruta adentro, se rompe
 * ruidoso y en un solo salto, en vez de colgar el navegador.
 */
function destinoSeguro(destino: string, grupo?: Grupo): string {
  if (!grupo || !cubiertaPor(destino, grupo)) return destino;

  console.error(
    `[rutas] El layout de (${grupo}) intentó redirigir a ${destino}, que ese mismo ` +
      `layout cubre. Eso es un bucle: se manda a ${RUTA_NEUTRAL}. Mueve la ruta ` +
      `fuera del grupo o cambia el destino. Ver PRD-0004 §12.`,
  );
  return RUTA_NEUTRAL;
}

/**
 * Exige sesión, sin exigir que el perfil esté completo.
 *
 * Es lo que necesita `/completar-perfil`, que por definición se ve con el
 * perfil todavía incompleto. Ninguna otra página debería usar esto.
 */
export async function requiereSesionSinCompletar(): Promise<Perfil> {
  const perfil = await perfilActual();
  // Sin `volver`: el caso normal lo resuelve proxy.ts, que sí conoce la ruta
  // pedida. Acá se llega solo si el proxy no corrió.
  if (!perfil) redirect("/entrar");
  return perfil;
}

/**
 * Exige sesión y perfil completo. `grupo` es el del layout que llama, y sirve
 * para garantizar que el redirect no apunte de vuelta a sí mismo.
 */
export async function requiereSesion(grupo?: Grupo): Promise<Perfil> {
  const perfil = await requiereSesionSinCompletar();

  if (!perfil.perfilCompleto) {
    redirect(destinoSeguro("/completar-perfil", grupo));
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
  grupo?: Grupo,
): Promise<Perfil> {
  const perfil = await requiereSesion(grupo);

  if (!tieneNivel(perfil.rol, minimo)) {
    redirect(destinoSeguro(inicioSegunRol(perfil.rol), grupo));
  }

  return perfil;
}
