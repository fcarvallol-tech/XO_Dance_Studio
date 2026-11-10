// Un enlace para entrar al sitio local con una cuenta de STAGING, que tiene
// correos inventados (@ejemplo.invalid) y no recibe nada.
//
//   node scripts/enlace-staging.mjs owner@ejemplo.invalid /owner/liquidaciones?mes=2026-11
//
// Es el mismo camino que usan los verificadores: generateLink con la llave de
// servicio y el enlace a /auth/confirmar con token_hash, que es lo que trae el
// correo real. Sirve una vez y caduca en una hora. `staging.mjs` se cae si
// .env.staging no apunta a staging, así que esto no puede abrir producción.
import { createClient } from "@supabase/supabase-js";
import { staging } from "./staging.mjs";

const [correo, volver = "/"] = process.argv.slice(2);
if (!correo?.endsWith("@ejemplo.invalid")) {
  console.error("Uso: node scripts/enlace-staging.mjs <cuenta>@ejemplo.invalid [ruta]");
  process.exit(1);
}

const supabase = createClient(staging.NEXT_PUBLIC_SUPABASE_URL, staging.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const { data, error } = await supabase.auth.admin.generateLink({ type: "magiclink", email: correo });
if (error) throw error;
console.log(
  `http://localhost:3000/auth/confirmar?token_hash=${data.properties.hashed_token}&type=email&volver=${encodeURIComponent(volver)}`,
);
