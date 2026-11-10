import { sql } from "drizzle-orm";
import type { Database } from "./types";

export type DbHealth =
  { ok: true; latencyMs: number } | { ok: false; latencyMs: number; error: string };

/** `select 1` con medición de latencia. No expone detalles internos del error. */
export async function checkDatabase(db: Database, timeoutMs = 5000): Promise<DbHealth> {
  const started = performance.now();
  try {
    await Promise.race([
      db.execute(sql`select 1`),
      new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs)),
    ]);
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch (error) {
    const message =
      error instanceof Error && error.message === "timeout" ? "timeout" : "sin conexión";
    return { ok: false, latencyMs: Math.round(performance.now() - started), error: message };
  }
}
