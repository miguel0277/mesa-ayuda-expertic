import { type Column, getTableName, type SQL, sql } from "drizzle-orm";

/**
 * Referencia a una columna SIEMPRE calificada con su tabla: `"tabla"."columna"`.
 *
 * Úsala para la columna de la consulta externa dentro de una subconsulta correlacionada.
 * En consultas de una sola tabla Drizzle escribe `${tabla.columna}` sin calificar (`"id"`), y
 * dentro de la subconsulta Postgres lo resuelve contra la tabla interna: o falla por ambigüedad
 * ("column reference id is ambiguous") o, peor, compara la tabla interna consigo misma.
 */
export function outer(column: Column): SQL {
  return sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;
}
