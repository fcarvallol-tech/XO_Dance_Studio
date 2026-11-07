/**
 * La liquidación con la sesión de cada rol, en transacciones que se revierten, y
 * por lo que NO deben ver. Staging. Necesita a Pau pagada y a Drimy cerrada.
 */
import { conectar, staging } from "./staging.mjs";
const c = await conectar();
const uno = async (q, p) => (await c.query(q, p)).rows[0];
const email = (e) => uno(`select id, user_id from perfiles where email = $1`, [e]);
const roles = {
  anon: null,
  alumna: await email("bea@ejemplo.invalid"),
  "profe Pau": await email("profe.pau@ejemplo.invalid"),
  "profe Drimy": await email("profe.drimy@ejemplo.invalid"),
  admin: await email("admin@ejemplo.invalid"),
  owner: await email("owner@ejemplo.invalid"),
};
const { id: PAU } = await uno(`select id from profesoras where slug = 'pau'`);
const { id: LIQ } = await uno(`select id from liquidaciones_profesoras where profesora_id = $1 and deleted_at is null`, [PAU]);
const U = "00000000-0000-0000-0000-000000000000";
const preguntas = {
  "tabla: la de Pau": `select id from liquidaciones_profesoras where profesora_id = '${PAU}'`,
  "tabla: todas": `select id from liquidaciones_profesoras`,
  "tabla: comprobante de Pau": `select comprobante_path from liquidaciones_profesoras where id = '${LIQ}'`,
  "mis_liquidaciones": `select * from mis_liquidaciones()`,
  "mis_liquidaciones: $124.500": `select * from mis_liquidaciones() where monto_clp = 124500`,
  "mis_insumos: clases de hoy": `select * from mis_insumos_liquidacion('2026-11-01')`,
  "mi_tarifa": `select * from mi_tarifa()`,
  "insumos_liquidacion": `select * from insumos_liquidacion('2026-11-01')`,
  "huellas_liquidacion": `select * from huellas_liquidacion('2026-11-01')`,
  "insumos_del_mes (sin rol)": `select * from insumos_del_mes('2026-11-01')`,
  "huella_del_mes": `select huella_del_mes('${PAU}','2026-11-01')`,
  "costos_profesoras": `select profesora_id from costos_profesoras`,
  "causas_de_clase": `select clase_id from causas_de_clase`,
  "egresos": `select id from egresos`,
  "cerrar_liquidacion": `select cerrar_liquidacion('${U}','${PAU}','2026-11-01',1,'{}','x')`,
  "pagar_liquidacion": `select pagar_liquidacion('${U}','${LIQ}','x')`,
  "anular_liquidacion": `select anular_liquidacion('${U}','${LIQ}','motivo')`,
  "registrar_no_dictada": `select registrar_no_dictada('${U}','${U}','sin_alumnas','detalle')`,
  "update monto": `update liquidaciones_profesoras set monto_clp = 1 returning id`,
  "delete": `delete from liquidaciones_profesoras returning id`,
  "buscar_invitada": `select buscar_invitada('${U}','x@y.z')`,
};
const tabla = {};
for (const [rol, quien] of Object.entries(roles)) {
  await c.query("begin");
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
const r = await c.query(`select pg_get_function_result('public.mis_liquidaciones()'::regprocedure) a, pg_get_function_result('public.mis_insumos_liquidacion(date)'::regprocedure) b`);
console.log(r.rows[0].a); console.log(r.rows[0].b);
const k = staging.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? staging.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
for (const ruta of ["liquidaciones_profesoras?select=*", "rpc/mis_liquidaciones"]) {
  const x = await fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${ruta}`, { headers: { apikey: k } });
  console.log(`API anon ${ruta}: ${x.status}`);
}
const a = await fetch(`http://localhost:3000/api/liquidaciones/comprobante?id=${LIQ}`, { redirect: "manual" });
console.log("comprobante sin sesión:", a.status);
const b = await fetch(`${staging.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/comprobantes-liquidaciones/${LIQ}.png`);
console.log("comprobante por URL pública del bucket:", b.status);
await c.end();
