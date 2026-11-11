import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { assistantSignal, compliance, taskSignal } from "@/modules/tasks/domain/compliance";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { getSetting } from "@/shared/config/settings-service";
import { getDb } from "@/shared/db/client";
import {
  tasks,
  teamMembers,
  teams,
  tickets,
  ticketTypes,
  user,
  vTicketSla,
} from "@/shared/db/schema";

/**
 * Panel de control del docente (HU-40). Lecturas costosas con caché corta (`"use cache"`),
 * invalidada con `updateTag("dashboard")` cada vez que cambia un ticket o una tarea.
 */
export const DASHBOARD_TAG = "dashboard";

export type Period = "mes" | "30d" | "semestre";

export function periodStart(period: Period, now: Date): Date {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  if (period === "30d") return new Date(now.getTime() - 30 * 86_400_000);
  if (period === "semestre") return new Date(Date.UTC(y, m >= 7 ? 7 : 1, 1, 5)); // 1 de agosto o 1 de febrero, 00:00 Bogotá
  return new Date(Date.UTC(y, m - 1, 1, 5));
}

const OPEN_TICKETS = ["abierto", "asignado", "en_progreso", "respondido", "reabierto"] as const;

export async function getDashboard(period: Period, teamId: string | null) {
  "use cache";
  cacheTag(DASHBOARD_TAG);
  cacheLife("minutes");

  const db = getDb();
  const now = new Date();
  const since = periodStart(period, now);
  const riskHours = await getSetting(db, "tasks.riskThresholdHours");
  const teamTask = teamId ? eq(tasks.teamId, teamId) : undefined;
  const teamTicket = teamId ? eq(tickets.teamId, teamId) : undefined;

  // ── Tareas ──
  const allTasks = await db
    .select({
      id: tasks.id,
      code: tasks.code,
      title: tasks.title,
      status: tasks.status,
      dueAt: tasks.dueAt,
      completedAt: tasks.completedAt,
      assigneeId: tasks.assigneeId,
      createdAt: tasks.createdAt,
      startedAt: tasks.startedAt,
    })
    .from(tasks)
    .where(and(isNull(tasks.deletedAt), teamTask));
  const periodTasks = allTasks.filter((t) => t.dueAt && t.dueAt >= since);
  const taskStats = compliance(periodTasks, now, riskHours);
  const openTasks = allTasks.filter((t) => t.status === "pendiente" || t.status === "en_progreso");
  const overdue = openTasks.filter((t) => taskSignal(t, now, riskHours) === "atrasada").length;

  // ── Tickets ──
  const [open] = await db
    .select({
      n: sql<number>`count(*)::int`,
      unassigned: sql<number>`count(*) filter (where ${tickets.assigneeId} is null)::int`,
      oldestUnassigned: sql<
        string | null
      >`min(${tickets.createdAt}) filter (where ${tickets.assigneeId} is null)`,
    })
    .from(tickets)
    .where(and(isNull(tickets.deletedAt), inArray(tickets.status, [...OPEN_TICKETS]), teamTicket));
  const [sla] = await db
    .select({
      met: sql<number>`count(*) filter (where ${vTicketSla.slaState} = 'cumplido')::int`,
      missed: sql<number>`count(*) filter (where ${vTicketSla.slaState} in ('incumplido','vencido'))::int`,
    })
    .from(vTicketSla)
    .where(
      and(gte(vTicketSla.createdAt, since), teamId ? eq(vTicketSla.teamId, teamId) : undefined),
    );
  const slaTotal = (sla?.met ?? 0) + (sla?.missed ?? 0);

  const byType = await db
    .select({
      name: ticketTypes.name,
      color: ticketTypes.color,
      n: sql<number>`count(${tickets.id})::int`,
    })
    .from(ticketTypes)
    .leftJoin(
      tickets,
      and(
        eq(tickets.typeId, ticketTypes.id),
        gte(tickets.createdAt, since),
        isNull(tickets.deletedAt),
        teamTicket,
      ),
    )
    .where(eq(ticketTypes.active, true))
    .groupBy(ticketTypes.id, ticketTypes.name, ticketTypes.color, ticketTypes.sortOrder)
    .orderBy(ticketTypes.sortOrder);

  const weeksBack = new Date(now.getTime() - 8 * 7 * 86_400_000);
  const weekRows = await db.execute<{ week: string; created: number; closed: number }>(sql`
    with weeks as (
      select generate_series(date_trunc('week', (${weeksBack}::timestamptz at time zone 'America/Bogota')), date_trunc('week', (now() at time zone 'America/Bogota')), interval '1 week') as week
    )
    select to_char(w.week, 'YYYY-MM-DD') as week,
      (select count(*)::int from tickets t where t.deleted_at is null ${teamId ? sql`and t.team_id = ${teamId}` : sql``} and date_trunc('week', t.created_at at time zone 'America/Bogota') = w.week) as created,
      (select count(*)::int from tickets t where t.deleted_at is null ${teamId ? sql`and t.team_id = ${teamId}` : sql``} and t.closed_at is not null and date_trunc('week', t.closed_at at time zone 'America/Bogota') = w.week) as closed
    from weeks w order by w.week`);
  const weeks = ((weekRows as unknown as { rows?: unknown[] }).rows ??
    (weekRows as unknown as unknown[])) as { week: string; created: number; closed: number }[];

  // ── Cumplimiento por auxiliar ──
  const staff = await db
    .selectDistinct({
      id: user.id,
      name: user.name,
      role: user.role,
      teamName: teams.name,
      teamId: teams.id,
    })
    .from(user)
    .leftJoin(teamMembers, and(eq(teamMembers.userId, user.id), isNull(teamMembers.until)))
    .leftJoin(teams, and(eq(teams.id, teamMembers.teamId), eq(teams.active, true)))
    .where(
      and(
        inArray(user.role, ["auxiliar", "lider"]),
        eq(user.status, "activo"),
        teamId ? eq(teams.id, teamId) : undefined,
      ),
    );
  const people = [...new Map(staff.map((s) => [s.id, s])).values()].map((s) => {
    const mine = allTasks.filter((t) => t.assigneeId === s.id);
    const c = compliance(
      mine.filter((t) => t.dueAt && t.dueAt >= since),
      now,
      riskHours,
    );
    const next = mine
      .filter((t) => t.status === "pendiente" || t.status === "en_progreso")
      .sort((a, b) => (a.dueAt?.getTime() ?? Infinity) - (b.dueAt?.getTime() ?? Infinity))[0];
    return {
      id: s.id,
      name: s.name,
      role: ROLE_LABEL[s.role],
      team: s.teamName,
      signal: assistantSignal(mine, now, riskHours),
      pct: c.pct,
      onTime: c.onTime,
      dueElapsed: c.dueElapsed,
      open: mine.filter((t) => t.status === "pendiente" || t.status === "en_progreso").length,
      overdue: mine.filter(
        (t) =>
          (t.status === "pendiente" || t.status === "en_progreso") &&
          taskSignal(t, now, riskHours) === "atrasada",
      ).length,
      next: next
        ? {
            code: next.code,
            title: next.title,
            dueAt: next.dueAt?.toISOString() ?? null,
            start: (next.startedAt ?? next.createdAt).toISOString(),
            signal: taskSignal(next, now, riskHours),
          }
        : null,
    };
  });
  const rank = { atrasada: 0, en_riesgo: 1, a_tiempo: 2 } as const;
  people.sort(
    (a, b) =>
      (a.signal ? rank[a.signal] : 3) - (b.signal ? rank[b.signal] : 3) ||
      (a.pct ?? 101) - (b.pct ?? 101),
  );

  // ── Tickets recientes ──
  const recent = await db
    .select({
      code: tickets.code,
      title: tickets.title,
      status: tickets.status,
      priority: tickets.priority,
      createdAt: tickets.createdAt,
      requester: sql<string>`(select u.name from ${user} u where u.id = ${tickets.requesterId})`,
      typeName: ticketTypes.name,
      icon: ticketTypes.icon,
      color: ticketTypes.color,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.typeId))
    .where(and(isNull(tickets.deletedAt), teamTicket))
    .orderBy(desc(tickets.createdAt))
    .limit(6);

  return {
    generatedAt: now.toISOString(),
    since: since.toISOString(),
    kpis: {
      activeTasks: openTasks.length,
      compliancePct: taskStats.pct,
      onTime: taskStats.onTime,
      dueElapsed: taskStats.dueElapsed,
      overdue,
      openTickets: open?.n ?? 0,
      unassigned: open?.unassigned ?? 0,
      oldestUnassigned: open?.oldestUnassigned
        ? new Date(open.oldestUnassigned).toISOString()
        : null,
      slaPct: slaTotal ? Math.round(((sla?.met ?? 0) / slaTotal) * 1000) / 10 : null,
      slaMet: sla?.met ?? 0,
      slaTotal,
    },
    byType,
    weeks,
    people,
    recent: recent.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() })),
  };
}

export type Dashboard = Awaited<ReturnType<typeof getDashboard>>;

export async function activeTeams() {
  "use cache";
  cacheTag(DASHBOARD_TAG);
  cacheLife("hours");
  return getDb()
    .select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(and(eq(teams.active, true), isNull(teams.deletedAt)));
}
