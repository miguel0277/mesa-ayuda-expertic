import { and, desc, eq, gte, ilike, lte, or, sql, type SQL } from "drizzle-orm";
import { auditLog, tasks, tickets, user } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";

export type AuditFilters = {
  entityType?: string;
  entityId?: string;
  actor?: string;
  action?: string;
  from?: Date;
  to?: Date;
  cursor?: string | null;
  limit?: number;
  /** Restringe a entidades de estos equipos (líder con audit.read de equipo). */
  teamIds?: readonly string[];
};

/** Visor de auditoría (HU-51): filtros + paginación por cursor (occurred_at, id). */
export async function listAudit(db: DbExecutor, f: AuditFilters) {
  const limit = Math.min(f.limit ?? 40, 100);
  const where: (SQL | undefined)[] = [];
  if (f.entityType) where.push(eq(auditLog.entityType, f.entityType));
  if (f.entityId) where.push(eq(auditLog.entityId, f.entityId));
  if (f.action) where.push(ilike(auditLog.action, `${f.action}%`));
  if (f.from) where.push(gte(auditLog.occurredAt, f.from));
  if (f.to) where.push(lte(auditLog.occurredAt, f.to));
  if (f.actor) {
    const like = `%${f.actor}%`;
    where.push(
      sql`${auditLog.actorId} in (select u.id from ${user} u where u.name ilike ${like} or u.email ilike ${like})`,
    );
  }
  if (f.teamIds) {
    const ids = [...f.teamIds];
    where.push(
      ids.length
        ? or(
            sql`(${auditLog.entityType} = 'ticket' and ${auditLog.entityId}::uuid in (select id from ${tickets} where team_id in ${ids}))`,
            sql`(${auditLog.entityType} = 'task' and ${auditLog.entityId}::uuid in (select id from ${tasks} where team_id in ${ids}))`,
          )
        : sql`false`,
    );
  }
  if (f.cursor) {
    const [iso, id] = Buffer.from(f.cursor, "base64url").toString().split("|");
    if (iso && id)
      where.push(sql`(${auditLog.occurredAt}, ${auditLog.id}) < (${new Date(iso)}, ${id})`);
  }
  const rows = await db
    .select({
      a: auditLog,
      actorName: sql<
        string | null
      >`(select u.name from ${user} u where u.id = ${auditLog.actorId})`,
      label: sql<string | null>`case ${auditLog.entityType}
        when 'ticket' then (select code from ${tickets} where id::text = ${auditLog.entityId})
        when 'task' then (select code from ${tasks} where id::text = ${auditLog.entityId})
        when 'user' then (select coalesce(u.name, ${auditLog.entityId}) from ${user} u where u.id::text = ${auditLog.entityId})
        else null end`,
    })
    .from(auditLog)
    .where(and(...where))
    .orderBy(desc(auditLog.occurredAt), desc(auditLog.id))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page.map(({ a, actorName, label }) => ({
      id: a.id,
      at: a.occurredAt.toISOString(),
      action: a.action,
      entityType: a.entityType,
      entityId: a.entityId,
      label,
      actorId: a.actorId,
      actorName,
      actorRole: a.actorRole,
      before: a.before,
      after: a.after,
      ip: a.ip,
      userAgent: a.userAgent,
      requestId: a.requestId,
    })),
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(`${last.a.occurredAt.toISOString()}|${last.a.id}`).toString("base64url")
        : null,
  };
}

export type AuditItem = Awaited<ReturnType<typeof listAudit>>["items"][number];

/** Acciones registradas (para el filtro). */
export async function auditActions(db: DbExecutor) {
  const rows = await db
    .selectDistinct({ action: auditLog.action })
    .from(auditLog)
    .orderBy(auditLog.action)
    .limit(200);
  return rows.map((r) => r.action);
}
