/**
 * Siembra el escenario de PRD-0010 §11.4 en STAGING, más las dos clases
 * especiales que necesita la fase 3 de PRD-0018.
 *
 * Idempotente: los UUID son fijos y arranca borrando lo suyo, así que se puede
 * correr las veces que haga falta. Ningún dato real de ninguna alumna: cinco
 * correos `@ejemplo.invalid`, que es un TLD reservado y no existe.
 *
 * QUÉ SE SIEMBRA A MANO Y QUÉ SE EJECUTA DE VERDAD
 *
 * Las filas históricas se insertan directo, con sus fechas explícitas. No se
 * puede usar `acreditar_compra`: calcula el vencimiento como `now() + 60 días`,
 * así que las compras de hace dos meses quedarían venciendo dentro de dos y el
 * escenario perdería el lote vencido, que es justamente uno de los casos que
 * hay que probar. Consecuencia a tener clara: **esto prueba las métricas, no
 * prueba `acreditar_compra`.**
 *
 * Lo que sí puede correr en tiempo real corre de verdad, y son tres cosas:
 *   - `reservar()` para las dos reservas de la clase futura,
 *   - `cancelar_reserva()` para la cancelación a tiempo de Bea,
 *   - el trigger de clase cancelada, poniendo CL5 en `cancelada` con un update,
 *     que es exactamente como se cancela hoy desde el Table Editor.
 *
 * Esas tres eran deuda técnica anotada en ARCHITECTURE.md §10: el flujo de
 * cancelación nunca se había probado con datos porque había 0 reservas.
 *
 * LAS ESPECIALES (PRD-0018, fase 3)
 *
 * Se crean con `crear_especial()` y se publica una con `publicar_especial()`:
 * el camino real, no un insert. Quedan **sin reservas** y en el futuro, para no
 * mover ninguno de los 22 valores esperados de PRD-0010 §11.4 —una clase que no
 * se dictó no entra en la ocupación y una sin reservas no atribuye—. Todo lo
 * que reserva, acredita, suelta o cancela vive en `escenario-especiales.mjs`,
 * dentro de transacciones que se revierten.
 *
 * `especial_precio_default_clp` queda en **$12.000**, que es como lo deja la
 * migración. El caso de "admin no puede crear sin el valor de arranque" se
 * borra la fila él mismo, dentro de su transacción revertida: así el escenario
 * no depende de un efecto secundario de la siembra.
 */
import { conectar, ES } from "./staging.mjs";

const U = {
  ana: "11111111-1111-4111-8111-000000000001",
  bea: "11111111-1111-4111-8111-000000000002",
  cata: "11111111-1111-4111-8111-000000000003",
  emi: "11111111-1111-4111-8111-000000000004",
  dani: "11111111-1111-4111-8111-000000000005",
  owner: "11111111-1111-4111-8111-000000000009",
  admin: "11111111-1111-4111-8111-000000000008",
};
const CL = {
  1: "22222222-2222-4222-8222-000000000001",
  2: "22222222-2222-4222-8222-000000000002",
  3: "22222222-2222-4222-8222-000000000003",
  4: "22222222-2222-4222-8222-000000000004",
  5: "22222222-2222-4222-8222-000000000005",
};
const CO = {
  C0: "33333333-3333-4333-8333-000000000000",
  C1: "33333333-3333-4333-8333-000000000001",
  C2: "33333333-3333-4333-8333-000000000002",
  C3: "33333333-3333-4333-8333-000000000003",
  C4: "33333333-3333-4333-8333-000000000004",
  C5: "33333333-3333-4333-8333-000000000005",
  C6: "33333333-3333-4333-8333-000000000006",
  C7: "33333333-3333-4333-8333-000000000007",
};
const CR = {
  C0: "44444444-4444-4444-8444-000000000000",
  C1: "44444444-4444-4444-8444-000000000001",
  C2: "44444444-4444-4444-8444-000000000002",
  C3: "44444444-4444-4444-8444-000000000003",
  C4: "44444444-4444-4444-8444-000000000004",
  C5: "44444444-4444-4444-8444-000000000005",
  C6: "44444444-4444-4444-8444-000000000006",
  R1: "44444444-4444-4444-8444-00000000000a",
};
const RE = {
  anaCl1: "55555555-5555-4555-8555-000000000001",
  beaCl1: "55555555-5555-4555-8555-000000000002",
  anaCl2: "55555555-5555-4555-8555-000000000003",
  cataCl2: "55555555-5555-4555-8555-000000000004",
  anaCl3: "55555555-5555-4555-8555-000000000005",
  cataCl3: "55555555-5555-4555-8555-000000000006",
  anaCl5: "55555555-5555-4555-8555-000000000007",
};

/**
 * CUÁNDO PASA CADA COSA
 *
 * El escenario se ancla al **mes calendario**, no a los últimos 30 días, porque
 * es lo que muestra la página: si la siembra usa una ventana corrida y el
 * tablero un mes, los 22 valores esperados no se pueden contrastar contra la
 * pantalla, que es el punto de la fase 5.
 *
 * Los hechos del mes en curso se ubican en **fracciones del mes ya
 * transcurrido**, así que la siembra corre igual el día 3 que el 28. Los
 * vencimientos, en cambio, van relativos a `now()`: son los que tienen que caer
 * dentro o fuera de la ventana de 30 días y no dependen del calendario.
 */
const enEsteMes = (f) =>
  `(date_trunc('month', now()) + (now() - date_trunc('month', now())) * ${f})`;
const enElMesAnterior = (f) =>
  `(date_trunc('month', now() - interval '1 month') + ` +
  `(date_trunc('month', now()) - date_trunc('month', now() - interval '1 month')) * ${f})`;
const desdeAhora = (dias) => `(now() + interval '${dias} days')`;
/** Antes del mes anterior: queda fuera de los dos períodos, a propósito. */
const antesDeTodo = `(date_trunc('month', now() - interval '1 month') - interval '20 days')`;

const cliente = await conectar();
const q = (sql, params) => cliente.query(sql, params);

try {
  await q("begin");

  // -------------------------------------------------------------------------
  // 0. Borrón. En orden de llaves foráneas.
  // -------------------------------------------------------------------------
  const usuarios = Object.values(U);
  await q(
    `delete from public.movimientos_credito
     where perfil_id in (select id from public.perfiles where user_id = any($1))`,
    [usuarios],
  );
  await q(
    `delete from public.reservas
     where perfil_id in (select id from public.perfiles where user_id = any($1))`,
    [usuarios],
  );
  await q(
    `delete from public.creditos
     where perfil_id in (select id from public.perfiles where user_id = any($1))`,
    [usuarios],
  );
  await q(
    `delete from public.compras
     where perfil_id in (select id from public.perfiles where user_id = any($1))`,
    [usuarios],
  );
  await q(`delete from public.clases where id = any($1)`, [Object.values(CL)]);
  // Las especiales de corridas anteriores, por título. Van antes que los
  // perfiles: `clases.creada_por` apunta a quien la creó.
  await q(
    `delete from public.clases where tipo = 'especial' and titulo = any($1)`,
    [Object.values(ES)],
  );
  await q(`delete from public.perfiles where user_id = any($1)`, [usuarios]);
  await q(`delete from auth.users where id = any($1)`, [usuarios]);

  // -------------------------------------------------------------------------
  // 1. Las cuentas. El perfil lo crea el trigger sobre auth.users, como en la
  //    vida real: acá no se inserta ningún perfil a mano.
  // -------------------------------------------------------------------------
  const gente = [
    [U.ana, "ana@ejemplo.invalid", "Ana Prueba"],
    [U.bea, "bea@ejemplo.invalid", "Bea Prueba"],
    [U.cata, "cata@ejemplo.invalid", "Cata Prueba"],
    [U.emi, "emi@ejemplo.invalid", "Emi Prueba"],
    [U.dani, "dani@ejemplo.invalid", "Dani Prueba"],
    [U.owner, "owner@ejemplo.invalid", "Owner de Prueba"],
    [U.admin, "admin@ejemplo.invalid", "Admin de Prueba"],
  ];
  for (const [id, email, nombre] of gente) {
    await q(
      `insert into auth.users
         (instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, created_at, updated_at,
          raw_app_meta_data, raw_user_meta_data)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated',
               'authenticated', $2,
               extensions.crypt('escenario-prd-0010', extensions.gen_salt('bf')),
               now(), now(), now(),
               '{"provider":"email","providers":["email"]}'::jsonb,
               jsonb_build_object('full_name', $3::text))`,
      [id, email, nombre],
    );
  }

  // ⚠️ GoTrue escanea las columnas de token de `auth.users` como texto y no
  // como texto nullable. Insertando a mano quedan en NULL y **cualquier
  // consulta suya falla** con "Database error finding user": el magic link no
  // se puede ni generar. Insertando por la API de admin no pasa, porque las
  // escribe vacías. Se replica eso acá.
  await q(
    `update auth.users set
       confirmation_token = coalesce(confirmation_token, ''),
       recovery_token = coalesce(recovery_token, ''),
       email_change = coalesce(email_change, ''),
       email_change_token_new = coalesce(email_change_token_new, ''),
       email_change_token_current = coalesce(email_change_token_current, ''),
       phone_change = coalesce(phone_change, ''),
       phone_change_token = coalesce(phone_change_token, ''),
       reauthentication_token = coalesce(reauthentication_token, '')
     where id = any($1)`,
    [usuarios],
  );

  // El perfil completo, con telefono: sin `perfil_completo_at` los layouts
  // mandan a /completar-perfil y no se llega a ninguna pagina del portal.
  await q(
    `update public.perfiles
     set telefono = '+56900000000', perfil_completo_at = now()
     where user_id = any($1)`,
    [usuarios],
  );

  // Los roles se ponen a mano porque `cambiar_rol` exige un actor que ya sea
  // admin, y en una base recién creada no hay ninguno. Es la única escritura
  // del escenario que se salta el camino real, y solo afecta a las dos cuentas
  // de staff: las cinco alumnas quedan con el rol que les puso el trigger.
  await q(`update public.perfiles set rol = 'owner' where user_id = $1`, [U.owner]);
  await q(`update public.perfiles set rol = 'admin' where user_id = $1`, [U.admin]);

  const perfil = {};
  const { rows: perfiles } = await q(
    `select user_id, id from public.perfiles where user_id = any($1)`,
    [usuarios],
  );
  for (const p of perfiles) {
    perfil[Object.keys(U).find((k) => U[k] === p.user_id)] = p.id;
  }

  // -------------------------------------------------------------------------
  // 2. Las clases. Tres horarios distintos, con tres profesoras distintas,
  //    para que el ranking tenga a quién ordenar.
  // -------------------------------------------------------------------------
  const { rows: horarios } = await q(
    `select distinct on (h.profesora_id)
            h.id, h.curso_id, h.profesora_id, h.sede_id
     from public.horarios h
     where h.activo
     order by h.profesora_id, h.id
     limit 3`,
  );
  if (horarios.length < 3) throw new Error("staging necesita 3 horarios activos");
  const [hA, hB, hC] = horarios;

  const clases = [
    [CL[1], hA, enEsteMes(0.25)],
    [CL[2], hB, enEsteMes(0.45)],
    [CL[3], hC, enEsteMes(0.65)],
    [CL[4], hA, desdeAhora(3)], // la única futura
    [CL[5], hB, enEsteMes(0.35)], // la que XO va a cancelar
  ];
  for (const [id, h, cuando] of clases) {
    await q(
      `insert into public.clases
         (id, horario_id, fecha, inicio, curso_id, profesora_id, sede_id,
          cupo_maximo, estado)
       values ($1, $2, ${cuando}::date, ${cuando}, $3, $4, $5, 22, 'programada')`,
      [id, h.id, h.curso_id, h.profesora_id, h.sede_id],
    );
  }

  // -------------------------------------------------------------------------
  // 3. Compras, lotes y asientos del libro.
  // -------------------------------------------------------------------------
  const planId = async (slug) =>
    (await q(`select id from public.planes where slug = $1`, [slug])).rows[0].id;

  //  id  alumna  plan  monto  cuándo se aprobó  clases  cuándo vence
  const compras = [
    [CO.C0, "ana", "pack-2", 16000, antesDeTodo, 2, desdeAhora(-20)], // vencido
    [CO.C1, "ana", "pack-4", 28000, enElMesAnterior(0.3), 4, desdeAhora(33)],
    [CO.C2, "bea", "pack-2", 16000, enElMesAnterior(0.15), 2, desdeAhora(25)], // por vencer
    [CO.C3, "ana", "pack-8", 48000, enEsteMes(0.2), 8, desdeAhora(54)],
    [CO.C4, "bea", "pack-4", 28000, enEsteMes(0.3), 4, desdeAhora(55)],
    [CO.C5, "cata", "suelta", 8500, enEsteMes(0.5), 1, desdeAhora(56)],
    [CO.C6, "emi", "pack-4", 28000, enEsteMes(0.6), 4, desdeAhora(57)],
  ];
  const loteDe = { [CO.C0]: CR.C0, [CO.C1]: CR.C1, [CO.C2]: CR.C2, [CO.C3]: CR.C3,
                   [CO.C4]: CR.C4, [CO.C5]: CR.C5, [CO.C6]: CR.C6 };

  for (const [id, quien, slug, monto, cuando, clases_, vence] of compras) {
    await q(
      `insert into public.compras
         (id, perfil_id, plan_id, cantidad_clases, monto_clp, estado, medio_pago,
          declarada_at, aprobada_por, aprobada_at, created_at)
       values ($1, $2, $3, $4, $5, 'pagada', 'transferencia',
               ${cuando}, $6, ${cuando}, ${cuando})`,
      [id, perfil[quien], await planId(slug), clases_, monto, perfil.owner],
    );
    await q(
      `insert into public.creditos
         (id, perfil_id, compra_id, cantidad_inicial, cantidad_disponible,
          fecha_vencimiento, created_at)
       values ($1, $2, $3, $4, $4, ${vence}, ${cuando})`,
      [loteDe[id], perfil[quien], id, clases_],
    );
    await q(
      `insert into public.movimientos_credito
         (perfil_id, credito_id, tipo, cantidad, saldo_resultante, creado_por, created_at)
       values ($1, $2, 'compra', $3, public.saldo_creditos($1), $4, ${cuando})`,
      [perfil[quien], loteDe[id], clases_, perfil.owner],
    );
  }

  // La compra que Dani declaró y que nadie aprobó. No es ingreso: es una
  // intención. Sin lote y sin asiento.
  await q(
    `insert into public.compras
       (id, perfil_id, plan_id, cantidad_clases, monto_clp, estado, medio_pago,
        declarada_at, created_at)
     values ($1, $2, $3, 4, 28000, 'pendiente', 'transferencia',
             ${enEsteMes(0.7)}, ${enEsteMes(0.7)})`,
    [CO.C7, perfil.dani, await planId("pack-4")],
  );

  // El regalo de Cata: un lote sin compra detrás, con motivo y autor.
  await q(
    `insert into public.creditos
       (id, perfil_id, compra_id, cantidad_inicial, cantidad_disponible,
        fecha_vencimiento, created_at)
     values ($1, $2, null, 2, 2, ${desdeAhora(58)}, ${enEsteMes(0.5)})`,
    [CR.R1, perfil.cata],
  );
  await q(
    `insert into public.movimientos_credito
       (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por, created_at)
     values ($1, $2, 'regalo', 2, public.saldo_creditos($1),
             'Cortesía del escenario de prueba', $3, ${enEsteMes(0.5)})`,
    [perfil.cata, CR.R1, perfil.owner],
  );

  // -------------------------------------------------------------------------
  // 4. Las reservas pasadas. A mano, porque `reservar()` no deja reservar una
  //    clase que ya ocurrió — y con razón.
  // -------------------------------------------------------------------------
  //  id  alumna  clase  lote  cuándo reservó  estado  devuelto  cuándo canceló
  const pasadas = [
    [RE.anaCl1, "ana", CL[1], CR.C1, enEsteMes(0.24), "confirmada", false, null],
    [RE.beaCl1, "bea", CL[1], CR.C2, enEsteMes(0.24), "confirmada", false, null],
    [RE.anaCl2, "ana", CL[2], CR.C1, enEsteMes(0.44), "confirmada", false, null],
    // Cata canceló tarde: perdió el crédito. Cuenta como consumo y atribuye.
    [RE.cataCl2, "cata", CL[2], CR.R1, enEsteMes(0.4), "cancelada", false, enEsteMes(0.46)],
    [RE.anaCl3, "ana", CL[3], CR.C1, enEsteMes(0.64), "confirmada", false, null],
    [RE.cataCl3, "cata", CL[3], CR.C5, enEsteMes(0.64), "confirmada", false, null],
    // La de CL5 la va a cancelar el trigger cuando XO cancele la clase.
    [RE.anaCl5, "ana", CL[5], CR.C3, enEsteMes(0.34), "confirmada", false, null],
  ];
  for (const [id, quien, clase, lote, cuando, estado, devuelto, cancelada] of pasadas) {
    await q(
      `insert into public.reservas
         (id, perfil_id, clase_id, credito_id, estado, credito_devuelto,
          cancelada_at, origen, created_at)
       values ($1, $2, $3, $4, $5, $6, ${cancelada ?? "null"}, 'web', ${cuando})`,
      [id, perfil[quien], clase, lote, estado, devuelto],
    );
    await q(
      `update public.creditos set cantidad_disponible = cantidad_disponible - 1
       where id = $1`,
      [lote],
    );
    await q(
      `insert into public.movimientos_credito
         (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante,
          creado_por, created_at)
       values ($1, $2, $3, 'reserva', -1, public.saldo_creditos($1), $1, ${cuando})`,
      [perfil[quien], lote, id],
    );
  }

  await q("commit");

  // -------------------------------------------------------------------------
  // 5. Lo que sí corre de verdad, fuera de la transacción de siembra.
  // -------------------------------------------------------------------------
  // Ana reserva la clase futura. `reservar()` elige el lote que vence primero:
  // debe tomar el último crédito de C1, no uno de C3.
  const { rows: r1 } = await q(`select public.reservar($1, $2) as r`, [CL[4], U.ana]);
  // Bea reserva y cancela a tiempo: el crédito tiene que volver a su lote.
  const { rows: r2 } = await q(`select (public.reservar($1, $2)).id as id`, [CL[4], U.bea]);
  await q(`select public.cancelar_reserva($1, $2)`, [r2[0].id, U.bea]);
  // XO cancela CL5. Se hace con un update, que es como se cancela hoy: el
  // trigger tiene que devolverle el crédito a Ana y cerrar su reserva.
  await q(
    `update public.clases
     set estado = 'cancelada', motivo_cancelacion = 'Escenario de prueba'
     where id = $1`,
    [CL[5]],
  );

  // -------------------------------------------------------------------------
  // 6. Las dos clases especiales (PRD-0018 fase 3).
  // -------------------------------------------------------------------------
  // El valor de arranque queda como lo deja la migración en producción: $12.000.
  // Antes esta línea lo **borraba**, para que el escenario pudiera probar que
  // admin no puede crear sin él; ese caso ahora se borra la fila él mismo,
  // dentro de su transacción revertida, y staging queda pareja con producción.
  await q(
    `insert into public.parametros (clave, valor, descripcion)
     values ('especial_precio_default_clp', '12000',
             'Precio con el que nace el formulario de una clase especial. PRD-0018 §8.4.')
     on conflict (clave) do update set valor = excluded.valor`,
  );

  // Curso, profesora y sede salen de un horario activo real de cada sede: así
  // la especial es coherente con el catálogo y el solape se puede probar contra
  // la parrilla que ya existe.
  const contexto = async (sedeSlug) => {
    const { rows } = await q(
      `select h.curso_id, h.profesora_id, h.sede_id
       from public.horarios h
       join public.cursos c on c.id = h.curso_id
       join public.sedes s on s.id = h.sede_id
       where h.activo and c.slug <> 'teens' and s.slug = $1
       order by h.id
       limit 1`,
      [sedeSlug],
    );
    if (!rows[0]) throw new Error(`staging no tiene horario activo en ${sedeSlug}`);
    return rows[0];
  };

  // A las 13:00 UTC, o sea temprano en la mañana en Santiago: ninguna clase de
  // la parrilla está a esa hora, así que la validación de solape no rebota por
  // una razón que no es la que se quiere probar.
  const enLaManana = (dias) =>
    `(date_trunc('day', now() + interval '${dias} days') + interval '13 hours')`;

  const leones = await contexto("seduccion-latina");
  const diaguitas = await contexto("diaguitas");

  // El precio lo pone owner y es $15.000 a propósito: distinto del default
  // confirmado ($12.000, PRD-0009 §8), para que en las pruebas se note cuál de
  // los dos números se está usando.
  const { rows: espPub } = await q(
    `select (public.crear_especial(
       p_actor_user_id => $1,
       p_titulo => $5,
       p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
       p_inicio => ${enLaManana(5)},
       p_duracion_min => 90, p_cupo_maximo => 2,
       p_cancion => 'Tema de prueba', p_descripcion => 'Clase especial del escenario de staging.',
       p_dificultad => 'intermedio',
       p_reel_url => 'https://www.instagram.com/reel/ESCENARIO0018/',
       p_portada_path => 'escenario/coreo-del-escenario.jpg',
       p_precio_clp => 15000, p_minimo_alumnas => 5
     )).id as id`,
    [U.owner, leones.curso_id, leones.profesora_id, leones.sede_id, ES.publicada],
  );
  await q(`select public.publicar_especial($1, $2)`, [U.owner, espPub[0].id]);

  await q(
    `select public.crear_especial(
       p_actor_user_id => $1,
       p_titulo => $5,
       p_curso_id => $2, p_profesora_id => $3, p_sede_id => $4,
       p_inicio => ${enLaManana(9)},
       p_duracion_min => 60, p_cupo_maximo => 22,
       p_precio_clp => 20000
     )`,
    [U.owner, diaguitas.curso_id, diaguitas.profesora_id, diaguitas.sede_id, ES.borrador],
  );

  const { rows: chequeo } = await q(
    `select titulo, precio_clp, cupo_maximo,
            publicada_at is not null as publicada, slug
     from public.clases where tipo = 'especial' and titulo = any($1) order by inicio`,
    [Object.values(ES)],
  );

  console.log("Escenario sembrado.");
  console.log("  reserva de Ana en la clase futura:", r1[0].r ? "ok" : "falló");
  for (const c of chequeo) {
    console.log(
      `  especial ${c.publicada ? "publicada" : "borrador "} · ${c.slug} · ` +
        `$${c.precio_clp} · cupo ${c.cupo_maximo}`,
    );
  }
} catch (e) {
  await q("rollback").catch(() => {});
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
