/** Entrada de auditoría (solo inserción). */
export type AuditEntry = {
  occurredAt?: Date;
  actorId: string | null;
  actorRole: string | null;
  action: string;
  entityType: string;
  entityId: string;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
  requestId?: string | null;
};

/** Repositorio de auditoría: solo puede agregar. */
export interface AuditRepository {
  append(entry: AuditEntry): Promise<void>;
}

/** Contexto de la petición que acompaña a cada cambio. */
export type RequestMeta = {
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
};

/** Quita campos sensibles antes de guardar un "antes/después". */
export function sanitizeSnapshot(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (Array.isArray(value)) return value.map(sanitizeSnapshot);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (/password|token|secret|hash/i.test(k)) continue;
      out[k] = sanitizeSnapshot(v);
    }
    return out;
  }
  return value;
}
