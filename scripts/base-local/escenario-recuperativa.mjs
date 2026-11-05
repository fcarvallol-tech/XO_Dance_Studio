// PRD-0027 — la clase recuperativa, contra la base local: qué crea, con qué
// choca, que generar_clases() la respeta, a quién hay que avisarle, que la
// alumna reserva sola con su crédito, y lo que ve cada rol.
// node scripts/base-local/escenario-recuperativa.mjs   (ver base.mjs para instalar PGlite)
import { base } from "./base.mjs";
import { paso, resumen, assert, persona, como, servidor, falla, uno, filas } from "./util.mjs";
import { liquidar } from "../../lib/dominio/liquidacion.ts";

const db = await base();
const owner = await persona(db, "owner@xo.test", "Felipe", "owner");
const admin = await persona(db, "admin@xo.test", "Carla", "admin");
const pau = await persona(db, "pau@xo.test", "Pau");
const ana = await persona(db, "ana@xo.test", "Ana");
const bea = await persona(db, "bea@xo.test", "Bea");
const cata = await persona(db, "cata@xo.test", "Cata");
await db.exec("alter table public.perfiles disable trigger user");
await db.query("update perfiles set rol = 'profesora', profesora_id = 'pau' where id = $1", [pau.perfilId]);
await db.exec("alter table public.perfiles enable trigger user");

const idProfe = async (slug) => (await uno(db, "select id from profesoras where slug = $1", [slug])).id;
const PAU = await idProfe("pau");
const DRIMY = await idProfe("drimy");
const horario = await uno(db, "select * from horarios where profesora_id = $1 and activo order by id limit 1", [PAU]);
const sedeOtra = await uno(db, "select id, capacidad from sedes where id <> $1 and activa and deleted_at is null order by capacidad desc limit 1", [horario.sede_id]);
const sedePropia = await uno(db, "select capacidad from sedes where id = $1", [horario.sede_id]);
assert.notEqual(sedeOtra.capacidad, sedePropia.capacidad, "hacen falta dos salas de distinta capacidad");

await db.exec("delete from public.clases");
await db.query("update parametros set valor = '0' where clave = 'cancelacion_minutos'").catch(() => {});

// Días civiles: un día de la semana del horario, y otro que no lo es.
const dia = async (dias) => (await uno(db, "select (current_date + $1::int)::text f", [dias])).f;
const isodow = async (f) => (await uno(db, "select extract(isodow from $1::date)::int d", [f])).d;
/** La primera fecha desde `desde` que cae (o no) en el día regular del horario. */
async function fechaDesde(desde, esRegular) {
  for (let i = desde; i < desde + 8; i++) {
    const f = await dia(i);
    if (((await isodow(f)) === horario.dia_semana) === esRegular) return f;
  }
}

async function clase(fecha) {
  return (await uno(db, `insert into clases (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
    values ($1, $2::date, ($2::date + time '19:00') at time zone 'America/Santiago', $3, $4, $5, $6) returning id`,
    [horario.id, fecha, horario.curso_id, PAU, horario.sede_id, sedePropia.capacidad])).id;
}
async function lote(quien, n) {
  const c = await uno(db, `insert into creditos (perfil_id, cantidad_inicial, cantidad_disponible, fecha_vencimiento)
    values ($1, $2, $2, now() + interval '30 days') returning id`, [quien.perfilId, n]);
  await db.query(`insert into movimientos_credito (perfil_id, credito_id, tipo, cantidad, saldo_resultante, motivo, creado_por)
    values ($1, $2, 'regalo', $3, $3, 'semilla', $4)`, [quien.perfilId, c.id, n, owner.perfilId]);
}
const sv = (sql, args) => servidor(db, (tx) => uno(tx, sql, args));
const reservar = (quien, claseId) => sv("select * from public.reservar($1, $2)", [claseId, quien.userId]);
const crear = (actor, original, fecha, hora = "21:15", sede = horario.sede_id, profe = PAU) =>
  sv("select * from public.crear_recuperativa($1, $2, $3, $4, $5, $6)", [actor.userId, original, fecha, hora, sede, profe]);
const afectadas = (id) => servidor(db, (tx) => filas(tx, "select * from public.afectadas_de_clases($1)", [[id]]));
const saldo = async (q) => (await uno(db, "select public.saldo_creditos($1) s", [q.perfilId])).s;
const libroCuadra = async () => {
  const r = await uno(db, "select (select sum(cantidad) from movimientos_credito)::int libro, (select sum(cantidad_disponible) from creditos)::int lotes");
  assert.equal(r.libro, r.lotes);
};

for (const q of [ana, bea, cata]) await lote(q, 2);

// La clase que cae: Ana y Bea la pierden; Cata había cancelado por su cuenta.
const fechaCaida = await fechaDesde(1, true);
const CAIDA = await clase(fechaCaida);
await reservar(ana, CAIDA);
await reservar(bea, CAIDA);
const rCata = await reservar(cata, CAIDA);
await sv("select * from public.cancelar_reserva($1, $2)", [rCata.id, cata.userId]);
await db.query("update clases set estado = 'cancelada', motivo_cancelacion = 'Cancelada' where id = $1", [CAIDA]);
await sv("select * from public.registrar_no_dictada($1, $2, 'asistencia_insuficiente', 'No llegaron alumnas', false)", [admin.userId, CAIDA]);

const fechaLibre = await fechaDesde(2, false);

console.log("\n1. A quién hay que avisarle");
await paso("Ana y Bea, y no Cata, que canceló por su cuenta aunque también tiene el crédito devuelto", async () => {
  const c = await uno(db, "select credito_devuelto, estado from reservas where id = $1", [rCata.id]);
  assert.deepEqual([c.estado, c.credito_devuelto], ["cancelada", true], "Cata está igual que las otras en reservas");
  const r = await afectadas(CAIDA);
  assert.deepEqual(new Set(r.map((x) => x.email)), new Set(["ana@xo.test", "bea@xo.test"]));
  assert.ok(r.every((x) => x.vence && x.original_id === CAIDA));
});
await paso("las dos tienen su crédito de vuelta: saldo 2", async () => {
  assert.deepEqual([await saldo(ana), await saldo(bea)], [2, 2]);
  await libroCuadra();
});

console.log("\n2. Lo que rechaza");
await paso("la misma fecha de la clase caída: lo dice en palabras", async () => {
  await falla(crear(admin, CAIDA, fechaCaida), /no pueden caer el mismo día/);
});
await paso("otra clase del horario ese día, aunque sea a otra hora", async () => {
  const f = await fechaDesde(9, true);
  await clase(f);
  await falla(crear(admin, CAIDA, f), /ya hay una clase de este horario/);
});
await paso("el día regular más allá de lo generado: rechaza, si no generar_clases() perdería esa clase", async () => {
  const lejos = await fechaDesde(120, true);
  await falla(crear(admin, CAIDA, lejos), /clase regular/);
});
await paso("en el pasado", async () => {
  await falla(crear(admin, CAIDA, await fechaDesde(-8, false)), /en el futuro/);
});
await paso("una clase en pie no se recupera", async () => {
  const viva = await clase(await fechaDesde(16, true));
  await falla(crear(admin, viva, fechaLibre), /cancelada o no dictada/);
});
await paso("una sala o una profesora ocupadas a esa hora", async () => {
  const f = await fechaDesde(23, false);
  await db.query(`insert into horarios (curso_id, profesora_id, sede_id, dia_semana, hora)
    select curso_id, profesora_id, $1, $2, '18:00' from horarios where id = $3`, [sedeOtra.id, await isodow(f), horario.id]).catch(() => {});
  const h2 = await uno(db, "select id from horarios where sede_id = $1 and dia_semana = $2 and hora = '18:00' limit 1", [sedeOtra.id, await isodow(f)]);
  await db.query(`insert into clases (horario_id, fecha, inicio, curso_id, profesora_id, sede_id, cupo_maximo)
    values ($1, $2::date, ($2::date + time '18:00') at time zone 'America/Santiago', $3, $4, $5, 5)`, [h2.id, f, horario.curso_id, DRIMY, sedeOtra.id]);
  await falla(crear(admin, CAIDA, f, "18:30", sedeOtra.id, PAU), /ya tiene una clase a esa hora/);
});
await paso("alumna y profesora, rechazadas adentro; una sesión no llama la función", async () => {
  await falla(crear(ana, CAIDA, fechaLibre), /admin o superior/);
  await falla(crear(pau, CAIDA, fechaLibre), /admin o superior/);
  await falla(como(db, owner, (tx) => tx.query("select public.crear_recuperativa($1, $2, $3, '20:00', $4, $5)", [owner.userId, CAIDA, fechaLibre, horario.sede_id, PAU])), /permission denied/);
});

console.log("\n3. La recuperativa");
let R;
await paso("otra sala y otra profesora: cupo de la sala, hora de Santiago, mismo horario, ligada a la original", async () => {
  R = await crear(admin, CAIDA, fechaLibre, "21:15", sedeOtra.id, DRIMY);
  assert.equal(R.tipo, "parrilla");
  assert.equal(R.horario_id, horario.id);
  assert.equal(R.recupera_clase_id, CAIDA);
  assert.equal(R.cupo_maximo, sedeOtra.capacidad);
  assert.equal(R.sede_id, sedeOtra.id);
  assert.equal(R.profesora_id, DRIMY);
  assert.equal(R.curso_id, horario.curso_id);
  const h = await uno(db, "select to_char(inicio at time zone 'America/Santiago', 'YYYY-MM-DD HH24:MI') t from clases where id = $1", [R.id]);
  assert.equal(h.t, `${fechaLibre} 21:15`);
});
await paso("no reserva por nadie: cero reservas, y los saldos no se movieron", async () => {
  assert.equal((await uno(db, "select count(*)::int n from reservas where clase_id = $1", [R.id])).n, 0);
  assert.deepEqual([await saldo(ana), await saldo(bea)], [2, 2]);
});
await paso("una sola: la segunda se rechaza y dice cuándo es la que hay", async () => {
  await falla(crear(admin, CAIDA, await fechaDesde(3, false), "10:00"), /ya tiene su recuperativa, el/);
});
await paso("generar_clases() no la duplica ni la borra, y sigue creando las regulares", async () => {
  const antes = await uno(db, "select count(*)::int n from clases where horario_id = $1", [horario.id]);
  await db.query("select public.generar_clases(30)");
  const r = await filas(db, "select id, inicio, recupera_clase_id from clases where horario_id = $1 and fecha = $2", [horario.id, fechaLibre]);
  assert.equal(r.length, 1);
  assert.equal(r[0].id, R.id);
  assert.equal(r[0].recupera_clase_id, CAIDA);
  const despues = await uno(db, "select count(*)::int n from clases where horario_id = $1", [horario.id]);
  assert.ok(despues.n >= antes.n);
  const reg = await uno(db, "select count(*)::int n from clases where horario_id = $1 and recupera_clase_id is null and fecha > current_date and estado = 'programada'", [horario.id]);
  assert.ok(reg.n >= 3, `regulares: ${reg.n}`);
  // Y correrla de nuevo no crea nada.
  const otra = await uno(db, "select public.generar_clases(30) n");
  assert.equal(otra.n, 0);
});

console.log("\n4. La alumna reserva sola");
await paso("Ana reserva con reservar(), de siempre: consume un crédito y el libro cuadra", async () => {
  const r = await reservar(ana, R.id);
  assert.equal(r.estado, "confirmada");
  assert.ok(r.credito_id);
  assert.equal(await saldo(ana), 1);
  await libroCuadra();
});

console.log("\n5. Lo que ve cada rol");
await paso("anon lee recupera_clase_id, que es lo que usa el calendario público", async () => {
  const r = await db.transaction(async (tx) => {
    await tx.exec("set local role anon");
    return (await tx.query("select recupera_clase_id from clases where id = $1", [R.id])).rows;
  });
  assert.equal(r[0].recupera_clase_id, CAIDA);
});
await paso("alumna con sesión también", async () => {
  const r = await como(db, bea, (tx) => filas(tx, "select recupera_clase_id from clases where id = $1", [R.id]));
  assert.equal(r[0].recupera_clase_id, CAIDA);
});
await paso("admin, con su sesión, lee lo que pide la pantalla: clases con causa, salas con capacidad, profesoras", async () => {
  const r = await como(db, admin, async (tx) => ({
    causa: await filas(tx, "select causa from causas_de_clase where clase_id = $1", [CAIDA]),
    sedes: await filas(tx, "select id, nombre, capacidad from sedes where activa order by orden"),
    profes: await filas(tx, "select id, nombre from profesoras where activa order by orden"),
  }));
  assert.equal(r.causa[0].causa, "asistencia_insuficiente");
  assert.ok(r.sedes.length >= 2 && r.sedes.every((x) => x.capacidad > 0));
  assert.ok(r.profes.length >= 2);
});
await paso("la causa sigue sin verse para una alumna", async () => {
  assert.equal((await como(db, ana, (tx) => filas(tx, "select * from causas_de_clase"))).length, 0);
});
await paso("afectadas_de_clases entrega correos: nadie con sesión, ni anon", async () => {
  for (const quien of [owner, admin, pau, ana]) {
    await falla(como(db, quien, (tx) => tx.query("select * from public.afectadas_de_clases($1)", [[CAIDA]])), /permission denied/);
  }
  await falla(db.transaction(async (tx) => { await tx.exec("set local role anon"); await tx.query("select * from public.afectadas_de_clases($1)", [[CAIDA]]); }), /permission denied/);
});

console.log("\n6. El pago: se le paga a quien dictó");
await paso("recuperada: la original no paga; la recuperativa va a Drimy y no a Pau", async () => {
  const mes = fechaCaida.slice(0, 8) + "01";
  await db.query("update clases set inicio = now() - interval '2 hours' where id = $1", [R.id]);
  const insumos = await como(db, owner, (tx) => filas(tx, "select * from public.insumos_liquidacion($1::date)", [mes]));
  const clases = insumos.map((i) => ({
    id: i.clase_id, profesoraId: i.profesora_id, cursoId: i.curso_id,
    inicio: new Date(i.inicio).toISOString(), fin: null, tipo: i.tipo, estado: i.estado, causa: i.causa,
    profesoraSePresento: i.profesora_se_presento, recuperada: i.recuperada, creditosConsumidos: i.creditos_consumidos,
  }));
  const tarifa = { baseHoraClp: 18_000, variableCreditoClp: 250, umbralVariable: 5 };
  const m = fechaCaida.slice(0, 7);
  const ahora = new Date();
  const lineaDe = (profesoraId, id) => liquidar({ profesoraId, mes: m, clases, tarifa, ahora }).lineas.find((l) => l.claseId === id);
  assert.equal(lineaDe(PAU, CAIDA).totalClp, 0);
  assert.equal(lineaDe(DRIMY, R.id).totalClp, 18_000); // 1 crédito: bajo el umbral
  assert.equal(lineaDe(PAU, R.id), undefined);
  await db.query("update clases set inicio = ($2::date + time '21:15') at time zone 'America/Santiago' where id = $1", [R.id, fechaLibre]);
});

console.log("\n7. Si la recuperativa también se cae");
await paso("se cancela: Ana recupera su crédito y la original queda sin recuperar", async () => {
  await db.query("update clases set estado = 'cancelada' where id = $1", [R.id]);
  assert.equal(await saldo(ana), 2);
  await libroCuadra();
});
await paso("una recuperativa caída no se recupera a sí misma: se parte de la original", async () => {
  await falla(crear(admin, R.id, await fechaDesde(3, false), "10:00"), /ya era una recuperativa/);
});
let R2;
await paso("la original se puede volver a recuperar, sin que la anterior ocupe el índice", async () => {
  R2 = await crear(owner, CAIDA, await fechaDesde(3, false), "10:00");
  assert.equal(R2.recupera_clase_id, CAIDA);
  assert.equal(R2.cupo_maximo, sedePropia.capacidad);
});
await paso("las afectadas siguen siendo Ana y Bea, sin repetir a Ana, que perdió dos veces", async () => {
  const r = await afectadas(CAIDA);
  assert.equal(r.length, 2);
  assert.deepEqual(new Set(r.map((x) => x.email)), new Set(["ana@xo.test", "bea@xo.test"]));
});

resumen();
