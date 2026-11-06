/**
 * Lo que ve cada rol, con su sesión, en una transacción que se revierte. Staging.
 * Se pregunta también por lo que NO debe ver. No hay perfil de profesora en
 * staging: se convierte uno dentro de la transacción, y se revierte.
 */
import { conectar, staging } from "./staging.mjs";
const c = await conectar();
const uno = async (q, p) => (await c.query(q, p)).rows[0];
const email = (e) => uno(`select id, user_id from perfiles where email = $1`, [e]);
const roles = {
  anon: null,
  alumna: await email("bea@ejemplo.invalid"),
  profesora: await email("cata@ejemplo.invalid"),
  admin: await email("admin@ejemplo.invalid"),
  owner: await email("owner@ejemplo.invalid"),
};
const U = "00000000-0000-0000-0000-000000000000";
const preguntas = {
  "sedes.costo_hora_clp": `select costo_hora_clp from sedes`,
  "sedes (filas)": `select id from sedes`,
  "sedes.ocasional=false": `select id from sedes where ocasional = false`,
  "clases.recupera_clase_id": `select recupera_clase_id from clases where recupera_clase_id is not null`,
  "causas_de_clase": `select clase_id from causas_de_clase`,
  "causas: detalle": `select detalle from causas_de_clase`,
  "liquidaciones_profesoras": `select id from liquidaciones_profesoras`,
  "costos_profesoras": `select profesora_id from costos_profesoras`,
  "compras": `select id from compras`,
  "compras con invitada": `select id from compras where perfil_invitada_id is not null`,
  "creditos": `select id from creditos`,
  "movimientos_credito": `select id from movimientos_credito`,
  "perfiles": `select id from perfiles`,
  "egresos": `select id from egresos`,
  "fn insumos_liquidacion": `select * from insumos_liquidacion('2026-11-01')`,
  "fn huellas_liquidacion": `select * from huellas_liquidacion('2026-11-01')`,
  "fn mis_insumos_liquidacion": `select * from mis_insumos_liquidacion('2026-11-01')`,
  "fn mis_liquidaciones": `select * from mis_liquidaciones()`,
  "fn afectadas_de_clases": `select * from afectadas_de_clases(array['${U}']::uuid[])`,
  "fn crear_recuperativa": `select crear_recuperativa('${U}','${U}',current_date,'10:00','${U}','${U}')`,
  "fn crear_sala_ocasional": `select crear_sala_ocasional('${U}','x','y 1','z',1,1)`,
  "fn direccion_comparable": `select direccion_comparable('x')`,
  "fn revocar_creditos": `select revocar_creditos('${U}',1,'motivo','${U}')`,
  "fn buscar_invitada": `select buscar_invitada('x@y.z')`,
  "fn registrar_no_dictada": `select registrar_no_dictada('${U}','${U}','sin_alumnas','detalle')`,
};
const tabla = {};
for (const [rol, quien] of Object.entries(roles)) {
  await c.query("begin");
  if (rol === "profesora") {
    await c.query(`alter table public.perfiles disable trigger user`);
    await c.query(`update perfiles set rol = 'profesora', profesora_id = 'pau' where id = $1`, [quien.id]);
    await c.query(`alter table public.perfiles enable trigger user`);
  }
  await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify(quien ? { sub: quien.user_id, role: "authenticated" } : { role: "anon" })]);
  await c.query(`set local role ${quien ? "authenticated" : "anon"}`);
  for (const [nombre, q] of Object.entries(preguntas)) {
    await c.query("savepoint s");
    try { const r = await c.query(q); (tabla[nombre] ??= {})[rol] = r.rowCount; }
    catch (e) { (tabla[nombre] ??= {})[rol] = e.code === "42501" ? "—" : `err ${e.code}`; }
    await c.query("rollback to savepoint s");
  }
  await c.query("rollback");
}
console.table(tabla);
const k = staging.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? staging.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const api = (r) => fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${r}`, { headers: { apikey: k } });
for (const r of ["sedes?select=costo_hora_clp", "sedes?select=*", "causas_de_clase?select=*", "sedes?select=slug,ocasional&ocasional=eq.true"]) {
  const x = await api(r); console.log(`API anon ${r}: ${x.status}`, (await x.text()).slice(0, 140));
}
await c.end();
