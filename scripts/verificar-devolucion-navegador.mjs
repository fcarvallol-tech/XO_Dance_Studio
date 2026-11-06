/**
 * Devolver créditos al cancelar una clase, por el camino real (Felipe, 06/11/2026).
 * Solo staging. Dos alumnas inventadas reciben créditos con regalar_creditos(),
 * reservan **desde la página** una clase futura y la clase se cancela con el mismo
 * update con que se canceló la de Pau. Nada de reservas escritas a mano: una
 * reserva sembrada se apoyaría en la forma que uno supone que tienen las filas.
 *
 * Esa clase queda cancelada: es la que recupera la Parte 5.
 *   node scripts/verificar-devolucion-navegador.mjs <clase_id>   (sitio en :3000)
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { conectar, staging } from "./staging.mjs";

const SITIO = "http://localhost:3000";
const CLASE = process.argv[2];
const ALUMNAS = ["alumna.uno@ejemplo.invalid", "alumna.dos@ejemplo.invalid"];
const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = await conectar();
const sql = async (q, p) => (await db.query(q, p)).rows;
let fallas = 0;
const caso = (n, o, e) => {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) fallas++;
  console.log(`  ${ok ? "✓" : "✗"} ${n}: ${JSON.stringify(o)}${ok ? "" : ` (esperado ${JSON.stringify(e)})`}`);
};
const estado = (id) => sql(
  `select c.id lote, c.cantidad_disponible disp, c.fecha_vencimiento > now() vigente,
     (select coalesce(sum(m.cantidad),0)::int from movimientos_credito m where m.credito_id = c.id) libro,
     (select count(*)::int from movimientos_credito m where m.credito_id = c.id) movimientos
   from creditos c where c.perfil_id = $1`, [id]);

const [owner] = await sql(`select user_id from perfiles where rol = 'owner' and deleted_at is null limit 1`);
const navegador = await chromium.launch();
const antes = {};
const perfiles = {};
for (const [i, email] of ALUMNAS.entries()) {
  // Reutilizable: una corrida a medias deja la cuenta y su regalo, y no se regala dos veces.
  let [p] = await sql(`select id from perfiles where email = $1`, [email]);
  if (!p) {
    const nueva = await supabase.auth.admin.createUser({
      email, email_confirm: true, user_metadata: { full_name: i ? "Alumna Dos" : "Alumna Uno" },
    });
    if (nueva.error) throw new Error(nueva.error.message);
    [p] = await sql(`select id from perfiles where user_id = $1`, [nueva.data.user.id]);
    const r = await supabase.rpc("regalar_creditos", {
      p_perfil_id: p.id, p_cantidad: 2, p_motivo: "Prueba de devolución en staging", p_actor_user_id: owner.user_id,
    });
    if (r.error) throw new Error(r.error.message);
  }
  perfiles[email] = p.id;

  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 900 } });
  const pagina = await contexto.newPage();
  await pagina.goto(
    `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=magiclink&volver=${encodeURIComponent(`/reservar/${CLASE}`)}`,
    { waitUntil: "networkidle" },
  );
  if (new URL(pagina.url()).pathname === "/completar-perfil") {
    await pagina.locator('input[name="nombre"]').fill(i ? "Alumna Dos" : "Alumna Uno");
    await pagina.locator('input[name="telefono"]').fill("00000000");
    await pagina.getByRole("button", { name: "Guardar y entrar" }).click();
    await pagina.waitForLoadState("networkidle");
    await pagina.waitForTimeout(1500);
  }
  caso(`${email} llega a la página de reservar`, new URL(pagina.url()).pathname, `/reservar/${CLASE}`);
  await pagina.getByRole("button", { name: "Reservar esta clase" }).click();
  await pagina.waitForTimeout(3000);
  console.log("    pantalla:", (await pagina.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 170));
  await contexto.close();
  antes[email] = await estado(p.id);
  caso(`${email} antes de cancelar: 1 disponible y el libro cuadra`,
    [antes[email][0].disp, antes[email][0].libro], [1, 1]);
}

console.log("\nCancelar la clase");
await sql(`update public.clases set estado = 'cancelada', motivo_cancelacion = 'Cancelada' where id = $1`, [CLASE]);

for (const email of ALUMNAS) {
  const d = await estado(perfiles[email]);
  caso(`${email}: el crédito volvió a su lote original`, d[0].lote, antes[email][0].lote);
  caso(`${email}: disponible, vigente, libro`, [d[0].disp, d[0].vigente, d[0].libro], [2, true, 2]);
  caso(`${email}: un movimiento más`, d[0].movimientos, antes[email][0].movimientos + 1);
  const [r] = await sql(
    `select r.estado, r.credito_devuelto, m.motivo from reservas r
     join movimientos_credito m on m.reserva_id = r.id and m.tipo = 'cancelacion'
     where r.clase_id = $1 and r.perfil_id = $2`, [CLASE, perfiles[email]]);
  caso(`${email}: reserva y motivo`, r, { estado: "cancelada", credito_devuelto: true, motivo: "La academia canceló la clase" });
}
await navegador.close();
await db.end();
console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien");
process.exitCode = fallas ? 1 : 0;
