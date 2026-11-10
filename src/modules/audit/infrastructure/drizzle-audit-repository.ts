import { auditLog } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import { sanitizeSnapshot, type AuditEntry, type AuditRepository } from "../domain/audit-entry";

export class DrizzleAuditRepository implements AuditRepository {
  constructor(private readonly db: DbExecutor) {}

  async append(entry: AuditEntry): Promise<void> {
    await this.db.insert(auditLog).values({
      occurredAt: entry.occurredAt ?? new Date(),
      actorId: entry.actorId,
      actorRole: entry.actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      before: sanitizeSnapshot(entry.before) ?? null,
      after: sanitizeSnapshot(entry.after) ?? null,
      ip: entry.ip ?? null,
      userAgent: entry.userAgent?.slice(0, 400) ?? null,
      requestId: entry.requestId ?? null,
    });
  }
}
