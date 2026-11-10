import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type * as schema from "./schema";

export type Schema = typeof schema;

/**
 * Base de datos independiente del driver: la app usa Neon (WebSocket) y las pruebas PGlite.
 * Las transacciones también cumplen este tipo, así los repositorios aceptan cualquiera de los dos.
 */
export type Database = PgDatabase<PgQueryResultHKT, Schema>;

export type Transaction = PgTransaction<
  PgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

/** Cualquier cosa sobre la que se puedan ejecutar consultas. */
export type DbExecutor = Database | Transaction;
