import {
  aliasedTable,
  and,
  asc,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  lt,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { TemplateField } from "@/modules/templates/domain/template-field";
import { can, canReadTicket, type Actor } from "@/shared/auth/permissions";
import { ROLE_LABEL } from "@/shared/auth/roles";
import {
  attachments,
  auditLog,
  teamMembers,
  teams,
  ticketMessages,
  tickets,
  ticketTypes,
  user,
} from "@/shared/db/schema";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";
import { allowedTransitions, type TicketActorKind } from "../domain/ticket-state";
import { actorKindOn } from "../application/ticket-commands";

/**
 * Modelo de lectura de tickets (consultas para la UI). Devuelve DTOs serializables:
 * el dominio no se filtra a los componentes.
 */

export type TicketScope = "mine" | "assigned" | "team" | "all";

export type TicketListFilters = {
  scope: TicketScope;
  status?: TicketStatus[];
  priority?: Priority[];
  typeId?: string;
  assigneeId?: string | "none";
  q?: string;
  sort?: "recientes" | "antiguos" | "vencimiento";
  cursor?: string | null;
  limit?: number;
};

export type TicketListItem = {
  id: string;
  code: string;
  title: string;
  status: TicketStatus;
  priority: Priority;
  createdAt: string;
  lastActivityAt: string;
  slaFirstResponseDue: string;
  slaResolutionDue: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  type: { id: string; name: string; icon: string; color: string };
  requester: { id: string; name: string; role: string };
  assignee: { id: string; name: string } | null;
  messages: number;
};

const requesterU = aliasedTable(user, "requester_u");

function encodeCursor(createdAt: Date, id: string) {
  return Buffer.from(`${createdAt.toISOString()}|${id}`).toString("base64url");
}
function decodeCursor(cursor: string): { createdAt: Date; id: string } | null {
  try {
    const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
    if (!iso || !id) return null;
    return { createdAt: new Date(iso), id };
  } catch {
    return null;
  }
}

/** Condición de visibilidad según el alcance pedido y los permisos del actor. */
function scopeCondition(actor: Actor, scope: TicketScope): SQL | undefined {
  switch (scope) {
    case "mine":
      return eq(tickets.requesterId, actor.id);
    case "assigned":
      return eq(tickets.assigneeId, actor.id);
    case "team":
      if (can(actor, "ticket.read.all")) return undefined;
      return actor.leadTeamIds.length
        ? inArray(tickets.teamId, [...actor.leadTeamIds])
        : sql`false`;
    case "all":
      return can(actor, "ticket.read.all") ? undefined : sql`false`;
  }
}

export async function listTickets(
  db: DbExecutor,
  actor: Actor,
  f: TicketListFilters,
): Promise<{ items: TicketListItem[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(f.limit ?? 20, 1), 100);
  const where: (SQL | undefined)[] = [isNull(tickets.deletedAt), scopeCondition(actor, f.scope)];
  if (f.status?.length) where.push(inArray(tickets.status, f.status));
  if (f.priority?.length) where.push(inArray(tickets.priority, f.priority));
  if (f.typeId) where.push(eq(tickets.typeId, f.typeId));
  if (f.assigneeId === "none") where.push(isNull(tickets.assigneeId));
  else if (f.assigneeId) where.push(eq(tickets.assigneeId, f.assigneeId));
  if (f.q?.trim()) {
    const q = `%${f.q.trim().replace(/[%_]/g, "\\$&")}%`;
    where.push(
      or(
        ilike(tickets.code, q),
        ilike(tickets.title, q),
        ilike(requesterU.name, q),
        ilike(requesterU.email, q),
      ),
    );
  }
  const base = and(...where);

  const sort = f.sort ?? "recientes";
  const cur = f.cursor && sort !== "vencimiento" ? decodeCursor(f.cursor) : null;
  const pageWhere = cur
    ? and(
        base,
        sort === "antiguos"
          ? or(
              sql`${tickets.createdAt} > ${cur.createdAt}`,
              and(eq(tickets.createdAt, cur.createdAt), sql`${tickets.id} > ${cur.id}`),
            )
          : or(
              lt(tickets.createdAt, cur.createdAt),
              and(eq(tickets.createdAt, cur.createdAt), lt(tickets.id, cur.id)),
            ),
      )
    : base;
  const offset = sort === "vencimiento" && f.cursor ? Number(f.cursor) || 0 : 0;

  const order: SQL[] =
    sort === "antiguos"
      ? [asc(tickets.createdAt), asc(tickets.id)]
      : sort === "vencimiento"
        ? [asc(tickets.slaResolutionDue), desc(tickets.id)]
        : [desc(tickets.createdAt), desc(tickets.id)];

  const rows = await db
    .select({
      t: tickets,
      type: {
        id: ticketTypes.id,
        name: ticketTypes.name,
        icon: ticketTypes.icon,
        color: ticketTypes.color,
      },
      requester: { id: requesterU.id, name: requesterU.name, role: requesterU.role },
      assigneeName: sql<
        string | null
      >`(select u.name from ${user} u where u.id = ${tickets.assigneeId})`,
      messages: sql<number>`(select count(*)::int from ${ticketMessages} m where m.ticket_id = ${tickets.id} and m.deleted_at is null and (m.is_internal = false or ${!!(f.scope !== "mine")}))`,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.typeId))
    .innerJoin(requesterU, eq(requesterU.id, tickets.requesterId))
    .where(pageWhere)
    .orderBy(...order)
    .limit(limit + 1)
    .offset(offset);

  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(tickets)
    .innerJoin(requesterU, eq(requesterU.id, tickets.requesterId))
    .where(base);

  const page = rows.slice(0, limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > limit && last
      ? sort === "vencimiento"
        ? String(offset + limit)
        : encodeCursor(last.t.createdAt, last.t.id)
      : null;

  return {
    total,
    nextCursor,
    items: page.map(({ t, type, requester, assigneeName, messages }) => ({
      id: t.id,
      code: t.code,
      title: t.title,
      status: t.status,
      priority: t.priority,
      createdAt: t.createdAt.toISOString(),
      lastActivityAt: t.lastActivityAt.toISOString(),
      slaFirstResponseDue: t.slaFirstResponseDue.toISOString(),
      slaResolutionDue: t.slaResolutionDue.toISOString(),
      firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
      resolvedAt: t.resolvedAt?.toISOString() ?? null,
      type,
      requester: { id: requester.id, name: requester.name, role: ROLE_LABEL[requester.role] },
      assignee: t.assigneeId ? { id: t.assigneeId, name: assigneeName ?? "—" } : null,
      messages,
    })),
  };
}

/** Conteos por estado para las pestañas/filtros. */
export async function countByStatus(db: DbExecutor, actor: Actor, scope: TicketScope) {
  const rows = await db
    .select({ status: tickets.status, n: sql<number>`count(*)::int` })
    .from(tickets)
    .where(and(isNull(tickets.deletedAt), scopeCondition(actor, scope)))
    .groupBy(tickets.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
    Record<TicketStatus, number>
  >;
}

// ─────────────────────────────── Detalle ───────────────────────────────

export type AttachmentDTO = { id: string; fileName: string; mime: string; sizeBytes: number };

export type TimelineEntry = {
  id: string;
  at: string;
  action: string;
  actorName: string | null;
  actorRole: string | null;
  before: unknown;
  after: unknown;
};

export type TicketDetail = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: Priority;
  values: Record<string, unknown>;
  createdAt: string;
  lastActivityAt: string;
  firstResponseAt: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  slaFirstResponseDue: string;
  slaResolutionDue: string;
  rating: number | null;
  ratingComment: string | null;
  type: { id: string; name: string; icon: string; color: string; fields: TemplateField[] };
  requester: {
    id: string;
    name: string;
    email: string;
    role: string;
    programa: string | null;
    codigoUis: string | null;
  };
  assignee: { id: string; name: string; email: string } | null;
  team: { id: string; name: string } | null;
  attachments: AttachmentDTO[];
  messages: {
    id: string;
    body: string;
    internal: boolean;
    createdAt: string;
    author: { id: string; name: string; role: string; isStaff: boolean };
    attachments: AttachmentDTO[];
  }[];
  timeline: TimelineEntry[];
  viewer: {
    kind: TicketActorKind;
    canReply: boolean;
    canInternalNote: boolean;
    canAssign: boolean;
    canChangePriority: boolean;
    canRate: boolean;
    transitions: { to: TicketStatus; label: string }[];
  };
};

export async function getTicketDetail(
  db: DbExecutor,
  actor: Actor,
  code: string,
): Promise<TicketDetail | null> {
  const [row] = await db
    .select({
      t: tickets,
      type: {
        id: ticketTypes.id,
        name: ticketTypes.name,
        icon: ticketTypes.icon,
        color: ticketTypes.color,
        fields: ticketTypes.fields,
      },
      requester: {
        id: requesterU.id,
        name: requesterU.name,
        email: requesterU.email,
        role: requesterU.role,
        programa: requesterU.programa,
        codigoUis: requesterU.codigoUis,
      },
      team: { id: teams.id, name: teams.name },
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.typeId))
    .innerJoin(requesterU, eq(requesterU.id, tickets.requesterId))
    .leftJoin(teams, eq(teams.id, tickets.teamId))
    .where(and(eq(tickets.code, code.toUpperCase()), isNull(tickets.deletedAt)))
    .limit(1);
  if (!row) return null;
  const t = row.t;
  const resource = { requesterId: t.requesterId, assigneeId: t.assigneeId, teamId: t.teamId };
  if (!canReadTicket(actor, resource)) return null;

  // Drizzle 0.45 infiere `never` al unir dos alias de "user" en una consulta: el asignado va aparte.
  const [assignee] = t.assigneeId
    ? await db
        .select({ id: user.id, name: user.name, email: user.email })
        .from(user)
        .where(eq(user.id, t.assigneeId))
        .limit(1)
    : [];

  const kind = actorKindOn(actor, t) ?? "requester";
  const seeInternal = kind === "staff" && can(actor, "ticket.internal_note", resource);

  const author = aliasedTable(user, "author_u");
  const msgs = await db
    .select({ m: ticketMessages, author: { id: author.id, name: author.name, role: author.role } })
    .from(ticketMessages)
    .innerJoin(author, eq(author.id, ticketMessages.authorId))
    .where(
      and(
        eq(ticketMessages.ticketId, t.id),
        isNull(ticketMessages.deletedAt),
        seeInternal ? undefined : eq(ticketMessages.isInternal, false),
      ),
    )
    .orderBy(asc(ticketMessages.createdAt), asc(ticketMessages.id));

  const files = await db
    .select({
      id: attachments.id,
      ownerType: attachments.ownerType,
      ownerId: attachments.ownerId,
      fileName: attachments.fileName,
      mime: attachments.mime,
      sizeBytes: attachments.sizeBytes,
    })
    .from(attachments)
    .where(
      and(
        isNull(attachments.deletedAt),
        inArray(attachments.ownerId, [t.id, ...msgs.map((m) => m.m.id)]),
      ),
    );
  const filesOf = (ownerId: string) =>
    files
      .filter((f) => f.ownerId === ownerId)
      .map(({ id, fileName, mime, sizeBytes }) => ({ id, fileName, mime, sizeBytes }));

  const actorU = aliasedTable(user, "actor_u");
  const audit = await db
    .select({ a: auditLog, actorName: actorU.name })
    .from(auditLog)
    .leftJoin(actorU, eq(actorU.id, auditLog.actorId))
    .where(
      and(
        eq(auditLog.entityType, "ticket"),
        eq(auditLog.entityId, t.id),
        seeInternal ? undefined : ne(auditLog.action, "ticket.internal_note_added"),
      ),
    )
    .orderBy(asc(auditLog.occurredAt), asc(auditLog.id));

  const transitions = allowedTransitions(t.status, kind)
    .filter((r) => !(r.to === "asignado" && !t.assigneeId))
    .filter(() => can(actor, "ticket.status", resource))
    .map((r) => ({ to: r.to, label: r.label }));

  return {
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    values: t.values,
    createdAt: t.createdAt.toISOString(),
    lastActivityAt: t.lastActivityAt.toISOString(),
    firstResponseAt: t.firstResponseAt?.toISOString() ?? null,
    resolvedAt: t.resolvedAt?.toISOString() ?? null,
    closedAt: t.closedAt?.toISOString() ?? null,
    slaFirstResponseDue: t.slaFirstResponseDue.toISOString(),
    slaResolutionDue: t.slaResolutionDue.toISOString(),
    rating: t.rating,
    ratingComment: t.ratingComment,
    type: row.type,
    requester: { ...row.requester, role: ROLE_LABEL[row.requester.role] },
    assignee: assignee ?? null,
    team: row.team?.id ? { id: row.team.id, name: row.team.name } : null,
    attachments: filesOf(t.id),
    messages: msgs.map(({ m, author: a }) => ({
      id: m.id,
      body: m.body,
      internal: m.isInternal,
      createdAt: m.createdAt.toISOString(),
      author: { id: a.id, name: a.name, role: ROLE_LABEL[a.role], isStaff: a.id !== t.requesterId },
      attachments: filesOf(m.id),
    })),
    timeline: audit.map(({ a, actorName }) => ({
      id: a.id,
      at: a.occurredAt.toISOString(),
      action: a.action,
      actorName,
      actorRole: a.actorRole
        ? ((ROLE_LABEL as Record<string, string>)[a.actorRole] ?? a.actorRole)
        : null,
      before: a.before,
      after: a.after,
    })),
    viewer: {
      kind,
      canReply: t.status !== "cerrado" && can(actor, "ticket.reply", resource),
      canInternalNote: seeInternal,
      canAssign: can(actor, "ticket.assign", resource) && t.status !== "cerrado",
      canChangePriority: can(actor, "ticket.priority", resource) && t.status !== "cerrado",
      canRate: can(actor, "ticket.rate", resource) && t.status === "cerrado",
      transitions,
    },
  };
}

/** Personas a las que el actor puede asignar (equipo del líder, o todo el personal). */
export async function assignableStaff(db: DbExecutor, actor: Actor) {
  const staffRoles = ["auxiliar", "lider"] as const;
  if (actor.role === "lider") {
    if (!actor.leadTeamIds.length) return [];
    const rows = await db
      .selectDistinct({ id: user.id, name: user.name, role: user.role })
      .from(teamMembers)
      .innerJoin(user, eq(user.id, teamMembers.userId))
      .where(
        and(
          inArray(teamMembers.teamId, [...actor.leadTeamIds]),
          isNull(teamMembers.until),
          eq(user.status, "activo"),
        ),
      )
      .orderBy(asc(user.name));
    return rows.map((r) => ({ ...r, role: ROLE_LABEL[r.role] }));
  }
  const rows = await db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(and(inArray(user.role, [...staffRoles]), eq(user.status, "activo")))
    .orderBy(asc(user.name));
  return rows.map((r) => ({ ...r, role: ROLE_LABEL[r.role] }));
}

/** Categorías activas para el formulario de nueva solicitud. */
export async function activeTicketTypes(db: DbExecutor) {
  return db
    .select({
      id: ticketTypes.id,
      name: ticketTypes.name,
      slug: ticketTypes.slug,
      description: ticketTypes.description,
      icon: ticketTypes.icon,
      color: ticketTypes.color,
      fields: ticketTypes.fields,
      defaultPriority: ticketTypes.defaultPriority,
    })
    .from(ticketTypes)
    .where(and(eq(ticketTypes.active, true), isNull(ticketTypes.deletedAt)))
    .orderBy(asc(ticketTypes.sortOrder));
}
