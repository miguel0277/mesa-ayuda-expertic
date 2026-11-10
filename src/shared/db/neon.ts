import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";
import type { Database } from "./types";

// Node 20 no trae WebSocket global; Node 22+ sí, pero `ws` funciona en ambos.
neonConfig.webSocketConstructor = ws;

/**
 * Crea un cliente Drizzle sobre el driver serverless de Neon (WebSocket).
 * Se usa WebSocket y no HTTP porque los casos de uso necesitan transacciones interactivas.
 */
export function createNeonDatabase(connectionString: string): { db: Database; pool: Pool } {
  const pool = new Pool({ connectionString });
  const db: Database = drizzle({ client: pool, schema });
  return { db, pool };
}
