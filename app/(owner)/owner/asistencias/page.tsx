import type { Metadata } from "next";
import Link from "next/link";
import { TituloPortal } from "@/components/Portal";
import { ErrorDeLectura } from "@/components/ErrorDeLectura";
import { RegistrarAsistencia } from "@/components/RegistrarAsistencia";
import { requiereNivel } from "@/lib/sesion";
import { clienteAdmin } from "@/lib/supabase/admin";
import { clienteServidor } from "@/lib/supabase/servidor";
import { cuandoLegible } from "@/lib/compras";
import { filtroDePersonas, normalizarBusqueda } from "@/lib/busqueda-personas";
import { mesEnCurso, nombreDelMes } from "@/lib/dominio/periodo";

export const metadata: Metadata = {
  title: "Asistencias pasadas — XO Dance Studio",
  robots: { index: false, follow: false },
};

/** Hasta cuántos días atrás se ofrecen clases. Un mes cerrado lo rechaza la base igual. */
const DIAS_ATRAS = 45;

type Props = { searchParams: Promise<{ clase?: string; q?: string }> };

type ClasePasada = {
  id: string;
  inicio: string;
  cupo_maximo: number;
  cursos: { nombre: string } | null;
  profesoras: { nombre: string } | null;
  sedes: { nombre: string } | null;
};

type Retroactiva = {
  reserva_id: string;
  registrada_at: string;
  clase_inicio: string;
  curso: string;
  profesora: string;
  alumna: string | null;
  motivo: string;
  autor: string | null;
  lote_vencido_hoy: boolean | null;
};

const fecha = (iso: string) => {
  const t = cuandoLegible(iso);
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/**
 * PRD-0030, parte 1: registrar que una alumna bailó en una clase que ya pasó y
 * no tenía reserva. **Solo owner.**
 *
 * No es editar la lista: es **crear la reserva**, que consume el crédito y le
 * paga a la profesora. Todas las reglas viven en `reservar_retroactiva()`.
 *
 * Los nombres de las inscritas y de las alumnas se leen con la service role
 * porque la página es solo del owner y RLS no le abre las reservas de una
 * clase (pedido 1 del ROADMAP). Nombres sí; ningún dato de contacto.
 */
export default async function Asistencias({ searchParams }: Props) {
  await requiereNivel("owner", "owner");
  const parametros = await searchParams;
  const claseId = typeof parametros.clase === "string" ? parametros.clase : null;
  const busqueda = normalizarBusqueda(parametros.q);

  const admin = clienteAdmin();
  const supabase = await clienteServidor();
  const periodo = mesEnCurso();
  const ahora = new Date();
  const desde = new Date(ahora.getTime() - DIAS_ATRAS * 24 * 60 * 60 * 1000);

  const [clases, retroactivas] = await Promise.all([
    admin
      .from("clases")
      .select("id, inicio, cupo_maximo, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre )")
      .neq("tipo", "especial")
      .eq("estado", "programada")
      .gte("inicio", desde.toISOString())
      .lt("inicio", ahora.toISOString())
      .order("inicio", { ascending: false }),
    supabase.rpc("reservas_retroactivas", {
      p_desde: periodo.desde.toISOString(),
      p_hasta: periodo.hasta.toISOString(),
    }),
  ]);

  const lista = (clases.data ?? []) as unknown as ClasePasada[];
  const delMes = (retroactivas.data ?? []) as Retroactiva[];
  const elegida = claseId ? lista.find((c) => c.id === claseId) ?? null : null;

  // La clase elegida: quiénes ya están, y la búsqueda de quién falta.
  let inscritas: { perfil_id: string; nombre: string | null; origen: string }[] = [];
  let resultados: { id: string; nombre: string | null }[] = [];
  let errorClase: string | null = null;
  if (elegida) {
    const { data, error } = await admin
      .from("reservas")
      // Con nombre de relación: desde 20261112120000 `reservas` tiene dos claves a
      // `perfiles` (la alumna y `creada_por`), y sin él PostgREST no sabe cuál
      // usar y la consulta falla entera.
      .select("perfil_id, origen, perfiles!reservas_perfil_id_fkey ( nombre )")
      .eq("clase_id", elegida.id)
      .in("estado", ["confirmada", "asistio"]);
    errorClase = error?.message ?? null;
    inscritas = ((data ?? []) as unknown as { perfil_id: string; origen: string; perfiles: { nombre: string | null } | null }[])
      .map((r) => ({ perfil_id: r.perfil_id, origen: r.origen, nombre: r.perfiles?.nombre ?? null }))
      .sort((a, b) => (a.nombre ?? "").localeCompare(b.nombre ?? "", "es"));

    if (busqueda) {
      const { data: personas, error: errorPersonas } = await admin
        .from("perfiles")
        .select("id, nombre")
        .eq("rol", "alumna")
        .is("deleted_at", null)
        .or(filtroDePersonas(busqueda))
        .order("nombre")
        .limit(20);
      errorClase = errorClase ?? errorPersonas?.message ?? null;
      const ya = new Set(inscritas.map((i) => i.perfil_id));
      resultados = ((personas ?? []) as { id: string; nombre: string | null }[]).filter((p) => !ya.has(p.id));
    }
  }

  const titulo = elegida
    ? `${cuandoLegible(elegida.inicio).split(",")[0]} · ${elegida.cursos?.nombre ?? "Clase"} con ${elegida.profesoras?.nombre ?? "—"}`
    : "";

  return (
    <>
      <TituloPortal
        eyebrow="Owner"
        titulo="Asistencias pasadas"
        bajada="Para la alumna que bailó en una clase sin reserva. Crea la reserva que faltaba: descuenta el crédito que tenía ese día y la clase le cuenta a la profesora. Queda registrado quién, cuándo y por qué."
      />

      <ErrorDeLectura que="las asistencias registradas" error={retroactivas.error?.message ?? null} />
      <ErrorDeLectura que="las clases pasadas" error={clases.error?.message ?? null} />

      <div className="mb-12 border-y border-xo-negro/15 py-6" data-retroactivas-del-mes>
        <p className="xo-eyebrow text-xo-gris">Registradas después, {nombreDelMes(periodo)}</p>
        <p className="mt-1 font-display text-4xl leading-none text-xo-negro">{delMes.length}</p>
        <p className="mt-2 max-w-prose text-sm text-xo-gris">
          Si este número crece, el problema no es esta herramienta: es que nadie está marcando
          asistencia en la clase.
        </p>
      </div>

      <h2 className="xo-eyebrow text-xo-gris">1 · La clase</h2>
      {lista.length === 0 ? (
        <p className="mt-3 text-xo-gris">No hay clases dictadas en los últimos {DIAS_ATRAS} días.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10" data-clases-pasadas>
          {lista.map((c) => {
            const activa = c.id === elegida?.id;
            return (
              <li key={c.id}>
                <Link
                  href={activa ? "/owner/asistencias" : `/owner/asistencias?clase=${c.id}`}
                  aria-current={activa ? "true" : undefined}
                  className={`flex flex-wrap justify-between gap-2 py-3 ${activa ? "text-xo-negro" : "text-xo-negro/80 hover:text-xo-negro"}`}
                >
                  <span>
                    {activa ? "✦ " : ""}
                    {fecha(c.inicio)} · {c.cursos?.nombre} con {c.profesoras?.nombre}
                  </span>
                  <span className="text-sm text-xo-gris">{c.sedes?.nombre}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {elegida ? (
        <section className="mt-12" data-clase-elegida={elegida.id}>
          <h2 className="xo-eyebrow text-xo-gris">2 · Quién fue</h2>
          <p className="mt-2 text-xo-negro">{titulo}</p>
          <ErrorDeLectura que="las inscritas de esa clase" error={errorClase} />

          <p className="mt-4 text-sm text-xo-gris">
            Ya registradas: {inscritas.length} de {elegida.cupo_maximo} lugares. El cupo no se revisa en una clase
            pasada: si fueron más, fueron.
          </p>
          {inscritas.length > 0 ? (
            <ul className="mt-2 text-sm text-xo-negro" data-inscritas>
              {inscritas.map((i) => (
                <li key={i.perfil_id}>
                  {i.nombre ?? "Sin nombre"}
                  {i.origen === "retroactiva" ? <span className="text-xo-gris"> · registrada después</span> : null}
                </li>
              ))}
            </ul>
          ) : null}

          <form method="get" className="mt-6 flex flex-wrap gap-3">
            <input type="hidden" name="clase" value={elegida.id} />
            <label htmlFor="buscar-alumna" className="sr-only">
              Buscar alumna por nombre o correo
            </label>
            <input
              id="buscar-alumna"
              name="q"
              defaultValue={busqueda ?? ""}
              placeholder="Nombre o correo de la alumna"
              className="min-w-0 flex-1 rounded-md border border-xo-negro/20 bg-xo-blanco px-3 py-2 text-xo-negro"
            />
            <button type="submit" className="xo-eyebrow rounded-full bg-xo-rosa px-5 py-2.5 text-xo-negro">
              Buscar
            </button>
          </form>

          {busqueda ? (
            resultados.length === 0 ? (
              <p className="mt-4 text-xo-gris">Ninguna alumna sin reserva en esta clase coincide con “{busqueda}”.</p>
            ) : (
              <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10" data-resultados>
                {resultados.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="text-xo-negro">{p.nombre ?? "Sin nombre"}</span>
                    <RegistrarAsistencia perfilId={p.id} claseId={elegida.id} nombre={p.nombre} clase={titulo} />
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </section>
      ) : null}

      <h2 className="xo-eyebrow mt-14 text-xo-gris">Registradas este mes</h2>
      {delMes.length === 0 ? (
        <p className="mt-3 text-xo-gris">Ninguna todavía.</p>
      ) : (
        <ul className="mt-4 divide-y divide-xo-negro/10 border-y border-xo-negro/10" data-lista-retroactivas>
          {delMes.map((r) => (
            <li key={r.reserva_id} className="py-3">
              <p className="text-xo-negro">
                {r.alumna ?? "Sin nombre"} · {r.curso} con {r.profesora}, {cuandoLegible(r.clase_inicio).split(",")[0]}
              </p>
              <p className="text-sm text-xo-gris">
                “{r.motivo}” · {r.autor ?? "—"}, {cuandoLegible(r.registrada_at)}
                {r.lote_vencido_hoy ? " · con un crédito que hoy ya venció" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
