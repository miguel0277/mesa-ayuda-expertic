import { and, asc, desc, eq, gte, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { outer } from "@/shared/db/sql";
import { can, canReadTask, type Actor } from "@/shared/auth/permissions";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { getSetting } from "@/shared/config/settings-service";
import {
  attachments,
  auditLog,
  taskEvidence,
  tasks,
  teamMembers,
  teams,
  tickets,
  user,
} from "@/shared/db/schema";
import type { Priority, TaskStatus } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";
import {
  assistantSignal,
  compliance,
  onTimeStreak,
  taskSignal,
  type Signal,
} from "../domain/compliance";
import { TASK_TRANSITIONS } from "../domain/task-state";

/** Modelo de lectura de tareas (DTOs serializables para la UI). */

export type TaskCard = {
  id: string;
  code: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  dueAt: string | null;
  createdAt: string;
  completedAt: string | null;
  startedAt: string | null;
  requiresEvidence: boolean;
  evidence: number;
  signal: Signal | null;
  assignee: { id: string; name: string } | null;
  assignedBy: { id: string; name: string };
  ticket: { code: string; title: string } | null;
};

const assignerU = sql`(select u.name from ${user} u where u.id = ${outer(tasks.assignedBy)})`;
const assigneeName = sql`(select u.name from ${user} u where u.id = ${outer(tasks.assigneeId)})`;

async function cards(
  db: DbExecutor,
  where: SQL | undefined,
  order: SQL[],
  limit: number,
  now: Date,
  riskHours: number,
): Promise<TaskCard[]> {
  const rows = await db
    .select({
      t: tasks,
      assigneeName: sql<string | null>`${assigneeName}`,
      assignerName: sql<string>`${assignerU}`,
      evidence: sql<number>`(select count(*)::int from ${taskEvidence} e where e.task_id = ${outer(tasks.id)})`,
      ticketCode: tickets.code,
      ticketTitle: tickets.title,
    })
    .from(tasks)
    .leftJoin(tickets, eq(tickets.id, tasks.ticketId))
    .where(and(isNull(tasks.deletedAt), where))
    .orderBy(...order)
    .limit(limit);
  return rows.map(({ t, assigneeName: an, assignerName, evidence, ticketCode, ticketTitle }) => ({
    id: t.id,
    code: t.code,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    dueAt: t.dueAt?.toISOString() ?? null,
    createdAt: t.createdAt.toISOString(),
    completedAt: t.completedAt?.toISOString() ?? null,
    startedAt: t.startedAt?.toISOString() ?? null,
    requiresEvidence: t.requiresEvidence,
    evidence,
    signal: taskSignal(t, now, riskHours),
    assignee: t.assigneeId ? { id: t.assigneeId, name: an ?? "—" } : null,
    assignedBy: { id: t.assignedBy, name: assignerName },
    ticket: ticketCode ? { code: ticketCode, title: ticketTitle ?? "" } : null,
  }));
}

const byDue: SQL[] = [sql`${tasks.dueAt} asc nulls last`, desc(tasks.createdAt)];

/** Tablero del auxiliar: abiertas + completadas de los últimos 30 días. */
export async function myBoard(db: DbExecutor, actor: Actor, now: Date) {
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const since = new Date(now.getTime() - 30 * 86_400_000);
  const items = await cards(
    db,
    and(
      eq(tasks.assigneeId, actor.id),
      or(
        inArray(tasks.status, ["pendiente", "en_progreso"]),
        and(eq(tasks.status, "completada"), gte(tasks.completedAt, since)),
      ),
    ),
    byDue,
    200,
    now,
    riskHours,
  );
  return { items, riskHours };
}

/** Progreso del auxiliar (HU-22): mes en curso en hora de Bogotá. */
export async function myProgress(db: DbExecutor, userId: string, now: Date) {
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const monthStart = new Date(Date.UTC(y, m - 1, 1, 5)); // 00:00 Bogotá
  const rows = await db
    .select({ status: tasks.status, dueAt: tasks.dueAt, completedAt: tasks.completedAt })
    .from(tasks)
    .where(and(eq(tasks.assigneeId, userId), isNull(tasks.deletedAt)));
  const inMonth = rows.filter((r) => (r.dueAt ? r.dueAt >= monthStart : false));
  return {
    month: compliance(inMonth, now, riskHours),
    overall: compliance(rows, now, riskHours),
    streak: onTimeStreak(rows),
    signal: assistantSignal(rows, now, riskHours),
    monthStart: monthStart.toISOString(),
  };
}

export type TaskFilters = {
  status?: TaskStatus[];
  assigneeId?: string;
  teamId?: string;
  signal?: Signal;
  q?: string;
};

/** Lista de tareas para el docente (todas) o el líder (su equipo). */
export async function listTasks(db: DbExecutor, actor: Actor, f: TaskFilters, now: Date) {
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const scope = can(actor, "task.read.all")
    ? undefined
    : actor.leadTeamIds.length
      ? inArray(tasks.teamId, [...actor.leadTeamIds])
      : sql`false`;
  const where = and(
    scope,
    f.status?.length ? inArray(tasks.status, f.status) : undefined,
    f.assigneeId ? eq(tasks.assigneeId, f.assigneeId) : undefined,
    f.teamId ? eq(tasks.teamId, f.teamId) : undefined,
    f.q?.trim()
      ? or(
          sql`${tasks.code} ilike ${`%${f.q.trim()}%`}`,
          sql`${tasks.title} ilike ${`%${f.q.trim()}%`}`,
        )
      : undefined,
  );
  const items = await cards(db, where, byDue, 300, now, riskHours);
  return f.signal ? items.filter((i) => i.signal === f.signal) : items;
}

// ─────────────────────────────── Detalle ───────────────────────────────

export async function taskDetail(db: DbExecutor, actor: Actor, code: string, now: Date) {
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const [card] = await cards(
    db,
    eq(tasks.code, code.toUpperCase()),
    [desc(tasks.createdAt)],
    1,
    now,
    riskHours,
  );
  if (!card) return null;
  const [raw] = await db
    .select({ teamId: tasks.teamId })
    .from(tasks)
    .where(eq(tasks.id, card.id))
    .limit(1);
  const resource = {
    assigneeId: card.assignee?.id,
    teamId: raw?.teamId,
    assignedById: card.assignedBy.id,
  };
  if (!canReadTask(actor, resource) && card.assignedBy.id !== actor.id) return null;

  const author = sql<string>`(select u.name from ${user} u where u.id = ${outer(taskEvidence.authorId)})`;
  const ev = await db
    .select({ e: taskEvidence, authorName: author })
    .from(taskEvidence)
    .where(eq(taskEvidence.taskId, card.id))
    .orderBy(asc(taskEvidence.createdAt));
  const files = ev.length
    ? await db
        .select({
          id: attachments.id,
          ownerId: attachments.ownerId,
          fileName: attachments.fileName,
          mime: attachments.mime,
          sizeBytes: attachments.sizeBytes,
        })
        .from(attachments)
        .where(
          and(
            inArray(
              attachments.ownerId,
              ev.map((x) => x.e.id),
            ),
            isNull(attachments.deletedAt),
          ),
        )
    : [];
  const actorName = sql<
    string | null
  >`(select u.name from ${user} u where u.id = ${outer(auditLog.actorId)})`;
  const history = await db
    .select({ a: auditLog, actorName })
    .from(auditLog)
    .where(and(eq(auditLog.entityType, "task"), eq(auditLog.entityId, card.id)))
    .orderBy(asc(auditLog.occurredAt), asc(auditLog.id));

  const isAssignee = card.assignee?.id === actor.id || actor.role === "admin";
  const isAssigner = can(actor, "task.cancel", { assignedById: card.assignedBy.id });
  const kinds = [...(isAssignee ? ["assignee"] : []), ...(isAssigner ? ["assigner"] : [])];
  return {
    ...card,
    teamId: raw?.teamId ?? null,
    evidenceItems: ev.map(({ e, authorName }) => ({
      id: e.id,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
      authorName,
      files: files
        .filter((f) => f.ownerId === e.id)
        .map(({ id, fileName, mime, sizeBytes }) => ({ id, fileName, mime, sizeBytes })),
    })),
    history: history.map(({ a, actorName: n }) => ({
      id: a.id,
      at: a.occurredAt.toISOString(),
      action: a.action,
      actorName: n,
      before: a.before,
      after: a.after,
    })),
    viewer: {
      isAssignee,
      isAssigner,
      transitions: TASK_TRANSITIONS[card.status]
        .filter((r) => r.by.some((b) => kinds.includes(b)))
        .map((r) => r.to),
      canReassign:
        card.status !== "completada" &&
        card.status !== "cancelada" &&
        can(actor, "task.assign", { targetTeamId: raw?.teamId }),
    },
  };
}

export type TaskDetailDTO = NonNullable<Awaited<ReturnType<typeof taskDetail>>>;

// ─────────────────────────────── Equipo (HU-30) ───────────────────────────────

export async function teamOverview(db: DbExecutor, teamIds: readonly string[], now: Date) {
  if (!teamIds.length) return { members: [], feed: [], teams: [] };
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const teamRows = await db
    .select({ id: teams.id, name: teams.name, semester: teams.semester })
    .from(teams)
    .where(inArray(teams.id, [...teamIds]));
  const members = await db
    .selectDistinct({
      id: user.id,
      name: user.name,
      role: user.role,
      image: user.image,
      teamId: teamMembers.teamId,
    })
    .from(teamMembers)
    .innerJoin(user, eq(user.id, teamMembers.userId))
    .where(
      and(
        inArray(teamMembers.teamId, [...teamIds]),
        isNull(teamMembers.until),
        eq(user.status, "activo"),
      ),
    )
    .orderBy(asc(user.name));
  const ids = [...new Set(members.map((m) => m.id))];
  const all = ids.length
    ? await db
        .select({
          id: tasks.id,
          code: tasks.code,
          title: tasks.title,
          status: tasks.status,
          dueAt: tasks.dueAt,
          completedAt: tasks.completedAt,
          assigneeId: tasks.assigneeId,
          startedAt: tasks.startedAt,
          createdAt: tasks.createdAt,
        })
        .from(tasks)
        .where(and(inArray(tasks.assigneeId, ids), isNull(tasks.deletedAt)))
    : [];

  const summary = ids.map((id) => {
    const m = members.find((x) => x.id === id)!;
    const mine = all.filter((t) => t.assigneeId === id);
    const open = mine
      .filter((t) => t.status === "pendiente" || t.status === "en_progreso")
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity));
    const c = compliance(mine, now, riskHours);
    const next = open[0];
    return {
      id,
      name: m.name,
      role: ROLE_LABEL[m.role],
      teamId: m.teamId,
      signal: assistantSignal(mine, now, riskHours),
      compliance: c,
      next: next
        ? {
            code: next.code,
            title: next.title,
            dueAt: next.dueAt?.toISOString() ?? null,
            createdAt: (next.startedAt ?? next.createdAt).toISOString(),
            signal: taskSignal(next, now, riskHours),
          }
        : null,
    };
  });

  const taskIds = all.map((t) => t.id);
  const actorName = sql<
    string | null
  >`(select u.name from ${user} u where u.id = ${outer(auditLog.actorId)})`;
  const feed = taskIds.length
    ? await db
        .select({
          id: auditLog.id,
          at: auditLog.occurredAt,
          action: auditLog.action,
          actorName,
          entityId: auditLog.entityId,
        })
        .from(auditLog)
        .where(and(eq(auditLog.entityType, "task"), inArray(auditLog.entityId, taskIds)))
        .orderBy(desc(auditLog.occurredAt))
        .limit(15)
    : [];
  return {
    teams: teamRows,
    members: summary,
    feed: feed.map((f) => {
      const t = all.find((x) => x.id === f.entityId);
      return {
        id: f.id,
        at: f.at.toISOString(),
        action: f.action,
        actorName: f.actorName,
        code: t?.code ?? "",
        title: t?.title ?? "",
      };
    }),
  };
}

/** Personas a las que el actor puede asignar tareas (con su equipo). */
export async function assignableForTasks(db: DbExecutor, actor: Actor) {
  const cond = can(actor, "task.read.all")
    ? undefined
    : actor.leadTeamIds.length
      ? inArray(teamMembers.teamId, [...actor.leadTeamIds])
      : sql`false`;
  const rows = await db
    .selectDistinct({
      id: user.id,
      name: user.name,
      role: user.role,
      teamId: teamMembers.teamId,
      teamName: teams.name,
    })
    .from(user)
    .leftJoin(teamMembers, and(eq(teamMembers.userId, user.id), isNull(teamMembers.until)))
    .leftJoin(teams, and(eq(teams.id, teamMembers.teamId), eq(teams.active, true)))
    .where(and(inArray(user.role, ["auxiliar", "lider"]), eq(user.status, "activo"), cond))
    .orderBy(asc(user.name));
  const people = [
    ...new Map(
      rows.map((r) => [
        r.id,
        { id: r.id, name: r.name, role: ROLE_LABEL[r.role], teamName: r.teamName },
      ]),
    ).values(),
  ];
  const teamList = can(actor, "task.read.all")
    ? await db
        .select({ id: teams.id, name: teams.name })
        .from(teams)
        .where(and(eq(teams.active, true), isNull(teams.deletedAt)))
        .orderBy(asc(teams.name))
    : actor.leadTeamIds.length
      ? await db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, [...actor.leadTeamIds]))
      : [];
  return { people, teams: teamList };
}
