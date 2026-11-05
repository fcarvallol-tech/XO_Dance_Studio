// Ayudas para los escenarios: personas, sesiones y aserciones con salida legible.
import assert from "node:assert/strict";

let pasos = 0, fallas = 0;
export async function paso(nombre, fn) {
  try { await fn(); pasos++; console.log("  ✔", nombre); }
  catch (e) { fallas++; console.log("  ✘", nombre, "\n     ", e.message.split("\n").slice(0, 4).join("\n      ")); }
}
export function resumen() {
  console.log(`\n${pasos} pasos bien, ${fallas} mal`);
  if (fallas) process.exitCode = 1;
}
export { assert };

export async function persona(db, email, nombre, rol = "alumna") {
  const u = await db.query(
    "insert into auth.users (email, raw_user_meta_data) values ($1, jsonb_build_object('full_name', $2::text)) returning id",
    [email, nombre]);
  const userId = u.rows[0].id;
  if (rol !== "alumna") {
    await db.exec("alter table public.perfiles disable trigger user");
    await db.query("update public.perfiles set rol = $1 where user_id = $2", [rol, userId]);
    await db.exec("alter table public.perfiles enable trigger user");
  }
  const p = await db.query("select id from public.perfiles where user_id = $1", [userId]);
  return { userId, perfilId: p.rows[0].id, email };
}

/** Corre fn con la sesión de esa persona (rol authenticated + claims), en una transacción. */
export async function como(db, quien, fn, { revertir = false } = {}) {
  return db.transaction(async (tx) => {
    await tx.query("select set_config('request.jwt.claims', $1, true)",
      [JSON.stringify({ sub: quien.userId, role: "authenticated" })]);
    await tx.exec("set local role authenticated");
    const r = await fn(tx);
    if (revertir) await tx.rollback();
    return r;
  });
}

/** Como el servidor: service_role, sin sesión. */
export async function servidor(db, fn) {
  return db.transaction(async (tx) => {
    await tx.exec("set local role service_role");
    return fn(tx);
  });
}

export async function falla(promesa, patron) {
  try { await promesa; } catch (e) {
    if (patron && !patron.test(e.message)) throw new Error(`Falló con otro error: ${e.message}`);
    return e.message;
  }
  throw new Error("Se esperaba un error y no hubo");
}

export const uno = async (q, sql, args = []) => (await q.query(sql, args)).rows[0];
export const filas = async (q, sql, args = []) => (await q.query(sql, args)).rows;
