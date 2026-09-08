/**
 * Siembra el escenario de PRD-0010 §11.4 en STAGING.
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
 */
import { conectar } from "./staging.mjs";

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
    [CL[1], hA, -18],
    [CL[2], hB, -11],
    [CL[3], hC, -4],
    [CL[4], hA, +3],
    [CL[5], hB, -7],
  ];
  for (const [id, h, dias] of clases) {
    await q(
      `insert into public.clases
         (id, horario_id, fecha, inicio, curso_id, profesora_id, sede_id,
          cupo_maximo, estado)
       values ($1, $2, (now() + make_interval(days => $3))::date,
               now() + make_interval(days => $3), $4, $5, $6, 22, 'programada')`,
      [id, h.id, dias, h.curso_id, h.profesora_id, h.sede_id],
    );
  }

  // -------------------------------------------------------------------------
  // 3. Compras, lotes y asientos del libro.
  // -------------------------------------------------------------------------
  const planId = async (slug) =>
    (await q(`select id from public.planes where slug = $1`, [slug])).rows[0].id;

  //  id  alumna  plan       monto  dias aprobada  clases  vence (dias)
  const compras = [
    [CO.C0, "ana", "pack-2", 16000, -75, 2, -15],
    [CO.C1, "ana", "pack-4", 28000, -45, 4, +15],
    [CO.C2, "bea", "pack-2", 16000, -35, 2, +25],
    [CO.C3, "ana", "pack-8", 48000, -20, 8, +40],
    [CO.C4, "bea", "pack-4", 28000, -12, 4, +48],
    [CO.C5, "cata", "suelta", 8500, -5, 1, +55],
    [CO.C6, "emi", "pack-4", 28000, -3, 4, +57],
  ];
  const loteDe = { [CO.C0]: CR.C0, [CO.C1]: CR.C1, [CO.C2]: CR.C2, [CO.C3]: CR.C3,
                   [CO.C4]: CR.C4, [CO.C5]: CR.C5, [CO.C6]: CR.C6 };

  for (const [id, quien, slug, monto, dias, clases_, vence] of compras) {
    await q(
      `insert into public.compras
         (id, perfil_id, plan_id, cantidad_clases, monto_clp, estado, medio_pago,
          declarada_at, aprobada_por, aprobada_at, created_at)
       values ($1, $2, $3, $4, $5, 'pagada', 'transferencia',
               now() + make_interval(days => $6), $7,
               now() + make_interval(days => $6),
               now() + make_interval(days => $6))`,
      [id, perfil[quien], await planId(slug), clases_, monto, dias, perfil.owner],
    );
    await q(
      `insert into public.creditos
         (id, perfil_id, compra_id, cantidad_inicial, cantidad_disponible,
          fecha_vencimiento, created_at)
       values ($1, $2, $3, $4, $4, now() + make_interval(days => $5),
               now() + make_interval(days => $6))`,
      [loteDe[id], perfil[quien], id, clases_, vence, dias],
    );
    await q(
      `insert into public.movimientos_credito
         (perfil_id, credito_id, tipo, cantidad, saldo_resultante, creado_por, created_at)
       values ($1, $2, 'compra', $3, public.saldo_creditos($1), $4,
               now() + make_interval(days => $5))`,
      [perfil[quien], loteDe[id], clases_, perfil.owner, dias],
    );
  }

  // La compra que Dani declaró y que nadie aprobó. No es ingreso: es una
  // intención. Sin lote y sin asiento.
  await q(
    `insert into public.compras
       (id, perfil_id, plan_id, cantidad_clases, monto_clp, estado, medio_pago,
        declarada_at, created_at)
     values ($1, $2, $3, 4, 28000, 'pendiente', 'transferencia',
             now() - interval '2 days', now() - interval '2 days')`,
    [CO.C7, perfil.dani, await planId("pack-4")],
  );

  // El regalo de Cata: un lote sin compra detrás, con motivo y autor.
  await q(
    `insert into public.creditos
       (id, perfil_id, compra_id, cantidad_inicial, cantidad_disponible,
        fecha_vencimiento, created_at)
     values ($1, $2, null, 2, 2, now() + interval '56 days', now() - interval '4 days')`,
    [CR.R1, perfil.cata],
  );
  await q(
    `insert into public.movimientos_credito
       (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por, created_at)
     values ($1, $2, 'regalo', 2, public.saldo_creditos($1),
             'Cortesía del escenario de prueba', $3, now() - interval '4 days')`,
    [perfil.cata, CR.R1, perfil.owner],
  );

  // -------------------------------------------------------------------------
  // 4. Las reservas pasadas. A mano, porque `reservar()` no deja reservar una
  //    clase que ya ocurrió — y con razón.
  // -------------------------------------------------------------------------
  //  id  alumna  clase  lote  dias  estado  devuelto  cancelada(dias)
  const pasadas = [
    [RE.anaCl1, "ana", CL[1], CR.C1, -18, "confirmada", false, null],
    [RE.beaCl1, "bea", CL[1], CR.C2, -18, "confirmada", false, null],
    [RE.anaCl2, "ana", CL[2], CR.C1, -11, "confirmada", false, null],
    // Cata canceló tarde: perdió el crédito. Cuenta como consumo y atribuye.
    [RE.cataCl2, "cata", CL[2], CR.R1, -12, "cancelada", false, -11],
    [RE.anaCl3, "ana", CL[3], CR.C1, -4, "confirmada", false, null],
    [RE.cataCl3, "cata", CL[3], CR.C5, -4, "confirmada", false, null],
    // La de CL5 la va a cancelar el trigger cuando XO cancele la clase.
    [RE.anaCl5, "ana", CL[5], CR.C3, -7, "confirmada", false, null],
  ];
  for (const [id, quien, clase, lote, dias, estado, devuelto, cancelada] of pasadas) {
    await q(
      `insert into public.reservas
         (id, perfil_id, clase_id, credito_id, estado, credito_devuelto,
          cancelada_at, origen, created_at)
       values ($1, $2, $3, $4, $5, $6,
               case when $7::int is null then null
                    else now() + make_interval(days => $7::int) end,
               'web', now() + make_interval(days => $8))`,
      [id, perfil[quien], clase, lote, estado, devuelto, cancelada, dias],
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
       values ($1, $2, $3, 'reserva', -1, public.saldo_creditos($1), $1,
               now() + make_interval(days => $4))`,
      [perfil[quien], lote, id, dias],
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

  console.log("Escenario sembrado.");
  console.log("  reserva de Ana en la clase futura:", r1[0].r ? "ok" : "falló");
} catch (e) {
  await q("rollback").catch(() => {});
  console.error("ERROR:", e.message);
  process.exitCode = 1;
} finally {
  await cliente.end();
}
