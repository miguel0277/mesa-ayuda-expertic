import { TZDate } from "@date-fns/tz";
import { eq, sql } from "drizzle-orm";
import {
  addBusinessMinutes,
  defaultCalendar,
  type BusinessCalendar,
} from "../../lib/business-time";
import { allDefaultSettings } from "../../config/settings";
import { newId } from "../../kernel/id";
import * as s from "../schema";
import type { Priority, Role, TaskStatus, TicketStatus } from "../schema/enums";
import type { Database, DbExecutor } from "../types";
import { SLA_POLICIES, DEFAULT_BUSINESS_HOURS, TICKET_TYPES } from "./catalog";
import {
  COURSES,
  CURRENT_SEMESTER,
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  DEMO_TEAMS,
  DEMO_USERS,
  EVIDENCE_NOTES,
  INTERNAL_NOTES,
  PREVIOUS_SEMESTER,
  REQUESTER_FOLLOWUPS,
  STAFF_REPLIES,
  TASK_SAMPLES,
  TICKET_SAMPLES,
} from "./demo-data";

export type SeedOptions = {
  admin: { email: string; password: string; name?: string };
  /** true = catálogos + admin + datos de demostración; false = solo catálogos + admin. */
  demo: boolean;
  /** Vacía todas las tablas antes de sembrar (solo desarrollo). */
  reset?: boolean;
  now?: Date;
  /** Hash de contraseña compatible con Better Auth (inyectado para pruebas rápidas). */
  hashPassword: (password: string) => Promise<string>;
  log?: (msg: string) => void;
};

export type SeedSummary = Record<string, number>;

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const MINUTE = 60_000;

/** PRNG determinista (mulberry32): la semilla siempre produce los mismos datos. */
function rng(seed: number) {
  let a = seed;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T>(list: readonly T[]): T => {
      const item = list[Math.floor(next() * list.length)];
      if (item === undefined) throw new Error("Lista vacía");
      return item;
    },
  };
}

const bogotaYear = (d: Date) => new TZDate(d.getTime(), "America/Bogota").getFullYear();
const pad = (n: number) => String(n).padStart(5, "0");

async function nextCode(
  db: DbExecutor,
  seq: "ticket_code_seq" | "task_code_seq",
  prefix: string,
  at: Date,
) {
  const res = await db.execute<{ n: string }>(sql`select nextval(${seq}) as n`);
  const row =
    (res as unknown as { rows: { n: string }[] }).rows?.[0] ??
    (res as unknown as { n: string }[])[0];
  if (!row) throw new Error("No se pudo obtener el consecutivo");
  return `${prefix}-${bogotaYear(at)}-${pad(Number(row.n))}`;
}

const ALL_TABLES = [
  "audit_log",
  "notifications",
  "email_outbox",
  "attachments",
  "task_evidence",
  "tasks",
  "ticket_messages",
  "tickets",
  "team_members",
  "teams",
  "sla_policies",
  "ticket_types",
  "app_settings",
  "verification",
  "account",
  "session",
  '"user"',
];

export async function resetDatabase(db: Database): Promise<void> {
  await db.execute(sql.raw(`truncate table ${ALL_TABLES.join(", ")} restart identity cascade`));
  await db.execute(sql`alter sequence ticket_code_seq restart with 1`);
  await db.execute(sql`alter sequence task_code_seq restart with 1`);
}

/** Catálogos idempotentes: no pisa lo que el docente ya haya editado. */
async function seedCatalog(db: DbExecutor, actorId: string | null) {
  await db
    .insert(s.ticketTypes)
    .values(
      TICKET_TYPES.map((t, i) => ({
        slug: t.slug,
        name: t.name,
        description: t.description,
        icon: t.icon,
        color: t.color,
        defaultPriority: t.defaultPriority,
        fields: t.fields,
        sortOrder: i + 1,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    )
    .onConflictDoNothing({ target: s.ticketTypes.slug });

  await db
    .insert(s.slaPolicies)
    .values(
      SLA_POLICIES.map((p) => ({
        priority: p.priority,
        firstResponseMinutes: p.firstResponse,
        resolutionMinutes: p.resolution,
        businessHours: DEFAULT_BUSINESS_HOURS,
        createdBy: actorId,
        updatedBy: actorId,
      })),
    )
    .onConflictDoNothing({ target: s.slaPolicies.priority });

  await db
    .insert(s.appSettings)
    .values(allDefaultSettings().map((x) => ({ key: x.key, value: x.value, updatedBy: actorId })))
    .onConflictDoNothing({ target: s.appSettings.key });
}

async function createUser(
  db: DbExecutor,
  data: {
    email: string;
    name: string;
    role: Role;
    status: "pendiente" | "activo";
    passwordHash: string;
    codigoUis?: string;
    programa?: string;
    telefono?: string;
    createdAt: Date;
    consentVersion: string;
  },
): Promise<string> {
  const id = newId();
  await db.insert(s.user).values({
    id,
    name: data.name,
    email: data.email,
    emailVerified: true,
    role: data.role,
    status: data.status,
    codigoUis: data.codigoUis,
    programa: data.programa,
    telefono: data.telefono,
    dataConsentAt: data.createdAt,
    dataConsentVersion: data.consentVersion,
    approvedAt: data.status === "activo" ? data.createdAt : null,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
  });
  await db.insert(s.account).values({
    accountId: id,
    providerId: "credential",
    userId: id,
    password: data.passwordHash,
    createdAt: data.createdAt,
    updatedAt: data.createdAt,
  });
  return id;
}

export async function seedDatabase(db: Database, opts: SeedOptions): Promise<SeedSummary> {
  const log = opts.log ?? (() => {});
  const now = opts.now ?? new Date();

  if (opts.reset) {
    log("Vaciando tablas…");
    await resetDatabase(db);
  }

  const adminEmail = opts.admin.email.trim().toLowerCase();
  const existingAdmin = await db
    .select({ id: s.user.id })
    .from(s.user)
    .where(eq(s.user.email, adminEmail))
    .limit(1);

  let adminId = existingAdmin[0]?.id;
  if (!adminId) {
    log(`Creando administrador ${adminEmail}…`);
    adminId = await createUser(db, {
      email: adminEmail,
      name: opts.admin.name ?? "Administrador ExperTIC",
      role: "admin",
      status: "activo",
      passwordHash: await opts.hashPassword(opts.admin.password),
      createdAt: now,
      consentVersion: "2026-11-v1-provisional",
    });
  } else {
    log("El administrador ya existe; se conserva.");
  }

  log("Sembrando catálogos (categorías, SLA, ajustes)…");
  await seedCatalog(db, adminId);

  if (!opts.demo) {
    return { admin: 1, ticketTypes: TICKET_TYPES.length, slaPolicies: SLA_POLICIES.length };
  }

  const [{ count: userCount } = { count: 0 }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(s.user);
  if (userCount > 1) {
    throw new Error(
      "La base ya tiene usuarios de demostración. Usa `pnpm db:seed --reset` para empezar de cero.",
    );
  }

  return seedDemo(db, { now, adminId, hashPassword: opts.hashPassword, log });
}

async function seedDemo(
  db: Database,
  ctx: {
    now: Date;
    adminId: string;
    hashPassword: (p: string) => Promise<string>;
    log: (m: string) => void;
  },
): Promise<SeedSummary> {
  const { now, adminId, log } = ctx;
  const r = rng(20262);
  const summary: SeedSummary = {};
  const calendar: BusinessCalendar = defaultCalendar([
    bogotaYear(now) - 1,
    bogotaYear(now),
    bogotaYear(now) + 1,
  ]);

  // ── Usuarios ──
  log("Creando usuarios de demostración…");
  const hash = await ctx.hashPassword(DEMO_PASSWORD);
  const ids: Record<string, string> = {};
  const roles: Record<string, Role> = {};
  const accountsCreatedAt = new Date(now.getTime() - 120 * DAY);
  for (const u of DEMO_USERS) {
    ids[u.key] = await createUser(db, {
      email: `${u.key}@${DEMO_EMAIL_DOMAIN}`,
      name: u.name,
      role: u.role,
      status: u.status === "pendiente" ? "pendiente" : "activo",
      passwordHash: hash,
      codigoUis: u.codigoUis,
      programa: u.programa,
      telefono: u.telefono,
      createdAt: u.status === "pendiente" ? new Date(now.getTime() - 2 * DAY) : accountsCreatedAt,
      consentVersion: "2026-11-v1-provisional",
    });
    roles[u.key] = u.role;
  }
  const id = (key: string) => {
    const v = ids[key];
    if (!v) throw new Error(`Usuario demo desconocido: ${key}`);
    return v;
  };
  const docenteId = id("docente");
  summary.users = DEMO_USERS.length + 1;

  // ── Equipos (semestre actual + historial del anterior) ──
  log("Creando equipos…");
  const teamOf: Record<string, string> = {};
  const semesterStart = new Date(now.getTime() - 90 * DAY);
  for (const t of DEMO_TEAMS) {
    const teamId = newId();
    await db.insert(s.teams).values({
      id: teamId,
      name: t.name,
      liderId: id(t.lider),
      semester: CURRENT_SEMESTER,
      createdBy: docenteId,
      updatedBy: docenteId,
    });
    await db
      .insert(s.teamMembers)
      .values(
        [t.lider, ...t.members].map((m) => ({ teamId, userId: id(m), since: semesterStart })),
      );
    for (const m of t.members) {
      await db
        .update(s.user)
        .set({ liderId: id(t.lider) })
        .where(eq(s.user.id, id(m)));
    }
    for (const m of [t.lider, ...t.members]) teamOf[m] = teamId;
  }
  // Historial: equipo del semestre anterior, ya cerrado.
  const oldTeamId = newId();
  await db.insert(s.teams).values({
    id: oldTeamId,
    name: "Equipo Plataforma Moodle",
    liderId: id("lider1"),
    semester: PREVIOUS_SEMESTER,
    active: false,
    createdBy: docenteId,
    updatedBy: docenteId,
  });
  await db.insert(s.teamMembers).values([
    {
      teamId: oldTeamId,
      userId: id("lider1"),
      since: new Date(now.getTime() - 270 * DAY),
      until: semesterStart,
    },
    {
      teamId: oldTeamId,
      userId: id("aux1"),
      since: new Date(now.getTime() - 270 * DAY),
      until: semesterStart,
    },
  ]);
  summary.teams = DEMO_TEAMS.length + 1;

  // ── Catálogo cargado ──
  const types = await db.select().from(s.ticketTypes);
  const policies = await db.select().from(s.slaPolicies);
  const policyOf = (p: Priority) => {
    const pol = policies.find((x) => x.priority === p);
    if (!pol) throw new Error(`Falta política SLA ${p}`);
    return pol;
  };

  const staff = ["lider1", "lider2", "aux1", "aux2", "aux3", "aux4", "aux5", "aux6"];
  const requesters = DEMO_USERS.filter(
    (u) => (u.role === "profesor" || u.role === "estudiante") && u.status !== "pendiente",
  ).map((u) => u.key);

  const audits: (typeof s.auditLog.$inferInsert)[] = [];
  const notificationsRows: (typeof s.notifications.$inferInsert)[] = [];
  const audit = (
    at: Date,
    actorKey: string | null,
    action: string,
    entityType: string,
    entityId: string,
    before: unknown,
    after: unknown,
  ) =>
    audits.push({
      occurredAt: at,
      actorId: actorKey ? id(actorKey) : adminId,
      actorRole: actorKey ? roles[actorKey] : "admin",
      action,
      entityType,
      entityId,
      before: before ?? null,
      after: after ?? null,
      ip: "127.0.0.1",
      userAgent: "seed",
      requestId: "seed",
    });

  // ── Tickets (40) ──
  log("Creando tickets…");
  const statusPlan: TicketStatus[] = [
    ...Array<TicketStatus>(8).fill("abierto"),
    ...Array<TicketStatus>(7).fill("asignado"),
    ...Array<TicketStatus>(8).fill("en_progreso"),
    ...Array<TicketStatus>(6).fill("respondido"),
    ...Array<TicketStatus>(9).fill("cerrado"),
    ...Array<TicketStatus>(2).fill("reabierto"),
  ];
  const pathTo: Record<TicketStatus, TicketStatus[]> = {
    abierto: [],
    asignado: ["asignado"],
    en_progreso: ["asignado", "en_progreso"],
    respondido: ["asignado", "en_progreso", "respondido"],
    cerrado: ["asignado", "en_progreso", "respondido", "cerrado"],
    reabierto: ["asignado", "en_progreso", "respondido", "cerrado", "reabierto"],
  };
  const createdTickets: {
    id: string;
    code: string;
    status: TicketStatus;
    assignee?: string;
    title: string;
  }[] = [];

  for (const [i, status] of statusPlan.entries()) {
    const type = types[i % types.length];
    if (!type) throw new Error("Sin tipos de ticket");
    const sample = r.pick(TICKET_SAMPLES[type.slug] ?? TICKET_SAMPLES["otra-solicitud"] ?? []);
    const requester = r.pick(requesters);
    const priority: Priority =
      r.next() < 0.6 ? type.defaultPriority : r.pick(["baja", "media", "alta"] as const);
    // Abiertos: recientes; cerrados: más antiguos.
    const ageDays =
      status === "abierto" ? r.int(0, 3) : status === "cerrado" ? r.int(8, 40) : r.int(1, 12);
    const createdAt = new Date(now.getTime() - ageDays * DAY - r.int(1, 8) * HOUR);
    const pol = policyOf(priority);
    const slaFirstResponseDue = addBusinessMinutes(createdAt, pol.firstResponseMinutes, calendar);
    const slaResolutionDue = addBusinessMinutes(createdAt, pol.resolutionMinutes, calendar);
    const assignee = status === "abierto" ? undefined : r.pick(staff);
    const code = await nextCode(db, "ticket_code_seq", "EXP", createdAt);
    const ticketId = newId();

    // Línea de tiempo: pasos repartidos entre la creación y "ahora".
    const steps = pathTo[status];
    const span = Math.max(now.getTime() - createdAt.getTime(), HOUR);
    const stepTimes = steps.map(
      (_, k) => new Date(createdAt.getTime() + ((k + 1) * span) / (steps.length + 1.5)),
    );
    const at = (st: TicketStatus) => {
      const k = steps.lastIndexOf(st);
      return k >= 0 ? stepTimes[k] : undefined;
    };
    const firstResponseAt =
      at("respondido") ??
      (status === "en_progreso" && r.next() < 0.5 ? at("en_progreso") : undefined);
    const resolvedAt = at("cerrado");
    const closedAt = status === "cerrado" ? at("cerrado") : undefined;
    const lastActivityAt = stepTimes[stepTimes.length - 1] ?? createdAt;
    const values = buildValues(type.slug, r, now);
    const rated = status === "cerrado" && r.next() < 0.7;

    await db.insert(s.tickets).values({
      id: ticketId,
      code,
      typeId: type.id,
      requesterId: id(requester),
      assigneeId: assignee ? id(assignee) : null,
      teamId: assignee ? (teamOf[assignee] ?? null) : null,
      priority,
      status,
      title: sample.title,
      description: sample.description,
      values,
      firstResponseAt,
      resolvedAt,
      closedAt,
      lastActivityAt,
      slaFirstResponseDue,
      slaResolutionDue,
      rating: rated ? r.int(3, 5) : null,
      ratingComment: rated
        ? r.pick(["Muy buena atención.", "Rápido y claro.", "Resolvieron todo, gracias."])
        : null,
      createdAt,
      updatedAt: lastActivityAt,
      createdBy: id(requester),
      updatedBy: assignee ? id(assignee) : id(requester),
    });

    audit(createdAt, requester, "ticket.created", "ticket", ticketId, null, {
      code,
      status: "abierto",
      priority,
      title: sample.title,
    });
    let prev: TicketStatus = "abierto";
    steps.forEach((st, k) => {
      const t = stepTimes[k] ?? createdAt;
      if (st === "asignado") {
        audit(
          t,
          "docente",
          "ticket.assigned",
          "ticket",
          ticketId,
          { assigneeId: null },
          { assigneeId: assignee ? id(assignee) : null },
        );
      }
      const actor =
        st === "cerrado" || st === "reabierto"
          ? requester
          : st === "asignado"
            ? "docente"
            : (assignee ?? "docente");
      audit(
        t,
        actor,
        "ticket.status_changed",
        "ticket",
        ticketId,
        { status: prev },
        { status: st },
      );
      prev = st;
    });

    // Hilo de mensajes
    const respondedAt = at("respondido");
    if (respondedAt && assignee) {
      if (r.next() < 0.5) {
        await db.insert(s.ticketMessages).values({
          ticketId,
          authorId: id(assignee),
          body: r.pick(INTERNAL_NOTES),
          isInternal: true,
          createdAt: new Date(respondedAt.getTime() - 20 * MINUTE),
        });
      }
      await db.insert(s.ticketMessages).values({
        ticketId,
        authorId: id(assignee),
        body: r.pick(STAFF_REPLIES),
        createdAt: respondedAt,
      });
      const closed = at("cerrado");
      if (closed) {
        await db.insert(s.ticketMessages).values({
          ticketId,
          authorId: id(requester),
          body: r.pick(REQUESTER_FOLLOWUPS),
          createdAt: new Date(closed.getTime() - 5 * MINUTE),
        });
      }
    }

    if (now.getTime() - createdAt.getTime() < 3 * DAY) {
      notificationsRows.push({
        userId: docenteId,
        type: "ticket.created",
        title: `Nuevo ticket ${code}`,
        body: sample.title,
        href: `/panel/tickets?code=${code}`,
        createdAt,
      });
    }
    createdTickets.push({ id: ticketId, code, status, assignee, title: sample.title });
  }
  summary.tickets = createdTickets.length;

  // ── Tareas (60) con los tres colores del semáforo ──
  log("Creando tareas…");
  type TaskPlan = {
    kind: "a_tiempo" | "tarde" | "verde" | "ambar" | "rojo" | "cancelada" | "sin_fecha";
    n: number;
  };
  const taskPlan: TaskPlan[] = [
    { kind: "a_tiempo", n: 18 },
    { kind: "tarde", n: 6 },
    { kind: "verde", n: 14 },
    { kind: "ambar", n: 8 },
    { kind: "rojo", n: 9 },
    { kind: "cancelada", n: 3 },
    { kind: "sin_fecha", n: 2 },
  ];
  const linkable = createdTickets.filter(
    (t) => t.status === "en_progreso" || t.status === "asignado",
  );
  let taskCount = 0;
  let evidenceCount = 0;

  for (const plan of taskPlan) {
    for (let k = 0; k < plan.n; k++) {
      const assignee = staff[taskCount % staff.length] ?? "aux1";
      const isLeader = roles[assignee] === "lider";
      const leaderOfAssignee = DEMO_TEAMS.find((t) =>
        (t.members as readonly string[]).includes(assignee),
      )?.lider;
      const assigner =
        !isLeader && leaderOfAssignee && r.next() < 0.3 ? leaderOfAssignee : "docente";
      const course = r.pick(COURSES);
      const title = r.pick(TASK_SAMPLES).replace("{curso}", course);
      const priority = r.pick(["baja", "media", "media", "alta"] as const);

      let status: TaskStatus = "pendiente";
      let dueAt: Date | null = null;
      let createdAt = new Date(now.getTime() - r.int(2, 20) * DAY);
      let startedAt: Date | null = null;
      let completedAt: Date | null = null;
      let cancelledAt: Date | null = null;

      switch (plan.kind) {
        case "a_tiempo":
          dueAt = new Date(now.getTime() - r.int(1, 45) * DAY);
          createdAt = new Date(dueAt.getTime() - r.int(3, 10) * DAY);
          startedAt = new Date(createdAt.getTime() + r.int(2, 24) * HOUR);
          completedAt = new Date(dueAt.getTime() - r.int(2, 48) * HOUR);
          status = "completada";
          break;
        case "tarde":
          dueAt = new Date(now.getTime() - r.int(3, 40) * DAY);
          createdAt = new Date(dueAt.getTime() - r.int(3, 10) * DAY);
          startedAt = new Date(createdAt.getTime() + r.int(2, 48) * HOUR);
          completedAt = new Date(dueAt.getTime() + r.int(3, 60) * HOUR);
          status = "completada";
          break;
        case "verde":
          dueAt = new Date(now.getTime() + r.int(2, 14) * DAY);
          createdAt = new Date(now.getTime() - r.int(1, 5) * DAY);
          status = r.next() < 0.5 ? "en_progreso" : "pendiente";
          break;
        case "ambar":
          dueAt = new Date(now.getTime() + r.int(2, 20) * HOUR);
          createdAt = new Date(now.getTime() - r.int(2, 6) * DAY);
          status = r.next() < 0.6 ? "en_progreso" : "pendiente";
          break;
        case "rojo":
          dueAt = new Date(now.getTime() - r.int(3, 120) * HOUR);
          createdAt = new Date(dueAt.getTime() - r.int(3, 8) * DAY);
          status = r.next() < 0.5 ? "en_progreso" : "pendiente";
          break;
        case "cancelada":
          dueAt = new Date(now.getTime() + r.int(-10, 10) * DAY);
          createdAt = new Date(now.getTime() - r.int(12, 20) * DAY);
          cancelledAt = new Date(createdAt.getTime() + r.int(1, 3) * DAY);
          status = "cancelada";
          break;
        case "sin_fecha":
          status = "pendiente";
          break;
      }
      if (status === "en_progreso" && !startedAt) {
        startedAt = new Date(createdAt.getTime() + r.int(1, 24) * HOUR);
      }

      const taskId = newId();
      const code = await nextCode(db, "task_code_seq", "TAR", createdAt);
      const ticket =
        plan.kind === "verde" || plan.kind === "ambar"
          ? linkable[k % Math.max(linkable.length, 1)]
          : undefined;
      const lastChange = completedAt ?? cancelledAt ?? startedAt ?? createdAt;

      await db.insert(s.tasks).values({
        id: taskId,
        code,
        title,
        description: `Tarea del semestre ${CURRENT_SEMESTER}. Curso: ${course}.`,
        assignedBy: id(assigner),
        assigneeId: id(assignee),
        teamId: teamOf[assignee] ?? null,
        ticketId: ticket?.id ?? null,
        priority,
        status,
        dueAt,
        startedAt,
        completedAt,
        cancelledAt,
        requiresEvidence: r.next() < 0.85,
        createdAt,
        updatedAt: lastChange,
        createdBy: id(assigner),
        updatedBy: status === "cancelada" ? id(assigner) : id(assignee),
      });

      audit(createdAt, assigner, "task.created", "task", taskId, null, {
        code,
        assigneeId: id(assignee),
        dueAt,
        priority,
      });
      if (startedAt)
        audit(
          startedAt,
          assignee,
          "task.status_changed",
          "task",
          taskId,
          { status: "pendiente" },
          { status: "en_progreso" },
        );
      if (completedAt) {
        await db.insert(s.taskEvidence).values({
          taskId,
          authorId: id(assignee),
          note: r.pick(EVIDENCE_NOTES),
          createdAt: new Date(completedAt.getTime() - 10 * MINUTE),
        });
        evidenceCount++;
        audit(
          completedAt,
          assignee,
          "task.completed",
          "task",
          taskId,
          { status: "en_progreso" },
          { status: "completada" },
        );
      }
      if (cancelledAt)
        audit(
          cancelledAt,
          assigner,
          "task.cancelled",
          "task",
          taskId,
          { status: "pendiente" },
          { status: "cancelada" },
        );

      if (status === "pendiente" || status === "en_progreso") {
        notificationsRows.push({
          userId: id(assignee),
          type: "task.assigned",
          title: `Nueva tarea ${code}`,
          body: title,
          href: `/tareas/${code}`,
          createdAt,
          readAt: plan.kind === "verde" ? null : createdAt,
        });
      }
      taskCount++;
    }
  }
  summary.tasks = taskCount;
  summary.taskEvidence = evidenceCount;

  // Inserción por lotes de auditoría y notificaciones.
  for (let i = 0; i < audits.length; i += 200)
    await db.insert(s.auditLog).values(audits.slice(i, i + 200));
  for (let i = 0; i < notificationsRows.length; i += 200) {
    await db.insert(s.notifications).values(notificationsRows.slice(i, i + 200));
  }
  summary.auditLog = audits.length;
  summary.notifications = notificationsRows.length;
  return summary;
}

function buildValues(slug: string, r: ReturnType<typeof rng>, now: Date): Record<string, unknown> {
  const curso = r.pick(COURSES);
  switch (slug) {
    case "errores-moodle":
      return {
        curso,
        enlace: "https://sea.uis.edu.co/course/view.php?id=" + r.int(1000, 9999),
        navegador: r.pick(["Chrome", "Edge", "Firefox", "Aplicación móvil de Moodle"]),
        pasos: "Ingresé al curso, abrí la actividad y apareció el error.",
      };
    case "lecciones-sin-informacion":
      return {
        curso,
        leccion: `Semana ${r.int(1, 16)}`,
        faltante: r.pick([["Video"], ["Lectura o PDF", "Enlace roto"], ["Actividad o quiz"]]),
      };
    case "preguntas-reclamos":
      return { tipo: r.pick(["Pregunta", "Reclamo", "Sugerencia", "Felicitación"]), curso };
    case "solicitud-sistemas":
      return {
        tipo_solicitud: r.pick([
          "Creación de curso",
          "Matrícula masiva",
          "Respaldo o restauración de curso",
        ]),
        curso,
        fecha_requerida: new Date(now.getTime() + r.int(2, 10) * DAY).toISOString(),
      };
    case "acceso-matricula":
      return {
        plataforma: "Moodle",
        problema: r.pick([
          "No puedo iniciar sesión",
          "No veo mi curso",
          "Estoy en el grupo equivocado",
        ]),
        curso,
        codigo: String(r.int(2200000, 2249999)),
      };
    default:
      return {};
  }
}
