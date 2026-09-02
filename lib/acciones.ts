"use server";

import { revalidatePath } from "next/cache";
import { clienteAdmin } from "./supabase/admin";
import { clienteServidor } from "./supabase/servidor";
import { perfilActual } from "./sesion";
import { tieneNivel } from "./roles";
import {
  avisarCompraAprobada,
  avisarCompraRechazada,
  avisarReserva,
  avisarTransferenciaDeclarada,
} from "./correo";
import { cuandoLegible } from "./compras";
import { fechaLegible } from "./planes";

/**
 * Las escrituras de plata y cupo.
 *
 * Todas siguen la misma forma: **verificar la sesión acá, ejecutar en la base**.
 * Las funciones `acreditar_compra`, `reservar` y `cancelar_reserva` están
 * concedidas solo a `service_role`, así que se llaman con el cliente admin
 * después de saber quién pide — y vuelven a validar todo adentro, porque son la
 * única capa que resiste una llamada directa.
 *
 * El correo va **después** de que la transacción cerró, y su resultado no
 * cambia el de la acción: un aviso que no salió no revierte una acreditación.
 */

export type Resultado = { ok: true } | { ok: false; mensaje: string };

/** Traduce un error de Postgres a algo que se pueda mostrar. */
function comoMensaje(error: { message: string; code?: string } | null): string {
  if (!error) return "No se pudo completar la operación.";
  // Los mensajes de las funciones están escritos para mostrarse.
  if (["23514", "42501", "22023", "P0002", "23503"].includes(error.code ?? "")) {
    return error.message;
  }
  console.error("Error inesperado en una acción:", error);
  return "Algo falló de nuestro lado. Intenta de nuevo en un momento.";
}

/** La alumna declara que transfirió. No mueve plata ni cupo: solo deja la fila. */
export async function declararTransferencia(datos: FormData): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, mensaje: "Necesitas iniciar sesión." };

  const planSlug = String(datos.get("plan") ?? "");
  const titular = String(datos.get("titular") ?? "").trim() || null;
  const nota = String(datos.get("nota") ?? "").trim() || null;

  const supabase = await clienteServidor();
  const { data: plan } = await supabase
    .from("planes")
    .select("id, nombre, cantidad_clases, precio_clp, precio_promocional, promo_hasta")
    .eq("slug", planSlug)
    .maybeSingle();

  if (!plan) return { ok: false, mensaje: "Ese plan no existe." };

  // El monto lo calcula el servidor, nunca llega del formulario: si viniera del
  // cliente, cualquiera podría declarar que pagó $1.
  const hoy = new Date().toISOString().slice(0, 10);
  const enPromo =
    plan.precio_promocional !== null && plan.promo_hasta !== null && plan.promo_hasta >= hoy;
  const monto = enPromo ? plan.precio_promocional! : plan.precio_clp;

  const { error } = await supabase.from("compras").insert({
    perfil_id: perfil.id,
    plan_id: plan.id,
    cantidad_clases: plan.cantidad_clases,
    monto_clp: monto,
    medio_pago: "transferencia",
    titular_declarado: titular,
    nota_alumna: nota,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  const { data: destino } = await supabase
    .from("parametros")
    .select("valor")
    .eq("clave", "correo_academia")
    .maybeSingle();

  if (destino?.valor) {
    await avisarTransferenciaDeclarada({
      para: destino.valor,
      alumna: perfil.nombre ?? perfil.email ?? "Alguien",
      correoAlumna: perfil.email,
      plan: plan.nombre,
      monto,
      titular,
    });
  }

  revalidatePath("/mis-clases");
  return { ok: true };
}

/** Admin aprueba: acredita las clases. Idempotente en la base. */
export async function aprobarCompra(compraId: string): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }

  const admin = clienteAdmin();
  const { data, error } = await admin.rpc("acreditar_compra", {
    p_compra_id: compraId,
    p_actor_user_id: actor.userId,
    p_motivo: null,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  const compra = data as { perfil_id: string; cantidad_clases: number } | null;
  if (compra) {
    const [{ data: alumna }, { data: lote }] = await Promise.all([
      admin.from("perfiles").select("nombre, email").eq("id", compra.perfil_id).maybeSingle(),
      admin
        .from("creditos")
        .select("fecha_vencimiento")
        .eq("compra_id", compraId)
        .maybeSingle(),
    ]);

    // Las importadas tienen correo temporal .invalid: no se les escribe.
    const correo = alumna?.email ?? "";
    if (correo && !correo.endsWith(".invalid")) {
      await avisarCompraAprobada({
        para: correo,
        nombre: alumna?.nombre ?? null,
        clases: compra.cantidad_clases,
        vence: lote?.fecha_vencimiento
          ? fechaLegible(lote.fecha_vencimiento.slice(0, 10))
          : "60 días",
      });
    }
  }

  revalidatePath("/admin/compras");
  return { ok: true };
}

export async function rechazarCompra(
  compraId: string,
  motivo: string,
): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }
  if (!motivo.trim()) return { ok: false, mensaje: "Un rechazo necesita motivo." };

  const admin = clienteAdmin();
  const { data, error } = await admin.rpc("rechazar_compra", {
    p_compra_id: compraId,
    p_actor_user_id: actor.userId,
    p_motivo: motivo,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  const compra = data as { perfil_id: string } | null;
  if (compra) {
    const { data: alumna } = await admin
      .from("perfiles")
      .select("nombre, email")
      .eq("id", compra.perfil_id)
      .maybeSingle();

    const correo = alumna?.email ?? "";
    if (correo && !correo.endsWith(".invalid")) {
      await avisarCompraRechazada({
        para: correo,
        nombre: alumna?.nombre ?? null,
        motivo: motivo.trim(),
      });
    }
  }

  revalidatePath("/admin/compras");
  return { ok: true };
}

/** Reservar. El cupo y el crédito los resuelve la base, en una transacción. */
export async function reservarClase(claseId: string): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, mensaje: "Necesitas iniciar sesión." };

  const admin = clienteAdmin();
  const { error } = await admin.rpc("reservar", {
    p_clase_id: claseId,
    p_actor_user_id: perfil.userId,
    p_perfil_id: null,
    p_origen: "web",
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  const { data: clase } = await admin
    .from("clases")
    .select(
      "inicio, cursos ( nombre ), profesoras ( nombre ), sedes ( nombre, direccion )",
    )
    .eq("id", claseId)
    .maybeSingle();

  const correo = perfil.email ?? "";
  if (clase && correo && !correo.endsWith(".invalid")) {
    const c = clase as unknown as {
      inicio: string;
      cursos: { nombre: string } | null;
      profesoras: { nombre: string } | null;
      sedes: { nombre: string; direccion: string } | null;
    };
    await avisarReserva({
      para: correo,
      curso: c.cursos?.nombre ?? "tu clase",
      cuando: cuandoLegible(c.inicio),
      profesora: c.profesoras?.nombre ?? "",
      sede: c.sedes?.nombre ?? "",
      direccion: c.sedes?.direccion ?? "",
    });
  }

  revalidatePath("/reservar");
  revalidatePath("/mis-clases");
  return { ok: true };
}

export async function cancelarReserva(reservaId: string): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, mensaje: "Necesitas iniciar sesión." };

  const { error } = await clienteAdmin().rpc("cancelar_reserva", {
    p_reserva_id: reservaId,
    p_actor_user_id: perfil.userId,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/reservar");
  revalidatePath("/mis-clases");
  return { ok: true };
}

/**
 * Una profesora pide un bloque nuevo.
 *
 * Se inserta con **su** sesión, no con la service role key: la política
 * `solicitudes_crea_la_suya` exige que `profesora_id` sea el suyo, así que no
 * puede pedir a nombre de otra ni aunque manipule el formulario.
 */
export async function pedirHorario(datos: FormData): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, mensaje: "Necesitas iniciar sesión." };

  const supabase = await clienteServidor();

  const { data: profesora } = await supabase
    .from("profesoras")
    .select("id")
    .eq("slug", perfil.profesoraId ?? "")
    .maybeSingle();

  if (!profesora) {
    return { ok: false, mensaje: "Tu cuenta no está enlazada a una profesora." };
  }

  const dia = Number(datos.get("dia"));
  const hora = String(datos.get("hora") ?? "");
  const cursoId = String(datos.get("curso") ?? "").trim() || null;
  const propuesto = String(datos.get("propuesto") ?? "").trim() || null;
  const sedeId = String(datos.get("sede") ?? "").trim() || null;
  const mensaje = String(datos.get("mensaje") ?? "").trim() || null;

  if (!Number.isInteger(dia) || dia < 1 || dia > 7) {
    return { ok: false, mensaje: "Elige un día de la semana." };
  }
  if (!/^\d{2}:\d{2}$/.test(hora)) {
    return { ok: false, mensaje: "Escribe la hora como 20:00." };
  }
  if (!cursoId && !propuesto) {
    return { ok: false, mensaje: "Dinos qué curso quieres hacer, o proponnos uno." };
  }

  const { error } = await supabase.from("solicitudes_horario").insert({
    profesora_id: profesora.id,
    dia_semana: dia,
    hora,
    curso_id: cursoId,
    curso_propuesto: propuesto,
    sede_id: sedeId,
    mensaje,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/profesora/solicitudes");
  revalidatePath("/admin/solicitudes");
  return { ok: true };
}

/** Admin responde una solicitud. La respuesta es obligatoria: ella la lee. */
export async function resolverSolicitud(
  solicitudId: string,
  estado: "aprobada" | "rechazada",
  respuesta: string,
): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }
  if (!respuesta.trim()) {
    return { ok: false, mensaje: "Contéstale algo: va a leer esto." };
  }

  const { error } = await clienteAdmin().rpc("resolver_solicitud", {
    p_solicitud_id: solicitudId,
    p_actor_user_id: actor.userId,
    p_estado: estado,
    p_respuesta: respuesta,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/admin/solicitudes");
  revalidatePath("/profesora/solicitudes");
  return { ok: true };
}
