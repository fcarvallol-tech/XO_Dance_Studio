"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ANCLAS_VIEJAS } from "@/lib/navegacion";

/**
 * Rescata los enlaces de la landing vieja.
 *
 * `/#planes`, `/#profesoras` y compañía están publicados en Instagram y en los
 * perfiles de profesora desde agosto. Ahora esas secciones son páginas.
 *
 * **Por qué esto es un componente cliente y no una redirección del servidor:**
 * el navegador **no manda** lo que va después del `#`. Un `redirect` en el
 * servidor no puede ver `#planes` porque nunca le llega. Así que la única forma
 * de rescatar esos enlaces es leer `location.hash` en el navegador, y por eso
 * este componente existe: es feo, y es eso o que esos enlaces caigan en una
 * portada que ya no tiene esas secciones.
 *
 * Se monta solo en la portada. `replace` y no `push`: quien vuelve atrás tiene
 * que salir del sitio, no quedar atrapado en el rebote.
 */
export function AnclasViejas() {
  const router = useRouter();

  useEffect(() => {
    const rescatar = () => {
      const destino = ANCLAS_VIEJAS[window.location.hash];
      if (destino) router.replace(destino);
    };

    rescatar();

    // Y también al cambiar el hash **sin recargar**: si alguien ya está en la
    // portada y aprieta un enlace viejo, el navegador solo cambia el `#` y no
    // vuelve a montar nada, así que sin esto ese caso no se rescata.
    window.addEventListener("hashchange", rescatar);
    return () => window.removeEventListener("hashchange", rescatar);
  }, [router]);

  return null;
}
