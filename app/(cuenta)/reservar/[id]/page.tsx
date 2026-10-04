import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { ReservarClase } from "@/components/ReservarClase";
import { requiereSesion } from "@/lib/sesion";
import { getCalendario, getSaldo } from "@/lib/compras-consultas";
import { cuandoLegible } from "@/lib/compras";
import { esPasada } from "@/lib/dominio/grilla";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = {
  title: "Reservar — XO Dance Studio",
  robots: { index: false, follow: false },
};

/**
 * `/reservar/<id>` — una clase concreta, con sesión.
 *
 * **Existe para que el calendario público funcione** (PRD-0022 §8.3). `?volver=`
 * guarda el pathname, así que sin esta ruta alguien que aprieta Reservar sin
 * sesión volvería a `/calendario` y tendría que buscar de nuevo la clase que ya
 * había elegido. Con la clase en la URL, vuelve a la clase.
 *
 * Es el mismo patrón que `/reservar-especial/<slug>` y `/transferir/<oferta>`, y
 * por la misma razón: lo que tiene que sobrevivir al login va en la ruta.
 */
export default async function ReservarUna({ params }: Props) {
  const perfil = await requiereSesion("cuenta");
  const { id } = await params;

  const [clases, saldo] = await Promise.all([
    getCalendario(perfil.id, 60),
    getSaldo(perfil.id),
  ]);

  if (clases.error) {
    return (
      <>
        <TituloPortal eyebrow="Reservar" titulo="Tu clase" />
        <ErrorDeLectura que="esa clase" error={clases.error} />
      </>
    );
  }

  const clase = clases.datos.find((c) => c.id === id);
  if (!clase) notFound();
  // Una especial se paga aparte y se reserva desde su página: acá la base la
  // rechazaría con el pack (PRD-0018).
  if (clase.especial) redirect(`/clases-especiales/${clase.especial.slug}`);
  // Desde PRD-0006 §13 el calendario trae también las que ya pasaron en la
  // semana. Una que ya empezó no se reserva: de vuelta al calendario.
  if (yaEmpezo(clase.inicio)) redirect("/reservar");

  return (
    <>
      <TituloPortal
        eyebrow="Reservar"
        titulo={clase.cursoNombre}
        bajada={`${cuandoLegible(clase.inicio)} · con ${clase.profesoraNombre} · ${clase.sedeNombre}, ${clase.sedeComuna}`}
      />

      <ReservarClase clase={clase} saldo={saldo.datos} />

      <p className="mt-10 text-sm text-xo-gris">
        <Link href="/calendario" className="underline underline-offset-4">
          Ver todas las clases
        </Link>
      </p>
    </>
  );
}

/** La misma regla que la grilla: una clase que ya empezó es pasada. */
function yaEmpezo(inicio: string): boolean {
  return esPasada(inicio, new Date());
}
