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
import { liquidar, noEntraEnEstePago } from "../../lib/dominio/liquidacion.ts";

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
// Pau tiene Reggaeton Femme dos veces por semana: martes 18:00 en Los Leones y
// jueves 19:30 en Diaguitas. **Es el mismo curso con dos horarios**, y el
// incentivo se saca por horario (Felipe, 10/11/2026).
const MARTES = await uno(db, "select * from horarios where profesora_id = $1 and activo and dia_semana = 2", [PAU]);
const JUEVES = await uno(db, "select * from horarios where profesora_id = $1 and activo and dia_semana = 4", [PAU]);
assert.equal(MARTES.curso_id, JUEVES.curso_id, "los dos horarios de Pau son el mismo curso");
const capacidad = (await uno(db, "select capacidad from sedes where id = $1", [MARTES.sede_id])).capacidad;

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

/**
 * Una clase de ese horario de Pau en esa fecha, a la hora del horario. Una
 * recuperativa lleva el horario de la que recupera, aunque caiga otro día: así
 * la crea `crear_recuperativa`.
 */
async function clase(fecha, horario = MARTES) {
  return (await uno(db, `insert into clases (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
    values ($1, $2::date, ($2::date + $7::time) at time zone 'America/Santiago', $3, $4, $5, $6) returning id`,
    [horario.id, fecha, horario.curso_id, PAU, horario.sede_id, capacidad, horario.hora])).id;
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

// Noviembre de Pau, como un mes real. Desde la fecha real del computador
// (10/11/2026): las del 3 y el 5 ya pasaron y se pueden marcar no dictadas.
//
// Martes (18:00, Los Leones): el horario con sus 4 clases del mes.
const A2 = await clase("2026-11-03"); await reservar(A2, 9);   // no llegaron alumnas; se recupera el viernes 27
const A1 = await clase("2026-11-10"); await reservar(A1, 16);
const A3 = await clase("2026-11-17"); await reservar(A3, 15);
const A5 = await clase("2026-11-24"); await reservar(A5, 14);
const A4 = await clase("2026-11-27"); await reservar(A4, 12);  // viernes: la recuperación de A2, con el horario de los martes
// Jueves (19:30, Diaguitas).
const D = await clase("2026-11-05", JUEVES); await reservar(D, 4);   // se cancela a mano sin causa
const S = await clase("2026-11-12", JUEVES); await reservar(S, 7);   // Pau llega y no hay sala; R2 la recupera
const C = await clase("2026-11-19", JUEVES); await reservar(C, 8);   // la va a dictar Drimy
const R2 = await clase("2026-11-21", JUEVES); await reservar(R2, 14); // sábado: la recuperación de S
const T = await clase("2026-11-26", JUEVES); await reservar(T, 3);   // se cancela con semanas de anticipación

const sv = (sql, args) => servidor(db, (tx) => uno(tx, sql, args));
const registrar = (actor, claseId, causa, detalle = "Lo que pasó, con detalle", seP = false) =>
  sv("select * from public.registrar_no_dictada($1, $2, $3, $4, $5)", [actor.userId, claseId, causa, detalle, seP]);

/** Lo que haría la pantalla del owner: insumos + tarifa → lib/dominio. */
async function calcular(profesoraId, ahora = new Date("2026-12-02T12:00:00-03:00"), mes = "2026-11") {
  const insumos = await como(db, owner, (tx) => filas(tx, "select * from public.insumos_liquidacion($1)", [`${mes}-01`]));
  const t = await uno(db, "select * from costos_profesoras where profesora_id = $1", [profesoraId]);
  return liquidar({
    profesoraId,
    mes,
    ahora,
    tarifa: t ? { baseHoraClp: t.base_hora_clp, variableCreditoClp: t.variable_credito_clp, umbralVariable: t.umbral_variable } : null,
    clases: insumos.map((i) => ({
      id: i.clase_id, profesoraId: i.profesora_id, cursoId: i.curso_id,
      inicio: new Date(i.inicio).toISOString(), fin: i.fin ? new Date(i.fin).toISOString() : null,
      tipo: i.tipo, estado: i.estado, causa: i.causa,
      profesoraSePresento: i.profesora_se_presento,
      recuperada: i.recuperada, creditosConsumidos: i.creditos_consumidos,
      curso: i.curso, sede: i.sede,
      horarioId: i.horario_id, diaSemana: i.dia_semana, hora: i.hora,
      recuperacionInicio: i.recuperacion_inicio ? new Date(i.recuperacion_inicio).toISOString() : null,
      recuperaInicio: i.recupera_inicio ? new Date(i.recupera_inicio).toISOString() : null,
      noSeRecuperaAt: i.no_se_recupera_at ? new Date(i.no_se_recupera_at).toISOString() : null,
    })),
  });
}
const huella = async (profesoraId) => (await como(db, owner, (tx) =>
  uno(tx, "select huella from public.huellas_liquidacion('2026-11-01') where profesora_id = $1", [profesoraId]))).huella;
const cerrar = (actor, profesoraId, monto, h, mes = "2026-11-01") =>
  sv("select * from public.cerrar_liquidacion($1, $2, $3, $4, '{}'::jsonb, $5)", [actor.userId, profesoraId, mes, monto, h]);
const pagar = (actor, liquidacionId, comprobante = "liquidaciones/x.png") =>
  sv("select * from public.pagar_liquidacion($1, $2, $3)", [actor.userId, liquidacionId, comprobante]);

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
await paso("D (05/11) cancelada a mano sin causa: devuelve créditos y deja a Pau bloqueada", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [D]);
  await libroCuadra();
  const r = await calcular(PAU);
  assert.deepEqual(r.bloqueos, [{ tipo: "clases_sin_causa", cuantas: 1 }]);
});
await paso("clasificar D como cambio de parrilla: sigue cancelada, ahora con causa, y desbloquea", async () => {
  await registrar(admin, D, "cambio_de_parrilla", "Ese jueves no estaba en la parrilla");
  assert.equal((await uno(db, "select estado from clases where id = $1", [D])).estado, "cancelada");
  assert.deepEqual((await calcular(PAU)).bloqueos, []);
});
await paso("S (12/11) sin sala y Pau se presentó: el campo queda prendido", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [S]);
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
await paso("T (26/11) cancelada con tres semanas de anticipación, sin alumnas: queda con causa", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [T]);
  await registrar(admin, T, "sin_alumnas", "Se canceló con semanas de anticipación");
  assert.equal((await uno(db, "select estado from clases where id = $1", [T])).estado, "cancelada");
  await libroCuadra();
});
await paso("una no dictada no vuelve a programada", async () => {
  await falla(db.query("update clases set estado = 'programada' where id = $1", [A2]), /no vuelve a programada/);
});

console.log("\n3. Recuperación y reemplazo");
await paso("A4 (viernes 27/11) es la recuperación de A2 (martes 03/11): A2 queda recuperada", async () => {
  await sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A4, A2]);
  const i = await como(db, owner, (tx) => uno(tx, "select recuperada from public.insumos_liquidacion('2026-11-01') where clase_id = $1", [A2]));
  assert.equal(i.recuperada, true);
});
await paso("R2 (sábado 21/11) es la recuperación de S (jueves 12/11): S queda recuperada, con Pau presente", async () => {
  await sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, R2, S]);
  const i = await como(db, owner, (tx) => uno(tx, "select recuperada, profesora_se_presento from public.insumos_liquidacion('2026-11-01') where clase_id = $1", [S]));
  assert.deepEqual([i.recuperada, i.profesora_se_presento], [true, true]);
});
await paso("una clase se recupera una sola vez", async () => {
  await falla(sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A5, A2]), /duplicate key|unique/i);
});
await paso("C (19/11) la dicta Drimy: pasa a ella y queda el registro", async () => {
  await sv("select id from public.reasignar_clase($1, $2, $3)", [admin.userId, C, DRIMY]);
  assert.equal((await uno(db, "select profesora_id from clases where id = $1", [C])).profesora_id, DRIMY);
  assert.equal((await uno(db, "select count(*)::int n from reasignaciones_de_clase where clase_id = $1", [C])).n, 1);
});

console.log("\n4. El monto, calculado con lib/dominio sobre los insumos de la base");
await paso("cada clase dice a qué horario cuenta; la recuperativa del viernes, al de los martes", async () => {
  const r = await como(db, owner, (tx) => filas(tx, "select clase_id, horario_id, dia_semana, hora from public.insumos_liquidacion('2026-11-01')"));
  const de = Object.fromEntries(r.map((x) => [x.clase_id, x]));
  for (const id of [A1, A2, A3, A4, A5]) assert.equal(de[id].horario_id, MARTES.id);
  for (const id of [D, S, R2, T]) assert.equal(de[id].horario_id, JUEVES.id);
  assert.deepEqual([de[A4].dia_semana, de[A4].hora], [2, "18:00"]);
});
await paso("una recuperación con otro horario_id cuenta igual en el de la que recupera", async () => {
  // marcar_recuperacion acepta cualquier clase del mismo curso: no se confía
  // en que traiga el horario de la original.
  await db.exec("begin");
  await db.query("update clases set horario_id = $1 where id = $2", [JUEVES.id, A4]);
  const r = await como(db, owner, (tx) => uno(tx, "select horario_id from public.insumos_liquidacion('2026-11-01') where clase_id = $1", [A4]));
  await db.exec("rollback");
  assert.equal(r.horario_id, MARTES.id);
});
let liqPau;
// A mano, Pau (tarifa $18.000 la hora, $250 por crédito desde el sexto):
//   Martes
//   A2 03/11 asistencia, recuperada .......... 0 (se paga en A4)
//   A1 10/11 dictada, 16 créditos ............ 18.000 + 11 × 250 = 20.750
//   A3 17/11 dictada, 15 ..................... 18.000 + 10 × 250 = 20.500
//   A5 24/11 dictada, 14 ..................... 18.000 +  9 × 250 = 20.250
//   A4 27/11 recupera A2, 12 ................. 18.000 +  7 × 250 = 19.750
//   Jueves
//   D  05/11 cambio de parrilla .............. 0
//   S  12/11 sin sala, se presentó, recuperada 18.000
//   C  19/11 la dicta Drimy .................. no es de Pau
//   R2 21/11 recupera S, 14 .................. 18.000 +  9 × 250 = 20.250
//   T  26/11 sin alumnas, sin recuperar ...... 0, pendiente
//   Incentivo, por horario:
//     martes: 4 dictadas (10, 17, 24 y la del 27); 16 + 15 + 14 + 12 = 57 ≥ 56 → promedio 14,25
//             → primer objetivo $7.500; el segundo pide 88
//     jueves: 1 dictada (R2) → faltan 3, no opta → $0
//   Base: 5 dictadas × 18.000 = 90.000, más el viaje de S 18.000 = 108.000
//   Variable: 2.750 + 2.500 + 2.250 + 1.750 + 2.250 = 11.500
//   Total: 108.000 + 11.500 + 7.500 = 127.000
await paso("Pau: $127.000 = 20.750 + 20.500 + 20.250 + 19.750 (martes) + 18.000 (S) + 20.250 (R2) + objetivo de los martes 7.500", async () => {
  liqPau = await calcular(PAU);
  const porClase = Object.fromEntries(liqPau.lineas.map((l) => [l.claseId, l.totalClp]));
  assert.deepEqual([porClase[A2], porClase[A1], porClase[A3], porClase[A5], porClase[A4], porClase[D], porClase[S], porClase[R2], porClase[T]],
    [0, 20_750, 20_500, 20_250, 19_750, 0, 18_000, 20_250, 0]);
  assert.equal(porClase[C], undefined, "la de Drimy no está en la de Pau");
  assert.equal(liqPau.baseClp, 108_000);
  assert.equal(liqPau.variableClp, 11_500);
  assert.equal(liqPau.incentivoClp, 7_500);
  assert.equal(liqPau.totalClp, 127_000);
});
await paso("el incentivo de Pau: martes con 4 y el primer objetivo; jueves con 1, faltan 3", async () => {
  const [martes, jueves] = liqPau.incentivos;
  assert.deepEqual([martes.horarioId, martes.etiqueta, martes.dictadas, martes.promedio], [MARTES.id, "Reggaeton Femme, martes", 4, 14.25]);
  assert.deepEqual(martes.objetivos.map((o) => o.logrado), [true, false]);
  assert.deepEqual(martes.clasesDelPromedio.map((c) => c.claseId), [A1, A3, A5, A4]);
  assert.deepEqual([jueves.horarioId, jueves.etiqueta, jueves.dictadas, jueves.faltan], [JUEVES.id, "Reggaeton Femme, jueves", 1, 3]);
  assert.equal(jueves.explicacion, "1 clase dictada en este horario: faltan 3 para optar a los objetivos del mes.");
});
await paso("Drimy: $18.750 por la clase que cubrió (8 créditos → 3 sobre el umbral)", async () => {
  const r = await calcular(DRIMY);
  assert.equal(r.totalClp, 18_750);
  assert.equal(r.incentivoClp, 0);
});

console.log("\n4b. Pendiente y 'no se va a recuperar' (Felipe, 07/11)");
const marcar = (actor, claseId, si) => sv("select * from public.marcar_no_se_recupera($1, $2, $3)", [actor.userId, claseId, si]);
await paso("T pendiente: $0 y en 'lo que no entra' como pendiente; no bloquea el mes", async () => {
  const r = await calcular(PAU);
  const n = noEntraEnEstePago(r.lineas, "2026-11").find((x) => x.claseId === T);
  assert.equal(n.razon, "pendiente");
  assert.deepEqual(r.bloqueos, []);
});
await paso("admin no marca; una sesión no llama la función", async () => {
  await falla(marcar(admin, T, true), /Solo el owner/);
  await falla(como(db, owner, (tx) => tx.query("select public.marcar_no_se_recupera($1, $2, true)", [owner.userId, T])), /permission denied/);
});
await paso("no se marca una recuperada (A2) ni una de cambio de parrilla (D)", async () => {
  await falla(marcar(owner, A2, true), /ya tiene recuperación/);
  await falla(marcar(owner, D, true), /nada que marcar/);
});
let huellaSinMarca;
await paso("owner marca T en noviembre: paga la base acá, Pau sube a $145.000 y la huella cambia", async () => {
  huellaSinMarca = await huella(PAU);
  const f = await marcar(owner, T, true);
  assert.ok(f.no_se_recupera_at);
  assert.equal(f.no_se_recupera_por, owner.perfilId);
  const r = await calcular(PAU);
  assert.equal(r.lineas.find((l) => l.claseId === T).totalClp, 18_000);
  assert.equal(r.totalClp, 145_000);
  assert.notEqual(await huella(PAU), huellaSinMarca);
});
await paso("marcar dos veces no cambia la fecha", async () => {
  const antes = (await uno(db, "select no_se_recupera_at t from causas_de_clase where clase_id = $1", [T])).t;
  const f = await marcar(owner, T, true);
  assert.equal(new Date(f.no_se_recupera_at).getTime(), new Date(antes).getTime());
});
await paso("una marcada no se recupera: ni con marcar_recuperacion ni escribiendo la columna", async () => {
  await falla(sv("select id from public.marcar_recuperacion($1, $2, $3)", [admin.userId, A5, T]), /no se va a recuperar/);
  await falla(db.query("update clases set recupera_clase_id = $1 where id = $2", [T, A5]), /no se va a recuperar/);
});
await paso("quitar la marca la devuelve a pendiente: $127.000 y la misma huella de antes", async () => {
  const f = await marcar(owner, T, false);
  assert.equal(f.no_se_recupera_at, null);
  assert.equal((await calcular(PAU)).totalClp, 127_000);
  assert.equal(await huella(PAU), huellaSinMarca);
});
await paso("marcada en diciembre: noviembre sigue en $127.000 con la misma huella, y la base va en diciembre", async () => {
  await db.query("update causas_de_clase set no_se_recupera_at = '2026-12-03 12:00-03' where clase_id = $1", [T]);
  assert.equal((await calcular(PAU)).totalClp, 127_000);
  assert.equal(await huella(PAU), huellaSinMarca);
  const dic = await calcular(PAU, new Date("2027-01-02T12:00:00-03:00"), "2026-12");
  const l = dic.lineas.find((x) => x.claseId === T);
  assert.equal(l.totalClp, 18_000);
  assert.match(l.explicacion, /noviembre/);
  await db.query("update causas_de_clase set no_se_recupera_at = null where clase_id = $1", [T]);
});

console.log("\n5. Cerrar y pagar");
await paso("con el mes en curso (hoy real) no se cierra", async () => {
  await falla(cerrar(owner, PAU, 127_000, await huella(PAU)), /todavía no termina/);
});
// Desde acá, "hoy" es el 2 de diciembre.
await db.exec("create or replace function public.hoy_santiago() returns date language sql stable as $$ select date '2026-12-02' $$");
await paso("admin no puede cerrar; una sesión no llama la función", async () => {
  await falla(cerrar(admin, PAU, 127_000, await huella(PAU)), /Solo el owner/);
  await falla(como(db, owner, (tx) => tx.query("select public.cerrar_liquidacion($1, $2, '2026-11-01', 1, '{}', 'x')", [owner.userId, PAU])), /permission denied/);
});
await paso("octubre no se cierra: se pagó a mano", async () => {
  await falla(cerrar(owner, PAU, 1000, "x", "2026-10-01"), /noviembre de 2026/);
  await falla(como(db, owner, (tx) => tx.query("select * from public.insumos_liquidacion('2026-10-01')")), /noviembre de 2026/);
});
await paso("si algo cambió desde que se miró (la huella), rebota", async () => {
  const vieja = await huella(PAU);
  // Una reserva más en A5, de una alumna que no estaba (reservar() usa las primeras).
  const extra = alumnas[15];
  await db.query("insert into reservas (perfil_id, clase_id, credito_id) values ($1, $2, $3)", [extra.perfilId, A5, extra.creditoId]);
  await falla(cerrar(owner, PAU, 127_000, vieja), /cambió mientras lo mirabas/);
  // Se deshace para seguir con los montos de arriba.
  await db.query("delete from reservas where perfil_id = $1 and clase_id = $2", [extra.perfilId, A5]);
});
let pagoId;
await paso("A2 con el campo prendido: asistencia no cobra el viaje, Pau sigue en $127.000 (Felipe, 06/11)", async () => {
  await registrar(admin, A2, "asistencia_insuficiente", "No llegaron alumnas suficientes", true);
  assert.equal((await calcular(PAU)).totalClp, 127_000);
  await registrar(admin, A2, "asistencia_insuficiente", "No llegaron alumnas suficientes");
});
await paso("prender o apagar profesora_se_presento mueve la huella: el cierre viejo rebota", async () => {
  const vieja = await huella(PAU);
  await registrar(admin, D, "cambio_de_parrilla", "Ese jueves no estaba en la parrilla", true);
  assert.notEqual(await huella(PAU), vieja);
  await falla(cerrar(owner, PAU, 127_000, vieja), /cambió mientras lo mirabas/);
  await registrar(admin, D, "cambio_de_parrilla", "Ese jueves no estaba en la parrilla", false);
  assert.equal(await huella(PAU), vieja);
});
await paso("cerrar a Pau: fila de $127.000 con su huella, sin pago ni egreso todavía", async () => {
  const r = await cerrar(owner, PAU, 127_000, await huella(PAU));
  pagoId = r.id;
  assert.deepEqual([r.monto_clp, r.pagada_at, r.egreso_id, r.comprobante_path], [127_000, null, null, null]);
  assert.ok(r.cerrada_at);
});
await paso("cerrar dos veces el mismo mes no duplica: devuelve la misma fila", async () => {
  const r = await cerrar(owner, PAU, 127_000, await huella(PAU));
  assert.equal(r.id, pagoId);
  assert.equal((await uno(db, "select count(*)::int n from liquidaciones_profesoras where profesora_id = $1", [PAU])).n, 1);
});
await paso("cerrar con otro cálculo rebota", async () => {
  await falla(cerrar(owner, PAU, 127_000, "otra-huella"), /ya está cerrado/);
});
await paso("el libro no se edita: ni el monto, ni el detalle, ni borrar", async () => {
  await falla(db.query("update liquidaciones_profesoras set monto_clp = 1 where id = $1", [pagoId]), /no se cambia/);
  await falla(db.query("update liquidaciones_profesoras set detalle = '{\"x\":1}' where id = $1", [pagoId]), /no se cambia/);
  await falla(db.query("delete from liquidaciones_profesoras where id = $1", [pagoId]), /no se borra/);
});
await paso("con el mes cerrado, marcar una clase o reasignarla rebota", async () => {
  await falla(registrar(admin, A1, "ausencia_profesora"), /ya se le pagó/);
  await falla(sv("select id from public.reasignar_clase($1, $2, $3)", [admin.userId, A1, DRIMY]), /ya se le pagó/);
});
await paso("pagar sin comprobante rebota; admin no paga; una sesión no llama la función", async () => {
  await falla(pagar(owner, pagoId, "  "), /comprobante/);
  await falla(pagar(admin, pagoId), /Solo el owner/);
  await falla(como(db, owner, (tx) => tx.query("select public.pagar_liquidacion($1, $2, 'y')", [owner.userId, pagoId])), /permission denied/);
});
await paso("si los insumos cambiaron desde el cierre, pagar rebota", async () => {
  const extra = alumnas[15];
  await db.query("insert into reservas (perfil_id, clase_id, credito_id) values ($1, $2, $3)", [extra.perfilId, A5, extra.creditoId]);
  await falla(pagar(owner, pagoId), /cambió desde que se cerró/);
  await db.query("delete from reservas where perfil_id = $1 and clase_id = $2", [extra.perfilId, A5]);
});
await paso("pagar a Pau: agrega comprobante y un egreso igual, y lo congelado no se mueve", async () => {
  const r = await pagar(owner, pagoId);
  assert.equal(r.monto_clp, 127_000);
  assert.ok(r.pagada_at);
  const e = await uno(db, "select categoria, monto_clp, comprobante_path, fecha::text from egresos where id = $1", [r.egreso_id]);
  assert.deepEqual([e.categoria, e.monto_clp, e.comprobante_path, e.fecha], ["sueldo_profesora", 127_000, "liquidaciones/x.png", "2026-12-02"]);
});
await paso("pagar dos veces rebota, y un pago registrado no se cambia", async () => {
  await falla(pagar(owner, pagoId), /ya está pagado/);
  await falla(db.query("update liquidaciones_profesoras set comprobante_path = 'otro' where id = $1", [pagoId]), /no se cambia/);
});

console.log("\n6. Lo que ve cada una (ADR-0008)");
await paso("Pau ve sus clases del mes y ninguna de otra, sin columnas de alumnas", async () => {
  const r = await como(db, pau, (tx) => filas(tx, "select * from public.mis_insumos_liquidacion('2026-11-01')"));
  const ids = r.map((x) => x.clase_id);
  assert.deepEqual(new Set(ids), new Set([A1, A2, A3, A4, A5, D, S, R2, T]));
  assert.ok(!ids.includes(C));
  assert.ok(r.every((x) => x.horario_id && x.dia_semana), "trae el horario de cada una");
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
  assert.equal(r[0].monto_clp, 127_000);
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

await paso("cerrar de nuevo agrega una fila: la anulada sigue ahí", async () => {
  const r = await cerrar(owner, PAU, 100_000, await huella(PAU));
  assert.notEqual(r.id, pagoId);
  assert.equal((await uno(db, "select count(*)::int n from liquidaciones_profesoras where profesora_id = $1", [PAU])).n, 2);
  await sv("select id from public.anular_liquidacion($1, $2, 'Era solo para probar')", [owner.userId, r.id]);
});
await paso("una anulada no vuelve", async () => {
  await falla(db.query("update liquidaciones_profesoras set deleted_at = null, anulada_at = null where id = $1", [pagoId]), /no vuelve/);
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
