/**
 * Semilla de la base de datos.
 *
 *   pnpm db:seed                 → catálogos + admin + datos de demostración (solo desarrollo)
 *   pnpm db:seed --reset         → vacía todo y vuelve a sembrar la demostración (solo desarrollo)
 *   pnpm db:seed --solo-catalogo → solo catálogos + admin (seguro en producción, idempotente)
 *
 * Requiere SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD.
 */
import { hashPassword } from "better-auth/crypto";
import { config } from "dotenv";
import { z } from "zod";
import { dbEnvSchema, parseEnv } from "../src/env";
import { createNeonDatabase } from "../src/shared/db/neon";
import { seedDatabase } from "../src/shared/db/seed";
import { DEMO_PASSWORD, DEMO_EMAIL_DOMAIN } from "../src/shared/db/seed/demo-data";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const seedEnvSchema = dbEnvSchema.extend({
  SEED_ADMIN_EMAIL: z.email({ error: "Falta SEED_ADMIN_EMAIL (correo válido) en .env.local." }),
  SEED_ADMIN_PASSWORD: z
    .string({ error: "Falta SEED_ADMIN_PASSWORD en .env.local." })
    .min(8, "SEED_ADMIN_PASSWORD debe tener al menos 8 caracteres."),
  NODE_ENV: z.string().optional(),
});

async function main() {
  const args = new Set(process.argv.slice(2));
  const onlyCatalog = args.has("--solo-catalogo");
  const reset = args.has("--reset");
  const env = parseEnv(seedEnvSchema);
  const isProduction = env.NODE_ENV === "production" || process.env.VERCEL_ENV === "production";

  if (isProduction && (!onlyCatalog || reset)) {
    throw new Error(
      "En producción solo se permite `pnpm db:seed --solo-catalogo` (sin datos falsos).",
    );
  }

  const { db, pool } = createNeonDatabase(env.DATABASE_URL_UNPOOLED);
  try {
    const summary = await seedDatabase(db, {
      admin: { email: env.SEED_ADMIN_EMAIL, password: env.SEED_ADMIN_PASSWORD },
      demo: !onlyCatalog,
      reset,
      hashPassword,
      log: (m) => console.log(`→ ${m}`),
    });
    console.log("✓ Semilla completada:");
    console.table(summary);
    if (!onlyCatalog) {
      console.log(
        `\nUsuarios de prueba: <rol>@${DEMO_EMAIL_DOMAIN} (docente, lider1, aux1, profesor1, estudiante1…)`,
      );
      console.log(`Contraseña de todos: ${DEMO_PASSWORD}`);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error("✗ Falló la semilla:");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
