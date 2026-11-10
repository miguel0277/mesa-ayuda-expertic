import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

/**
 * drizzle-kit (generate / studio) usa la conexión DIRECTA de Neon.
 * `pnpm db:migrate` usa scripts/db-migrate.ts (driver serverless de Neon).
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/shared/db/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED ?? "",
  },
  strict: true,
  verbose: true,
});
