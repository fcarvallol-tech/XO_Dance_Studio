// PRD-0010 parte 3 — la liquidación de noviembre de punta a punta, contra la
// base local: insumos en SQL, monto con lib/dominio/liquidacion.ts, pago con
// huella y comprobante, el candado del mes pagado, la anulación, y lo que ve
// cada rol (ADR-0008).
//
// Ojo: las funciones se llaman con `select * from f(...)`, nunca con
// `select (f(...)).*`, que en Postgres ejecuta la función una vez por columna.
// node scripts/base-local/escenario-liquidacion.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";
import { liquidar } from "../../lib/dominio/liquidacion.ts";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const pau = await persona(db, "pau@xo.test", "Pau");
const drimy = await persona(db, "drimy@xo.test", "Drimy");
const ana = await persona(db, "ana@xo.test", "Ana Alumna");
// Una profesora necesita su identidad del catálogo en el mismo cambio de rol
// (check perfiles_profesora_con_identidad).
await db.exec("alter table public.perfiles disable trigger user");
await db.query("update perfiles set rol = 'profesora', profesora_id = 'pau' where id = $1", [pau.perfilId]);
await db.query("update perfiles set rol = 'profesora', profesora_id = 'drimy' where id = $1", [drimy.perfilId]);
await db.exec("alter table public.perfiles enable trigger user");

const prof = async (slug) => (await uno(db, "select id from profesoras where slug = $1", [slug])).id;
const PAU = await prof("pau");
const DRIMY = await prof("drimy");
const horarioPau = await uno(db, "select * from horarios where profesora_id = $1 and activo order by id limit 1", [PAU]);
const capacidad = (await uno(db, "select capacidad from sedes where id = $1", [horarioPau.sede_id])).capacidad;

// Las migraciones de horarios generan clases solas: se borran para que el mes
// tenga solo las de este escenario y los montos sean los calculados a mano.
await db.exec("delete from public.clases");

// Veinte alumnas con un lote de 30 cada una, para poder llenar clases.
const alumnas = [];
for (let i = 0; i < 20; i++) {
  const a = await persona(db, `alumna${i}@xo.test`, `Alumna ${i}`);
  const c = await uno(db, `insert into creditos (perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
    values ($1, 30, 30, now() + interval '60 days') returning id`, [a.perfilId]);
  await db.query(`insert into movimientos_credito (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values ($1, $2, 'regalo', 30, 30, 'semilla', $3)`, [a.perfilId, c.id, owner.perfilId]);
  alumnas.push({ ...a, creditoId: c.id });
}

/** Una clase del horario de Pau en esa fecha, a las 19:00 de Santiago. */
async function clase(fecha) {
  return (await uno(db, `insert into clases (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
    values ($1, $2::date, ($2::date + time '19:00') at time zone 'America/Santiago', $3, $4, $5, $6) returning id`,
    [horarioPau.id, fecha, horarioPau.curso_id, PAU, horarioPau.sede_id, capacidad])).id;
}
/** n reservas confirmadas que consumen crédito, con su asiento en el libro. */
async function reservar(claseId, n) {
  for (let i = 0; i < n; i++) {
    const a = alumnas[i];
    const r = await uno(db, `insert into reservas (perfil_id, clase_id, credito_id) values ($1, $2, $3) returning id`, [a.perfilId, claseId, a.creditoId]);
    await db.query("update creditos set cantidad_disponible = cantidad_disponible - 1 where id = $1", [a.creditoId]);
    await db.query(`insert into movimientos_credito (perfil_id, credito_id, reserva_id, tipo, cantidad, saldo_resultante)
      values ($1, $2, $3, 'reserva', -1, 0)`, [a.perfilId, a.creditoId, r.id]);
  }
}
const libroCuadra = async () => {
  const r = await uno(db, `select (select sum(cantidad) from movimientos_credito)::int libro, (select sum(cantidad_disponible) from creditos)::int lotes`);
  assert.equal(r.libro, r.lotes, `libro ${r.libro} ≠ lotes ${r.lotes}`);
};

// El mes de noviembre, en la fecha real del computador (05/11/2026): las
// clases del 2 al 4 ya pasaron y se pueden marcar no dictadas.
const A1 = await clase("2026-11-02"); await reservar(A1, 16);
const A2 = await clase("2026-11-03"); await reservar(A2, 9);
const D = await clase("2026-11-04"); await reservar(D, 4);
const A3 = await clase("2026-11-10"); await reservar(A3, 12);
const A4 = await clase("2026-11-20"); await reservar(A4, 14); // será la recuperación de A2
const A5 = await clase("2026-11-24"); await reservar(A5, 14);
const C = await clase("2026-11-26"); await reservar(C, 8);   // la va a dictar Drimy
const S = await clase("2026-11-01"); await reservar(S, 7);   // Pau llega y no hay sala; A3 la recupera
const T = await clase("2026-11-27"); await reservar(T, 3);   // se cancela con semanas de anticipación

const sv = (sql, args) => servidor(db, (tx) => uno(tx, sql, args));
const registrar = (actor, claseId, causa, detalle = "Lo que pasó, con detalle", seP = false) =>
  sv("select * from public.registrar_no_dictada($1, $2, $3, $4, $5)", [actor.userId, claseId, causa, detalle, seP]);

/** Lo que haría la pantalla del owner: insumos + tarifa → lib/dominio. */
async function calcular(profesoraId, ahora = new Date("2026-12-02T12:00:00-03:00")) {
  const insumos = await como(db, owner, (tx) => filas(tx, "select * from public.insumos_liquidacion('2026-11-01')"));
  const t = await uno(db, "select * from costos_profesoras where profesora_id = $1", [profesoraId]);
  return liquidar({
    profesoraId,
    mes: "2026-11",
    ahora,
    tarifa: t ? { baseHoraClp: t.base_hora_clp, variableCreditoClp: t.variable_credito_clp, umbralVariable: t.umbral_variable } : null,
    clases: insumos.map((i) => ({
      id: i.clase_id, profesoraId: i.profesora_id, cursoId: i.curso_id,
      inicio: new Date(i.inicio).toISOString(), fin: i.fin ? new Date(i.fin).toISOString() : null,
      tipo: i.tipo, estado: i.estado, causa: i.causa,
      profesoraSePresento: i.profesora_se_presento,
      recuperada: i.recuperada, creditosConsumidos: i.creditos_consumidos,
    })),
  });
}
const huella = async (profesoraId) => (await como(db, owner, (tx) =>
  uno(tx, "select huella from public.huellas_liquidacion('2026-11-01') where profesora_id = $1", [profesoraId]))).huella;
const pagar = (actor, profesoraId, monto, h, comprobante = "liquidaciones/x.png", mes = "2026-11-01") =>
  sv("select * from public.pagar_liquidacion($1, $2, $3, $4, '{}'::jsonb, $5, $6)", [actor.userId, profesoraId, mes, monto, h, comprobante]);

console.log("\n1. Tarifas");
await paso("las cinco profesoras activas tienen tarifa, Isi incluida, con umbral 5", async () => {
  const r = await filas(db, `select p.slug, cp.base_hora_clp, cp.variable_credito_clp, cp.umbral_variable from profesoras p
    left join costos_profesoras cp on cp.profesora_id = p.id where p.activa order by p.slug`);
  for (const x of r) assert.deepEqual([x.base_hora_clp, x.variable_credito_clp, x.umbral_variable], [18000, 250, 5], x.slug);
  assert.ok(r.some((x) => x.slug === "isi"));
});

console.log("\n2. Marcar lo que no se dictó");
await paso("A2 (03/11) no dictada por asistencia: pasa a no_dictada y devuelve los 9 créditos", async () => {
  await registrar(admin, A2, "asistencia_insuficiente", "No llegaron alumnas suficientes");
  assert.equal((await uno(db, "select estado from clases where id = $1", [A2])).estado, "no_dictada");
  const r = await uno(db, "select count(*) filter (where credito_devuelto)::int dev, count(*)::int n from reservas where clase_id = $1", [A2]);
  assert.deepEqual([r.dev, r.n], [9, 9]);
  await libroCuadra();
});
await paso("una futura no se marca no dictada: se cancela", async () => {
  await falla(registrar(admin, A5, "sala_no_disponible"), /todavía no ocurre/);
});
await paso("la profesora no puede registrarlo, y una sesión no llama la función", async () => {
  await falla(registrar(pau, A1, "ausencia_profesora"), /admin o superior/);
  await falla(como(db, admin, (tx) => tx.query("select public.registrar_no_dictada($1, $2, 'sin_alumnas', 'detalle largo')", [admin.userId, A1])), /permission denied/);
});
await paso("D (04/11) cancelada a mano sin causa: devuelve créditos y deja a Pau bloqueada", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [D]);
  await libroCuadra();
  const r = await calcular(PAU);
  assert.deepEqual(r.bloqueos, [{ tipo: "clases_sin_causa", cuantas: 1 }]);
});
await paso("clasificar D como cambio de parrilla: sigue cancelada, ahora con causa, y desbloquea", async () => {
  await registrar(admin, D, "cambio_de_parrilla", "El horario se movió al jueves");
  assert.equal((await uno(db, "select estado from clases where id = $1", [D])).estado, "cancelada");
  assert.deepEqual((await calcular(PAU)).bloqueos, []);
});
await paso("S (01/11) sin sala y Pau se presentó: el campo queda prendido", async () => {
  await registrar(admin, S, "sala_no_disponible", "Llegó y la sala estaba ocupada", true);
  assert.equal((await uno(db, "select profesora_se_presento p from causas_de_clase where clase_id = $1", [S])).p, true);
});
await paso("reclasificar sin prenderlo lo apaga, y volver a prenderlo funciona", async () => {
  await registrar(admin, S, "sala_no_disponible", "Llegó y la sala estaba ocupada");
  assert.equal((await uno(db, "select profesora_se_presento p from causas_de_clase where clase_id = $1", [S])).p, false);
  await registrar(admin, S, "sala_no_disponible", "Llegó y la sala estaba ocupada", true);
});
await paso("el campo está apagado por defecto (A2 y D no lo traen)", async () => {
  const r = await filas(db, "select profesora_se_presento p from causas_de_clase where clase_id = any($1)", [[A2, D]]);
  assert.deepEqual(r.map((x) => x.p), [false, false]);
});
await paso("T (27/11) cancelada con tres semanas de anticipación, sin alumnas: queda con causa", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [T]);
  await registrar(admin, T, "sin_alumnas", "Se canceló con semanas de anticipación");
  assert.equal((await uno(db, "select estado from clases where id = $1", [T])).estado, "cancelada");
  await libroCuadra();
});
await paso("una no dictada no vuelve a programada", async () => {
  await falla(db.query("update clases set estado = 'programada' where id = $1", [A2]), /no vuelve a programada/);
});

console.log("\n3. Recuperación y reemplazo");
await paso("A4 (20/11) es la recuperación de A2: A2 queda recuperada", async () => {
  await sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A4, A2]);
  const i = await como(db, owner, (tx) => uno(tx, "select recuperada from public.insumos_liquidacion('2026-11-01') where clase_id = $1", [A2]));
  assert.equal(i.recuperada, true);
});
await paso("A3 (10/11) es la recuperación de S: S queda recuperada, con Pau presente", async () => {
  await sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A3, S]);
  const i = await como(db, owner, (tx) => uno(tx, "select recuperada, profesora_se_presento from public.insumos_liquidacion('2026-11-01') where clase_id = $1", [S]));
  assert.deepEqual([i.recuperada, i.profesora_se_presento], [true, true]);
});
await paso("una clase se recupera una sola vez", async () => {
  await falla(sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A5, A2]), /duplicate key|unique/i);
});
await paso("C (26/11) la dicta Drimy: pasa a ella y queda el registro", async () => {
  await sv("select id from public.reasignar_clase($1, $2, $3)", [admin.userId, C, DRIMY]);
  assert.equal((await uno(db, "select profesora_id from clases where id = $1", [C])).profesora_id, DRIMY);
  assert.equal((await uno(db, "select count(*)::int n from reasignaciones_de_clase where clase_id = $1", [C])).n, 1);
});

console.log("\n4. El monto, calculado con lib/dominio sobre los insumos de la base");
let liqPau;
// A mano, Pau (tarifa $18.000 la hora, $250 por crédito desde el sexto):
//   A1 02/11 dictada, 16 créditos ............ 18.000 + 11 × 250 = 20.750
//   A2 03/11 asistencia, recuperada .......... 0 (se paga en A4)
//   D  04/11 cambio de parrilla .............. 0
//   A3 10/11 dictada, 12 (recupera a S) ...... 18.000 +  7 × 250 = 19.750
//   A4 20/11 dictada, 14 (recupera a A2) ..... 18.000 +  9 × 250 = 20.250
//   A5 24/11 dictada, 14 ..................... 18.000 +  9 × 250 = 20.250
//   S  01/11 sin sala, se presentó, recuperada 18.000 (antes del 05/11: 0)
//   T  27/11 sin alumnas, avisada, no recup. . 18.000 (antes del 05/11: 0)
//   Incentivo: 16 + 14 + 14 + 12 = 56 → promedio 14 → 7.500
//   Total: 81.000 + 36.000 + 7.500 = 124.500
await paso("Pau: $124.500 = 20.750 + 0 + 0 + 19.750 + 20.250 + 20.250 + 18.000 + 18.000 + incentivo 7.500", async () => {
  liqPau = await calcular(PAU);
  const porClase = Object.fromEntries(liqPau.lineas.map((l) => [l.claseId, l.totalClp]));
  assert.deepEqual([porClase[A1], porClase[A2], porClase[D], porClase[A3], porClase[A4], porClase[A5], porClase[S], porClase[T]],
    [20_750, 0, 0, 19_750, 20_250, 20_250, 18_000, 18_000]);
  assert.equal(porClase[C], undefined, "la de Drimy no está en la de Pau");
  assert.equal(liqPau.incentivoClp, 7_500);
  assert.equal(liqPau.totalClp, 124_500);
});
await paso("Drimy: $18.750 por la clase que cubrió (8 créditos → 3 sobre el umbral)", async () => {
  const r = await calcular(DRIMY);
  assert.equal(r.totalClp, 18_750);
  assert.equal(r.incentivoClp, 0);
});

console.log("\n5. Pagar");
await paso("con el mes en curso (hoy real, 05/11) rebota", async () => {
  await falla(pagar(owner, PAU, 124_500, await huella(PAU)), /todavía no termina/);
});
// Desde acá, "hoy" es el 2 de diciembre.
await db.exec("create or replace function public.hoy_santiago() returns date language sql stable as $$ select date '2026-12-02' $$");
await paso("sin comprobante rebota", async () => {
  await falla(pagar(owner, PAU, 124_500, await huella(PAU), "  "), /comprobante/);
});
await paso("admin no puede pagar; una sesión no llama la función", async () => {
  await falla(pagar(admin, PAU, 124_500, await huella(PAU)), /Solo el owner/);
  await falla(como(db, owner, (tx) => tx.query("select public.pagar_liquidacion($1, $2, '2026-11-01', 1, '{}', 'x', 'y')", [owner.userId, PAU])), /permission denied/);
});
await paso("octubre no se paga: se pagó a mano", async () => {
  await falla(pagar(owner, PAU, 1000, "x", "c.png", "2026-10-01"), /noviembre de 2026/);
  await falla(como(db, owner, (tx) => tx.query("select * from public.insumos_liquidacion('2026-10-01')")), /noviembre de 2026/);
});
await paso("si algo cambió desde que se miró (la huella), rebota", async () => {
  const vieja = await huella(PAU);
  // Una reserva más en A5, de una alumna que no estaba (reservar() usa las primeras).
  const extra = alumnas[15];
  await db.query("insert into reservas (perfil_id, clase_id, credito_id) values ($1, $2, $3)", [extra.perfilId, A5, extra.creditoId]);
  await falla(pagar(owner, PAU, 124_500, vieja), /cambió mientras lo mirabas/);
  // Se deshace para seguir con los montos de arriba.
  await db.query("delete from reservas where perfil_id = $1 and clase_id = $2", [extra.perfilId, A5]);
});
let pagoId;
await paso("A2 con el campo prendido: asistencia no cobra el viaje, Pau sigue en $124.500 (Felipe, 06/11)", async () => {
  await registrar(admin, A2, "asistencia_insuficiente", "No llegaron alumnas suficientes", true);
  assert.equal((await calcular(PAU)).totalClp, 124_500);
  await registrar(admin, A2, "asistencia_insuficiente", "No llegaron alumnas suficientes");
});
await paso("prender o apagar profesora_se_presento mueve la huella: el pago viejo rebota", async () => {
  const vieja = await huella(PAU);
  await registrar(admin, D, "cambio_de_parrilla", "El horario se movió al jueves", true);
  assert.notEqual(await huella(PAU), vieja);
  await falla(pagar(owner, PAU, 124_500, vieja), /cambió mientras lo mirabas/);
  await registrar(admin, D, "cambio_de_parrilla", "El horario se movió al jueves", false);
  assert.equal(await huella(PAU), vieja);
});
await paso("pagar a Pau: liquidación de $124.500 con su huella y comprobante, y un egreso igual", async () => {
  const r = await pagar(owner, PAU, 124_500, await huella(PAU));
  pagoId = r.id;
  assert.equal(r.monto_clp, 124_500);
  const e = await uno(db, "select categoria, monto_clp, comprobante_path, fecha::text from egresos where id = $1", [r.egreso_id]);
  assert.deepEqual([e.categoria, e.monto_clp, e.comprobante_path, e.fecha], ["sueldo_profesora", 124_500, "liquidaciones/x.png", "2026-12-02"]);
});
await paso("pagar dos veces el mismo mes rebota", async () => {
  await falla(pagar(owner, PAU, 124_500, await huella(PAU)), /ya está pagado/);
});
await paso("con el mes pagado, marcar una clase o reasignarla rebota (va como ajuste)", async () => {
  await falla(registrar(admin, A1, "ausencia_profesora"), /ya se le pagó/);
  await falla(sv("select id from public.reasignar_clase($1, $2, $3)", [admin.userId, A1, DRIMY]), /ya se le pagó/);
});

console.log("\n6. Lo que ve cada una (ADR-0008)");
await paso("Pau ve sus clases del mes y ninguna de otra, sin columnas de alumnas", async () => {
  const r = await como(db, pau, (tx) => filas(tx, "select * from public.mis_insumos_liquidacion('2026-11-01')"));
  const ids = r.map((x) => x.clase_id);
  assert.deepEqual(new Set(ids), new Set([A1, A2, D, A3, A4, A5, S, T]));
  assert.ok(!ids.includes(C));
  const columnas = Object.keys(r[0]);
  assert.ok(!columnas.some((c) => /perfil|nombre|correo|email|rut|telefono|apoderado|monto|precio|costo/.test(c)), columnas.join(","));
});
await paso("Pau ve profesora_se_presento de las suyas: lo necesita para calcular lo mismo que el owner", async () => {
  const r = await como(db, pau, (tx) => uno(tx, "select profesora_se_presento p from public.mis_insumos_liquidacion('2026-11-01') where clase_id = $1", [S]));
  assert.equal(r.p, true);
});
await paso("Pau ve lo que se le pagó, sin comprobante ni quién pagó", async () => {
  const r = await como(db, pau, (tx) => filas(tx, "select * from public.mis_liquidaciones()"));
  assert.equal(r.length, 1);
  assert.equal(r[0].monto_clp, 124_500);
  assert.ok(!("comprobante_path" in r[0]) && !("pagada_por" in r[0]) && !("egreso_id" in r[0]));
});
await paso("Drimy ve solo la clase que cubrió, y nada pagado", async () => {
  const r = await como(db, drimy, (tx) => filas(tx, "select clase_id from public.mis_insumos_liquidacion('2026-11-01')"));
  assert.deepEqual(r.map((x) => x.clase_id), [C]);
  assert.equal((await como(db, drimy, (tx) => filas(tx, "select * from public.mis_liquidaciones()"))).length, 0);
});
await paso("las tablas, por API: la profesora y admin leen cero filas; anon, sin permiso", async () => {
  for (const quien of [pau, admin]) {
    assert.equal((await como(db, quien, (tx) => filas(tx, "select * from liquidaciones_profesoras"))).length, 0);
  }
  assert.equal((await como(db, pau, (tx) => filas(tx, "select * from causas_de_clase"))).length, 0);
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon"); await tx.query("select * from liquidaciones_profesoras"); }), /permission denied/);
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon"); await tx.query("select * from causas_de_clase"); }), /permission denied/);
});
await paso("admin ve las causas (las registra) pero no los insumos con montos del owner", async () => {
  assert.ok((await como(db, admin, (tx) => filas(tx, "select * from causas_de_clase"))).length >= 2);
  await falla(como(db, admin, (tx) => tx.query("select * from public.insumos_liquidacion('2026-11-01')")), /Solo el owner/);
  assert.equal((await como(db, admin, (tx) => filas(tx, "select * from public.mis_insumos_liquidacion('2026-11-01')"))).length, 0);
});
await paso("una alumna: cero filas en su 'liquidación', y anon sin permiso", async () => {
  assert.equal((await como(db, ana, (tx) => filas(tx, "select * from public.mis_insumos_liquidacion('2026-11-01')"))).length, 0);
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon"); await tx.query("select * from public.mis_insumos_liquidacion('2026-11-01')"); }), /permission denied/);
});
await paso("el detalle de la causa no se ve desde clases, que es pública", async () => {
  const cols = await filas(db, "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'clases'");
  assert.ok(!cols.some((c) => /causa|detalle/.test(c.column_name)));
});

console.log("\n7. Anular");
await paso("anular el pago: queda con deleted_at, anula el egreso y el mes vuelve a pendiente", async () => {
  await sv("select id from public.anular_liquidacion($1, $2, 'Lo marqué en la profe equivocada')", [owner.userId, pagoId]);
  const l = await uno(db, "select deleted_at, egreso_id from liquidaciones_profesoras where id = $1", [pagoId]);
  assert.ok(l.deleted_at);
  assert.ok((await uno(db, "select deleted_at from egresos where id = $1", [l.egreso_id])).deleted_at);
  await registrar(admin, A1, "sala_no_disponible", "Ahora sí se puede corregir"); // ya no está pagado
});

console.log("\n8. Las métricas dejan de contar una no dictada como dictada");
await paso("metricas_demanda: una pasada en pie es dictada; una no_dictada, no", async () => {
  const Z = await clase("2026-10-31"); // pasada y programada
  const m = (await como(db, owner, (tx) => uno(tx, "select public.metricas_demanda('2026-10-31', '2026-12-01') m"))).m;
  const porId = Object.fromEntries(m.por_clase.map((c) => [c.clase_id, c.dictada]));
  assert.equal(porId[Z], true);
  assert.equal(porId[A2], false);
});

resumen();
