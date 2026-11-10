/**
 * Aplica las migraciones versionadas de /drizzle usando la conexión DIRECTA de Neon.
 * Uso: pnpm db:migrate
 */
import { config } from "dotenv";
import { migrate } from "drizzle-orm/neon-serverless/migrator";
import { dbEnvSchema, parseEnv } from "../src/env";
import { createNeonDatabase } from "../src/shared/db/neon";
import { MIGRATIONS_FOLDER } from "../src/shared/db/migrate";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const env = parseEnv(dbEnvSchema);
  const { db, pool } = createNeonDatabase(env.DATABASE_URL_UNPOOLED);
  const host = new URL(env.DATABASE_URL_UNPOOLED).host;
  console.log(`→ Aplicando migraciones en ${host}…`);
  const started = Date.now();
  try {
    await migrate(db as Parameters<typeof migrate>[0], { migrationsFolder: MIGRATIONS_FOLDER });
    console.log(`✓ Migraciones aplicadas en ${Date.now() - started} ms.`);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Falló la migración:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
