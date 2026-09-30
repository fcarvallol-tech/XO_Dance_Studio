/**
 * Conexión a la base de STAGING para el escenario del PRD-0010 §11.4.
 *
 * No se commitea nada que apunte a producción, y esta guarda lo hace imposible
 * por accidente: si el ref del proyecto no es el de staging, el script se cae
 * antes de abrir la conexión. `db push` contra producción sigue necesitando la
 * aprobación de Felipe caso a caso; esto ni siquiera puede intentarlo.
 */
import { readFileSync } from "node:fs";
import pg from "pg";

const STAGING_REF = "ybopuahlzbjkkwumkllk";

function env(archivo) {
  const salida = {};
  for (const linea of readFileSync(archivo, "utf8").split("\n")) {
    const m = linea.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) salida[m[1]] = m[2].trim();
  }
  return salida;
}

export const staging = env(".env.staging");

if (staging.SUPABASE_PROJECT_REF !== STAGING_REF) {
  throw new Error(
    `Este script solo corre contra staging (${STAGING_REF}). ` +
      `.env.staging apunta a ${staging.SUPABASE_PROJECT_REF}.`,
  );
}

/**
 * Las dos clases especiales del escenario de PRD-0018 fase 3, identificadas por
 * **título**: el id lo genera `crear_especial()` y forzarlo sería inventar un
 * camino que en producción no existe. Viven acá y no en la siembra para que el
 * verificador las pueda nombrar sin importar un script que siembra al cargarse.
 */
export const ES = {
  publicada: "Coreo del escenario",
  borrador: "Borrador del escenario",
};

/**
 * Los seis egresos de PRD-0010 parte 2 (fase 0.2 del plan). Fijos, para que
 * `verificar-finanzas.mjs` los pueda nombrar. E4 está anulado y E6 queda fuera
 * de los dos períodos, a propósito.
 */
export const EG = {
  E1: "66666666-6666-4666-8666-000000000001",
  E2: "66666666-6666-4666-8666-000000000002",
  E3: "66666666-6666-4666-8666-000000000003",
  E4: "66666666-6666-4666-8666-000000000004",
  E5: "66666666-6666-4666-8666-000000000005",
  E6: "66666666-6666-4666-8666-000000000006",
};

/** Las cinco clases del escenario de PRD-0010 §11.4, por id fijo. */
export const CL = {
  1: "22222222-2222-4222-8222-000000000001",
  2: "22222222-2222-4222-8222-000000000002",
  3: "22222222-2222-4222-8222-000000000003",
  4: "22222222-2222-4222-8222-000000000004",
  5: "22222222-2222-4222-8222-000000000005",
};

export async function conectar() {
  const hosts = [
    `aws-0-sa-east-1.pooler.supabase.com`,
    `aws-1-sa-east-1.pooler.supabase.com`,
  ];
  let ultimoError;
  for (const host of hosts) {
    const cliente = new pg.Client({
      host,
      port: 5432,
      user: `postgres.${STAGING_REF}`,
      password: staging.SUPABASE_DB_PASSWORD,
      database: "postgres",
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 15000,
    });
    try {
      await cliente.connect();
      const { rows } = await cliente.query("select current_database() as db");
      if (!rows[0]) throw new Error("sin respuesta");
      return cliente;
    } catch (e) {
      ultimoError = e;
      await cliente.end().catch(() => {});
    }
  }
  throw ultimoError;
}
