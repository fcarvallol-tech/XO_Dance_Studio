/** Ayudas de los verificadores de navegador del 06/11/2026. Solo staging. */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { conectar, staging } from "./staging.mjs";

export const SITIO = "http://localhost:3000";
export const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
export const db = await conectar();
export const sql = async (q, p) => (await db.query(q, p)).rows;
export const navegador = await chromium.launch();
export let fallas = 0;
export function caso(n, o, e) {
  const ok = JSON.stringify(o) === JSON.stringify(e);
  if (!ok) fallas++;
  console.log(`  ${ok ? "✓" : "✗"} ${n}: ${JSON.stringify(o)}${ok ? "" : ` (esperado ${JSON.stringify(e)})`}`);
}
/** Entra por el enlace tal como llegaría en el correo, no por el SDK. */
export async function sesion(email, volver, ancho = 390) {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  const contexto = await navegador.newContext({ viewport: { width: ancho, height: 900 } });
  const pagina = await contexto.newPage();
  pagina.on("pageerror", (e) => { fallas++; console.log(`  ✗ [error de página] ${e.message}`); });
  await pagina.goto(
    `${SITIO}/auth/confirmar?token_hash=${data.properties.hashed_token}&type=magiclink&volver=${encodeURIComponent(volver)}`,
    { waitUntil: "networkidle" },
  );
  if (new URL(pagina.url()).pathname === "/completar-perfil") {
    await pagina.locator('input[name="nombre"]').fill(email.split("@")[0]);
    await pagina.locator('input[name="telefono"]').fill("00000000");
    await pagina.getByRole("button", { name: "Guardar y entrar" }).click();
    await pagina.waitForLoadState("networkidle");
    await pagina.waitForTimeout(1500);
  }
  return { contexto, pagina };
}
export const texto = async (p) => (await p.locator("main").innerText()).replace(/\s+/g, " ");
export async function fin() {
  await navegador.close();
  await db.end();
  console.log(fallas ? `\n${fallas} MAL` : "\nTodo bien");
  process.exitCode = fallas ? 1 : 0;
}
