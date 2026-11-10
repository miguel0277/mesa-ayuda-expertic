import "server-only";
import { getEnv } from "@/env";
import { createNeonDatabase } from "./neon";
import type { Database } from "./types";

/**
 * Cliente de la app: usa la cadena POOLED de Neon (DATABASE_URL).
 * Se reutiliza un solo pool por instancia (también entre recargas en desarrollo).
 * No guarda estado de negocio: el servidor sigue siendo stateless.
 */
const globalForDb = globalThis as unknown as { __expertic_db?: Database };

export function getDb(): Database {
  if (!globalForDb.__expertic_db) {
    globalForDb.__expertic_db = createNeonDatabase(getEnv().DATABASE_URL).db;
  }
  return globalForDb.__expertic_db;
}
