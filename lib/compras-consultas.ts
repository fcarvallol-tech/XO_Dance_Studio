import { clienteServidor } from "./supabase/servidor";
import { clienteAdmin } from "./supabase/admin";
import type {
  ClaseDelCalendario,
  Compra,
  EstadoCompra,
  ReservaPropia,
} from "./compras";

/**
 * Consultas de compras, créditos y reservas. **Solo servidor.**
 *
 * Todo lo que mira una alumna va con **su** sesión, no con la service role key:
 * si una política de RLS estuviera mal, devuelve vacío en vez de filtrar datos
 * de otra persona. La service role key aparece solo donde RLS no alcanza — el
 * conteo de cupos ajenos y los datos de transferencia.
 */

export type DatosTransferencia = {
  banco: string;
  tipoCuenta: string;
  numero: string;
  rut: string;
  titular: string;
  correo: string;
  /** Si falta cualquiera de los cuatro primeros, no se puede transferir. */
  completos: boolean;
};

export async function getDatosTransferencia(): Promise<DatosTransferencia> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("parametros")
    .select("clave, valor")
    .like("clave", "transferencia_%");

  const mapa = Object.fromEntries(
    ((data ?? []) as { clave: string; valor: string }[]).map((p) => [
      p.clave.replace("transferencia_", ""),
      p.valor.trim(),
    ]),
  );

  const datos = {
    banco: mapa.banco ?? "",
    tipoCuenta: mapa.tipo_cuenta ?? "",
    numero: mapa.numero ?? "",
    rut: mapa.rut ?? "",
    titular: mapa.titular ?? "",
    correo: mapa.correo ?? "",
  };

  return {
    ...datos,
    completos: Boolean(datos.banco && datos.numero && datos.rut && datos.titular),
  };
}

export async function getSaldo(perfilId: string): Promise<number> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("creditos")
    .select("cantidad_disponible, fecha_vencimiento")
    .eq("perfil_id", perfilId)
    .gt("fecha_vencimiento", new Date().toISOString());

  return ((data ?? []) as { cantidad_disponible: number }[]).reduce(
    (total, lote) => total + lote.cantidad_disponible,
    0,
  );
}

/** Cuándo vence el lote que vence antes. Es lo que se muestra como "hasta". */
export async function getProximoVencimiento(
  perfilId: string,
): Promise<string | null> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("creditos")
    .select("fecha_vencimiento")
    .eq("perfil_id", perfilId)
    .gt("cantidad_disponible", 0)
    .gt("fecha_vencimiento", new Date().toISOString())
    .order("fecha_vencimiento")
    .limit(1)
    .maybeSingle();

  return (data as { fecha_vencimiento: string } | null)?.fecha_vencimiento ?? null;
}

type FilaCompra = {
  id: string;
  cantidad_clases: number;
  monto_clp: number;
  estado: string;
  medio_pago: string;
  declarada_at: string;
  motivo_rechazo: string | null;
  perfil_id?: string;
  planes: { nombre: string } | null;
  perfiles?: { nombre: string | null; email: string | null } | null;
};

function aCompra(fila: FilaCompra): Compra {
  return {
    id: fila.id,
    planNombre: fila.planes?.nombre ?? `${fila.cantidad_clases} clases`,
    clases: fila.cantidad_clases,
    monto: fila.monto_clp,
    estado: fila.estado as EstadoCompra,
    medioPago: fila.medio_pago,
    declaradaAt: fila.declarada_at,
    motivoRechazo: fila.motivo_rechazo,
    perfilId: fila.perfil_id,
    alumna: fila.perfiles?.nombre ?? null,
    correoAlumna: fila.perfiles?.email ?? null,
  };
}

export async function getMisCompras(perfilId: string): Promise<Compra[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("compras")
    .select(
      "id, cantidad_clases, monto_clp, estado, medio_pago, declarada_at, motivo_rechazo, planes ( nombre )",
    )
    .eq("perfil_id", perfilId)
    .order("declarada_at", { ascending: false });

  return ((data ?? []) as unknown as FilaCompra[]).map(aCompra);
}

/** La bandeja de admin. Lee con la sesión: si no es admin, sale vacía. */
export async function getComprasPendientes(): Promise<Compra[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("compras")
    .select(
      "id, perfil_id, cantidad_clases, monto_clp, estado, medio_pago, declarada_at, motivo_rechazo, planes ( nombre ), perfiles ( nombre, email )",
    )
    .eq("estado", "pendiente")
    .order("declarada_at");

  return ((data ?? []) as unknown as FilaCompra[]).map(aCompra);
}

export async function getComprasResueltas(limite = 30): Promise<Compra[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("compras")
    .select(
      "id, perfil_id, cantidad_clases, monto_clp, estado, medio_pago, declarada_at, motivo_rechazo, planes ( nombre ), perfiles ( nombre, email )",
    )
    .neq("estado", "pendiente")
    .order("declarada_at", { ascending: false })
    .limit(limite);

  return ((data ?? []) as unknown as FilaCompra[]).map(aCompra);
}

type FilaClase = {
  id: string;
  inicio: string;
  cupo_maximo: number;
  cursos: { slug: string; nombre: string } | null;
  profesoras: { slug: string; nombre: string } | null;
  sedes: { nombre: string; comuna: string } | null;
};

/**
 * El calendario: las clases de los próximos N días con sus cupos tomados.
 *
 * **El conteo de reservas va con la service role key**, y es la única parte de
 * este archivo que no usa la sesión. No hay alternativa: una alumna no puede
 * leer las reservas de otra —la política de RLS se lo impide, y está bien— pero
 * sí necesita saber cuántos lugares quedan. Lo que se devuelve es un número,
 * nunca quién reservó.
 */
export async function getCalendario(
  perfilId: string,
  dias: number,
): Promise<ClaseDelCalendario[]> {
  const supabase = await clienteServidor();
  const desde = new Date();
  const hasta = new Date(desde.getTime() + dias * 24 * 60 * 60 * 1000);

  const { data } = await supabase
    .from("clases")
    .select(
      "id, inicio, cupo_maximo, cursos ( slug, nombre ), profesoras ( slug, nombre ), sedes ( nombre, comuna )",
    )
    .eq("estado", "programada")
    .gt("inicio", desde.toISOString())
    .lt("inicio", hasta.toISOString())
    .order("inicio");

  const clases = ((data ?? []) as unknown as FilaClase[]).filter(
    (c) => c.cursos && c.profesoras && c.sedes,
  );
  if (clases.length === 0) return [];

  const ids = clases.map((c) => c.id);

  const [{ data: todas }, { data: mias }] = await Promise.all([
    clienteAdmin()
      .from("reservas")
      .select("clase_id")
      .in("clase_id", ids)
      .in("estado", ["confirmada", "asistio"]),
    supabase
      .from("reservas")
      .select("id, clase_id")
      .eq("perfil_id", perfilId)
      .in("clase_id", ids)
      .in("estado", ["confirmada", "asistio"]),
  ]);

  const tomados = new Map<string, number>();
  for (const fila of (todas ?? []) as { clase_id: string }[]) {
    tomados.set(fila.clase_id, (tomados.get(fila.clase_id) ?? 0) + 1);
  }

  const propias = new Map(
    ((mias ?? []) as { id: string; clase_id: string }[]).map((r) => [r.clase_id, r.id]),
  );

  return clases.map((c) => ({
    id: c.id,
    inicio: c.inicio,
    cursoSlug: c.cursos!.slug,
    cursoNombre: c.cursos!.nombre,
    profesoraSlug: c.profesoras!.slug,
    profesoraNombre: c.profesoras!.nombre,
    sedeNombre: c.sedes!.nombre,
    sedeComuna: c.sedes!.comuna,
    cupoMaximo: c.cupo_maximo,
    tomados: tomados.get(c.id) ?? 0,
    reservaId: propias.get(c.id) ?? null,
  }));
}

type FilaReserva = {
  id: string;
  clase_id: string;
  estado: string;
  credito_devuelto: boolean;
  clases: {
    inicio: string;
    cursos: { nombre: string } | null;
    profesoras: { nombre: string } | null;
    sedes: { nombre: string; direccion: string } | null;
  } | null;
};

export async function getMisReservas(perfilId: string): Promise<ReservaPropia[]> {
  const supabase = await clienteServidor();
  const { data } = await supabase
    .from("reservas")
    .select(
      "id, clase_id, estado, credito_devuelto, clases ( inicio, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre, direccion ) )",
    )
    .eq("perfil_id", perfilId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as unknown as FilaReserva[])
    .filter((r) => r.clases)
    .map((r) => ({
      id: r.id,
      claseId: r.clase_id,
      inicio: r.clases!.inicio,
      cursoNombre: r.clases!.cursos?.nombre ?? "",
      profesoraNombre: r.clases!.profesoras?.nombre ?? "",
      sedeNombre: r.clases!.sedes?.nombre ?? "",
      sedeDireccion: r.clases!.sedes?.direccion ?? "",
      estado: r.estado,
      creditoDevuelto: r.credito_devuelto,
    }))
    .sort((a, b) => a.inicio.localeCompare(b.inicio));
}
