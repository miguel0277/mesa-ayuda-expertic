import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import * as schema from "@/shared/db/schema";
import { MIGRATIONS_FOLDER } from "@/shared/db/migrate";
import type { Database } from "@/shared/db/types";

/**
 * Base de datos de prueba: PostgreSQL 17 real en memoria (PGlite), con las mismas
 * migraciones que producción. No requiere Docker ni red.
 */
export async function createTestDatabase(): Promise<{ db: Database; close: () => Promise<void> }> {
  const client = new PGlite();
  const db = drizzle({ client, schema });
  await migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
  return { db: db satisfies Database, close: () => client.close() };
}

/** Hash rápido para pruebas (el real de Better Auth es scrypt y es lento a propósito). */
export const fakeHash = async (password: string) => `test-hash:${password}`;
