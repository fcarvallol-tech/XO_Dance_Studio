"use server";

import { revalidatePath } from "next/cache";
import { clienteAdmin } from "./supabase/admin";
import { clienteServidor } from "./supabase/servidor";
import { perfilActual } from "./sesion";
import { tieneNivel } from "./roles";
import {
  avisarCompraAprobada,
  avisarCompraRechazada,
  avisarEspecialConfirmada,
  avisarEspecialPendiente,
  avisarReserva,
  avisarTransferenciaDeclarada,
} from "./correo";
import { cuandoLegible } from "./compras";
import { instanteEnSantiago } from "./dominio/periodo";
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

  const compra = data as {
    perfil_id: string;
    cantidad_clases: number;
    clase_id: string | null;
    estado: string;
  } | null;

  if (compra) {
    const { data: alumna } = await admin
      .from("perfiles")
      .select("nombre, email")
      .eq("id", compra.perfil_id)
      .maybeSingle();

    // Las importadas tienen correo temporal .invalid: no se les escribe.
    const correo = alumna?.email ?? "";

    if (compra.clase_id) {
      // Una compra de clase especial no acredita créditos: confirma una
      // reserva. Mandarle "quedaste con 1 clase para reservar" sería mentirle
      // sobre lo que acaba de pasar.
      const { data: clase } = await admin
        .from("clases")
        .select("titulo, inicio, profesoras ( nombre ), sedes ( nombre, direccion )")
        .eq("id", compra.clase_id)
        .maybeSingle();

      const c = clase as unknown as {
        titulo: string | null;
        inicio: string;
        profesoras: { nombre: string } | null;
        sedes: { nombre: string; direccion: string } | null;
      } | null;

      // `por_reembolsar` es plata recibida sin cupo que dar: no se le escribe
      // "confirmada" a alguien que no tiene lugar. Lo resuelve admin a mano.
      if (correo && !correo.endsWith(".invalid") && c && compra.estado === "pagada") {
        await avisarEspecialConfirmada({
          para: correo,
          nombre: alumna?.nombre ?? null,
          titulo: c.titulo ?? "tu clase especial",
          cuando: cuandoLegible(c.inicio),
          profesora: c.profesoras?.nombre ?? "",
          sede: c.sedes?.nombre ?? "",
          direccion: c.sedes?.direccion ?? "",
        });
      }
    } else {
      const { data: lote } = await admin
        .from("creditos")
        .select("fecha_vencimiento")
        .eq("compra_id", compraId)
        .maybeSingle();

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
  }

  revalidatePath("/admin/compras");
  revalidatePath("/mis-clases");
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

// ---------------------------------------------------------------------------
// Clases especiales — PRD-0018 fases 4 y 6
// ---------------------------------------------------------------------------
// Misma forma que todo lo de arriba: se verifica la sesión acá y **la base
// vuelve a verificar el rol adentro**, porque estas funciones reciben al actor
// como parámetro y están concedidas solo a `service_role`. Ninguna escritura
// sobre una especial pasa por PostgREST: las políticas de insert/update de
// admin sobre `clases` quedaron limitadas a la parrilla (PRD-0018 §13).

/** Los campos del formulario que van a crear y a editar, ya saneados. */
function camposDeEspecial(datos: FormData) {
  const texto = (campo: string) => {
    const valor = String(datos.get(campo) ?? "").trim();
    return valor === "" ? null : valor;
  };
  const numero = (campo: string) => {
    const valor = texto(campo);
    if (valor === null) return null;
    const n = Number(valor);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };

  // La fecha llega del `datetime-local` como "2026-09-20T20:00": hora de
  // Santiago, sin zona. La convierte `instanteEnSantiago`, que tiene tests,
  // porque pegarle un "-03:00" fijo deja la clase corrida una hora medio año.
  const cuando = texto("inicio");
  const inicio = cuando ? instanteEnSantiago(cuando) : null;

  return {
    p_titulo: texto("titulo"),
    p_curso_id: texto("curso_id"),
    p_profesora_id: texto("profesora_id"),
    p_sede_id: texto("sede_id"),
    p_inicio: inicio ? inicio.toISOString() : null,
    p_duracion_min: numero("duracion_min"),
    p_cupo_maximo: numero("cupo_maximo"),
    p_cancion: texto("cancion"),
    p_descripcion: texto("descripcion"),
    p_dificultad: texto("dificultad"),
    p_reel_url: texto("reel_url"),
    p_precio_clp: numero("precio_clp"),
    p_minimo_alumnas: numero("minimo_alumnas"),
  };
}

export async function crearEspecial(
  datos: FormData,
): Promise<Resultado & { id?: string }> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }

  const { data, error } = await clienteAdmin().rpc("crear_especial", {
    p_actor_user_id: actor.userId,
    ...camposDeEspecial(datos),
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/admin/especiales");
  return { ok: true, id: (data as { id: string } | null)?.id };
}

export async function editarEspecial(datos: FormData): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }

  const id = String(datos.get("id") ?? "");
  const { error } = await clienteAdmin().rpc("editar_especial", {
    p_actor_user_id: actor.userId,
    p_clase_id: id,
    ...camposDeEspecial(datos),
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/admin/especiales");
  revalidatePath(`/admin/especiales/${id}`);
  return { ok: true };
}

/** Publicar: la base exige Reel, portada, fecha futura, profesora y sede. */
export async function publicarEspecial(claseId: string): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }

  const { error } = await clienteAdmin().rpc("publicar_especial", {
    p_actor_user_id: actor.userId,
    p_clase_id: claseId,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  // Lo público cambia en el momento: la lista, la ficha y el "desde $X".
  revalidatePath("/admin/especiales");
  revalidatePath("/clases-especiales");
  revalidatePath("/clases-especiales/[slug]", "page");
  revalidatePath("/");
  return { ok: true };
}

export async function borrarBorradorEspecial(claseId: string): Promise<Resultado> {
  const actor = await perfilActual();
  if (!actor || !tieneNivel(actor.rol, "admin")) {
    return { ok: false, mensaje: "No tienes permiso." };
  }

  const { error } = await clienteAdmin().rpc("borrar_borrador_especial", {
    p_actor_user_id: actor.userId,
    p_clase_id: claseId,
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  revalidatePath("/admin/especiales");
  return { ok: true };
}

/**
 * La alumna declara la transferencia de una clase especial.
 *
 * **Una sola llamada**: `reservar_especial` crea la compra pendiente y la
 * reserva `pendiente_pago` con su `expira_at` en la misma transacción, con la
 * clase bloqueada. Acá no se calcula el monto ni el vencimiento: los dos salen
 * de la base, que es la que sabe el precio de la clase y la retención vigente.
 */
export async function reservarEspecial(datos: FormData): Promise<Resultado> {
  const perfil = await perfilActual();
  if (!perfil) return { ok: false, mensaje: "Necesitas iniciar sesión." };

  const slug = String(datos.get("slug") ?? "");
  const titular = String(datos.get("titular") ?? "").trim() || null;
  const nota = String(datos.get("nota") ?? "").trim() || null;

  const admin = clienteAdmin();
  const { data: clase } = await admin
    .from("clases")
    .select("id, titulo, inicio, precio_clp, sedes ( nombre )")
    .eq("slug", slug)
    .maybeSingle();

  if (!clase) return { ok: false, mensaje: "Esa clase especial no existe." };

  const { data: reserva, error } = await admin.rpc("reservar_especial", {
    p_clase_id: clase.id,
    p_actor_user_id: perfil.userId,
    p_titular_declarado: titular,
    p_nota_alumna: nota,
    p_perfil_id: null,
    p_origen: "web",
  });

  if (error) return { ok: false, mensaje: comoMensaje(error) };

  const fila = reserva as { expira_at: string } | null;
  const c = clase as unknown as {
    titulo: string | null;
    inicio: string;
    precio_clp: number | null;
    sedes: { nombre: string } | null;
  };
  const correo = perfil.email ?? "";

  if (correo && !correo.endsWith(".invalid") && fila) {
    await avisarEspecialPendiente({
      para: correo,
      nombre: perfil.nombre,
      titulo: c.titulo ?? "la clase especial",
      cuando: cuandoLegible(c.inicio),
      sede: c.sedes?.nombre ?? "",
      monto: c.precio_clp ?? 0,
      expira: cuandoLegible(fila.expira_at),
    });
  }

  const { data: destino } = await admin
    .from("parametros")
    .select("valor")
    .eq("clave", "correo_academia")
    .maybeSingle();

  if (destino?.valor) {
    await avisarTransferenciaDeclarada({
      para: destino.valor,
      alumna: perfil.nombre ?? perfil.email ?? "Alguien",
      correoAlumna: perfil.email,
      plan: c.titulo ?? "Clase especial",
      monto: c.precio_clp ?? 0,
      titular,
    });
  }

  revalidatePath("/mis-clases");
  revalidatePath(`/clases-especiales/${slug}`);
  return { ok: true };
}
