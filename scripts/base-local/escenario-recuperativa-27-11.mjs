// La recuperativa de Pau del 27/11 (supabase/migrations/20261111120000), contra
// una base local con todas las migraciones. Nada remoto.
//   node scripts/base-local/escenario-recuperativa-27-11.mjs
import { readFileSync } from "node:fs";
import { base } from "./base.mjs";
import { paso, resumen, assert, uno, filas, falla } from "./util.mjs";

const MIG = readFileSync(new URL("../../supabase/migrations/20261111120000_recuperativa_pau_27_11.sql", import.meta.url), "utf8");
const db = await base();

// La clase del 03/11 como está en producción: de parrilla, cancelada, sin causa.
const h = await uno(db, `select h.* from horarios h join profesoras p on p.id = h.profesora_id
  join sedes s on s.id = h.sede_id join cursos c on c.id = h.curso_id
  where p.slug = 'pau' and s.slug = 'seduccion-latina' and c.slug = 'reggaeton-femme' and h.dia_semana = 2 and h.hora = '18:00'`);
const orig = await uno(db, `insert into clases (horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo)
  values ($1, '2026-11-03', '2026-11-03 18:00 America/Santiago', '2026-11-03 19:00 America/Santiago', $2, $3, $4, 16) returning id`,
  [h.id, h.curso_id, h.profesora_id, h.sede_id]);
await db.query(`update clases set estado = 'cancelada', motivo_cancelacion = 'Cancelada' where id = $1`, [orig.id]);

console.log("\n1. Si ya hay clase en Los Leones a esa hora, no crea nada");
await db.query("begin");
await db.query(`insert into clases (horario_id, fecha, inicio, fin, curso_id, profesora_id, sede_id, cupo_maximo)
  select h.id, '2026-11-27', '2026-11-27 20:30 America/Santiago', '2026-11-27 21:30 America/Santiago', h.curso_id, h.profesora_id, h.sede_id, 16
  from horarios h join sedes s on s.id = h.sede_id where s.slug = 'seduccion-latina' and h.id <> $1 limit 1`, [h.id]);
await paso("aborta con el choque", () => falla(db.exec(MIG), /Ya hay clase en Los Leones/));
await db.query("rollback");

console.log("\n2. Crea la recuperativa");
await db.exec(MIG);
const r = await filas(db, `select c.*, to_char(c.inicio at time zone 'America/Santiago', 'DD/MM HH24:MI') i,
  to_char(c.fin at time zone 'America/Santiago', 'HH24:MI') f from clases c where recupera_clase_id = $1`, [orig.id]);
await paso("una sola, viernes 27/11 20:00-21:00", () => {
  assert.equal(r.length, 1);
  assert.equal(r[0].i, "27/11 20:00");
  assert.equal(r[0].f, "21:00");
});
await paso("de parrilla, en el horario de los martes, en Los Leones, cupo 16, programada", () => {
  assert.equal(r[0].tipo, "parrilla");
  assert.equal(r[0].horario_id, h.id);
  assert.equal(r[0].sede_id, h.sede_id);
  assert.equal(r[0].cupo_maximo, 16);
  assert.equal(r[0].estado, "programada");
  assert.equal(r[0].publicada_at, null);
});
await paso("los insumos de la liquidación la cuentan en el horario de los martes, dia 2", async () => {
  const i = await uno(db, `select horario_id, dia_semana, recupera_clase_id from insumos_del_mes('2026-11-01') where clase_id = $1`, [r[0].id]);
  assert.equal(i.horario_id, h.id);
  assert.equal(i.dia_semana, 2);
  assert.equal(i.recupera_clase_id, orig.id);
  const o = await uno(db, `select recuperada from insumos_del_mes('2026-11-01') where clase_id = $1`, [orig.id]);
  assert.equal(o.recuperada, true);
});

console.log("\n3. Correrla de nuevo no hace nada");
await db.exec(MIG);
await paso("sigue habiendo una", async () =>
  assert.equal((await uno(db, "select count(*)::int n from clases where recupera_clase_id = $1", [orig.id])).n, 1));

resumen();
