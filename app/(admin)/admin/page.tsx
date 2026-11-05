import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { CambiarRol } from "@/components/CambiarRol";
import { RegalarClases } from "@/components/RegalarClases";
import { cuandoLegible } from "@/lib/compras";
import { getRegalosRecientes, getSaldosVigentes } from "@/lib/compras-consultas";
import { NOMBRE_ROL, esRol, type Rol } from "@/lib/roles";
import { nombreDe } from "@/lib/catalogo";
import { getCatalogoCompleto } from "@/lib/catalogo-consultas";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { requiereNivel } from "@/lib/sesion";
import { filtroDePersonas, normalizarBusqueda } from "@/lib/busqueda-personas";
import { clienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = {
  title: "Administración — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Hasta cuántas personas se dibujan. Si hay más, la página lo dice (PRD-0025). */
const TOPE_PERSONAS = 200;

type Props = { searchParams: Promise<{ q?: string | string[] }> };

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
export default async function Admin({ searchParams }: Props) {
  const actor = await requiereNivel("admin", "admin");
  const supabase = await clienteServidor();
  const busqueda = normalizarBusqueda((await searchParams).q);
  // Completo, no público: un admin tiene que poder ver también lo desactivado.
  const { profesoras, error: errorCatalogo } = await getCatalogoCompleto();
  const activas = profesoras.filter((p) => p.activa);

  // PRD-0025: el filtro va en la consulta, y `count: "exact"` trae en la misma
  // respuesta cuántas coinciden en total, más allá del tope. Sin ese número la
  // lista se cortaba en 200 sin que nadie lo supiera.
  let consultaPerfiles = supabase
    .from("perfiles")
    .select("id, nombre, email, rol, profesora_id, created_at", { count: "exact" })
    .is("deleted_at", null);
  if (busqueda) consultaPerfiles = consultaPerfiles.or(filtroDePersonas(busqueda));

  const [{ data, error, count }, saldosDeTodas, regalos, { data: vigencia }] = await Promise.all([
    consultaPerfiles.order("created_at", { ascending: false }).limit(TOPE_PERSONAS),
    // Sin búsqueda se leen todos los saldos de una vez, en paralelo. Con
    // búsqueda, después, y solo los de quienes aparecieron.
    busqueda ? null : getSaldosVigentes(),
    getRegalosRecientes(),
    // Preferencia con valor por defecto, como `calendario_dias`: si no se lee,
    // 60 es lo mismo que dice el parámetro. La base usa el suyo al regalar.
    supabase.from("parametros").select("valor").eq("clave", "regalo_vigencia_dias").maybeSingle(),
  ]);
  const vigenciaDias = Number(vigencia?.valor ?? 60) || 60;

  const perfiles = (data ?? []) as FilaPerfil[];
  const saldos = saldosDeTodas ?? (await getSaldosVigentes(perfiles.map((p) => p.id)));
  const total = count ?? perfiles.length;
  const llegoAlTope = total > perfiles.length;

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
      <ErrorDeLectura que="los saldos de clases" error={saldos.error} />

      <BuscarPersonas busqueda={busqueda} />

      {error ? null : (
        <Conteo busqueda={busqueda} mostradas={perfiles.length} total={total} />
      )}
      {llegoAlTope && !error ? (
        <p
          role="status"
          className="mb-6 max-w-prose border-l-2 border-xo-negro pl-4 text-sm text-xo-negro"
          data-tope
        >
          <strong>La lista llegó al tope.</strong> Se ven las {perfiles.length} más recientes de{" "}
          {total}: {total - perfiles.length} no aparecen.{" "}
          {busqueda ? "Escribe algo más preciso para acotar." : "Busca por nombre o correo para encontrar al resto."}
        </p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[60rem] border-collapse text-left">
          <thead>
            <tr className="border-b border-xo-negro/20">
              <Th>Nombre</Th>
              <Th>Correo</Th>
              <Th>Rol</Th>
              <Th>Profesora</Th>
              <Th>Clases</Th>
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
                <td className="py-3 pr-4">
                  {/* Clases vigentes y el regalo (PRD-0023). También a sí
                      misma y a una profesora: las dos toman clases. */}
                  <RegalarClases
                    perfilId={fila.id}
                    nombre={fila.nombre}
                    correo={fila.email}
                    saldo={saldos.datos.get(fila.id) ?? 0}
                    vigenciaDias={vigenciaDias}
                  />
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
        busqueda ? (
          <p className="mt-4 text-xo-negro">
            Nadie con «{busqueda}» en el nombre ni en el correo.{" "}
            <Link href="/admin" className="underline underline-offset-4">
              Ver a todas
            </Link>
          </p>
        ) : (
          <p className="text-xo-gris">Todavía no hay nadie registrado.</p>
        )
      ) : null}

      {/* PRD-0023: lo regalado queda a la vista, con por qué y quién. Es plata
          que no entró, y cada clase regalada que se toma cuesta $250. */}
      <h2 className="xo-eyebrow mt-14 text-xo-gris">Regalos recientes</h2>
      <p className="mt-2 max-w-prose text-sm text-xo-gris">
        Clases regaladas: no son venta y no entran en los ingresos. Cada una que se toma le paga
        igual los $250 a la profesora.
      </p>
      <ErrorDeLectura que="los regalos" error={regalos.error} />
      {regalos.error ? null : regalos.datos.length === 0 ? (
        <p className="mt-4 text-xo-gris">Todavía no se ha regalado ninguna clase.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10" data-regalos>
          {regalos.datos.map((r) => (
            <li key={r.id} className="flex flex-wrap justify-between gap-3 py-3">
              <div>
                <p className="text-sm text-xo-negro">
                  {r.alumna ?? "Sin nombre"} · {r.cantidad} {r.cantidad === 1 ? "clase" : "clases"}
                </p>
                <p className="text-sm text-xo-negro">
                  <span className="text-xo-gris">Por qué: </span>
                  {r.motivo}
                </p>
                <p className="text-sm text-xo-gris">
                  {cuandoLegible(r.regaladoAt)} · por {r.autor ?? "alguien sin perfil"}
                </p>
              </div>
              <p className="self-center text-right text-sm text-xo-gris">
                {r.vence ? `Vale hasta el ${cuandoLegible(r.vence).split(",")[0]}` : null}
                {r.disponibles !== null ? (
                  <span className="block">
                    {r.disponibles} sin usar
                  </span>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * Formulario nativo con `GET`: la búsqueda queda en la URL, se puede recargar
 * y compartir, y funciona sin JavaScript.
 */
function BuscarPersonas({ busqueda }: { busqueda: string | null }) {
  return (
    <form method="get" action="/admin" role="search" className="mb-4 flex flex-wrap items-end gap-3">
      <label className="block w-full max-w-md">
        <span className="xo-eyebrow text-xo-gris">Buscar por nombre o correo</span>
        <input
          type="search"
          name="q"
          defaultValue={busqueda ?? ""}
          maxLength={100}
          autoComplete="off"
          placeholder="cami, gmail, Pérez…"
          className="mt-2 w-full rounded-lg border border-xo-negro/25 bg-xo-blanco px-4 py-3 text-xo-negro placeholder:text-xo-gris"
        />
      </label>
      <button
        type="submit"
        className="xo-eyebrow rounded-full bg-xo-negro px-5 py-3 text-xo-blanco transition-opacity hover:opacity-85"
      >
        Buscar
      </button>
      {busqueda ? (
        <Link
          href="/admin"
          className="xo-eyebrow rounded-full border border-xo-negro/20 px-5 py-3 text-xo-negro transition-colors hover:border-xo-negro/50"
        >
          Limpiar
        </Link>
      ) : null}
    </form>
  );
}

/** El número total se dice siempre, haya tope o no (Felipe, 05/11/2026). */
function Conteo({
  busqueda,
  mostradas,
  total,
}: {
  busqueda: string | null;
  mostradas: number;
  total: number;
}) {
  const personas = (n: number) => `${n} ${n === 1 ? "persona" : "personas"}`;
  return (
    <p className="mb-4 text-sm text-xo-gris" data-conteo>
      {busqueda
        ? total === 0
          ? null
          : `${personas(total)} con «${busqueda}»${mostradas < total ? `, se ven ${mostradas}` : ""}.`
        : mostradas < total
          ? `${personas(total)} registradas, se ven ${mostradas}.`
          : `${personas(total)} registradas.`}
    </p>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="xo-eyebrow py-3 pr-4 text-xo-gris">{children}</th>;
}
