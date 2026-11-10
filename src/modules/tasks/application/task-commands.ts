import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { Directory } from "@/modules/users/infrastructure/directory";
import { can } from "@/shared/auth/permissions";
import {
  attachments,
  notifications,
  taskEvidence,
  tasks,
  teamMembers,
  teams,
  tickets,
  user,
} from "@/shared/db/schema";
import type { TaskStatus } from "@/shared/db/schema/enums";
import { PRIORITIES } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";
import { DomainError, forbidden, notFound, validationError } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import { appEvent, type NotificationIntent, type UseCaseContext } from "@/shared/kernel/app-event";
import type { Container } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";
import { formatDateTime } from "@/shared/lib/dates";
import { storeUploads, type IncomingFile } from "@/shared/storage/uploads";
import {
  TASK_STATUS_LABEL,
  taskTimestamps,
  taskTransition,
  type TaskActorKind,
} from "../domain/task-state";

type Deps = Pick<Container, "db" | "events" | "email" | "logger" | "clock" | "ids" | "storage">;
type TaskRecord = typeof tasks.$inferSelect;

const href = (code: string) => `/tareas/${code}`;
const bogotaYear = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", year: "numeric" }).format(d),
  );

async function nextTaskCode(db: DbExecutor, at: Date) {
  const res = await db.execute<{ n: string }>(sql`select nextval('task_code_seq') as n`);
  const rows =
    (res as unknown as { rows?: { n: string }[] }).rows ?? (res as unknown as { n: string }[]);
  return `TAR-${bogotaYear(at)}-${String(Number(rows[0]?.n)).padStart(5, "0")}`;
}

async function loadTask(db: DbExecutor, id: string, forUpdate = false): Promise<TaskRecord | null> {
  const q = db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), isNull(tasks.deletedAt)))
    .limit(1);
  const [row] = forUpdate ? await q.for("update") : await q;
  return row ?? null;
}

/** ¿Qué papel tiene el actor frente a la tarea? (puede tener ambos) */
function kindsOn(ctx: UseCaseContext, t: TaskRecord): TaskActorKind[] {
  const kinds: TaskActorKind[] = [];
  if (t.assigneeId === ctx.actor.id || ctx.actor.role === "admin") kinds.push("assignee");
  if (can(ctx.actor, "task.cancel", { assignedById: t.assignedBy })) kinds.push("assigner");
  return kinds;
}

async function evidenceCount(db: DbExecutor, taskId: string) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(taskEvidence)
    .where(eq(taskEvidence.taskId, taskId));
  return r?.n ?? 0;
}

// ─────────────────────────────── Crear / asignar (HU-42, HU-31) ───────────────────────────────

export const createTaskInput = z
  .object({
    title: z.string().trim().min(4, "Escribe un título de al menos 4 caracteres.").max(140),
    description: z.string().trim().max(4000).default(""),
    assigneeId: z.uuid().nullable().default(null),
    teamId: z.uuid().nullable().default(null),
    dueAt: z.coerce.date({ error: "Elige la fecha límite." }),
    priority: z.enum(PRIORITIES).default("media"),
    ticketId: z.uuid().nullable().default(null),
    requiresEvidence: z.boolean().default(true),
  })
  .refine((v) => v.assigneeId || v.teamId, {
    message: "Elige una persona o un equipo.",
    path: ["assigneeId"],
  });

export async function createTask(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof createTaskInput>,
): Promise<Result<{ codes: string[] }, DomainError>> {
  if (input.dueAt.getTime() < ctx.now.getTime() - 60_000)
    return err(validationError("La fecha límite ya pasó.", { dueAt: ["Elige una fecha futura."] }));
  const dir = new Directory(c.db);

  // Destinatarios: una persona, o cada integrante vigente del equipo.
  let targets: { id: string; teamId: string | null }[] = [];
  if (input.assigneeId) {
    const u = await dir.basic(input.assigneeId);
    if (!u || u.status !== "activo" || !["auxiliar", "lider"].includes(u.role))
      return err(validationError("Las tareas se asignan a auxiliares o líderes activos."));
    targets = [{ id: u.id, teamId: await dir.activeTeamOf(u.id) }];
  } else if (input.teamId) {
    const members = await c.db
      .select({ id: teamMembers.userId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .innerJoin(user, eq(user.id, teamMembers.userId))
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          isNull(teamMembers.until),
          eq(teams.active, true),
          eq(user.status, "activo"),
        ),
      );
    if (!members.length) return err(validationError("Ese equipo no tiene integrantes activos."));
    targets = members.map((m) => ({ id: m.id, teamId: input.teamId }));
  }
  for (const t of targets) {
    if (!can(ctx.actor, "task.create", { targetTeamId: t.teamId }))
      return err(forbidden("Solo puedes asignar tareas a personas de tu equipo."));
  }
  if (input.ticketId) {
    const [tk] = await c.db
      .select({ id: tickets.id })
      .from(tickets)
      .where(eq(tickets.id, input.ticketId))
      .limit(1);
    if (!tk) return err(notFound("el ticket vinculado"));
  }

  const codes = await unitOfWork(c, async (tx, emit) => {
    const out: string[] = [];
    for (const target of targets) {
      const id = c.ids.next();
      const code = await nextTaskCode(tx, ctx.now);
      await tx.insert(tasks).values({
        id,
        code,
        title: input.title,
        description: input.description,
        assignedBy: ctx.actor.id,
        assigneeId: target.id,
        teamId: target.teamId,
        ticketId: input.ticketId,
        priority: input.priority,
        status: "pendiente",
        dueAt: input.dueAt,
        requiresEvidence: input.requiresEvidence,
        createdAt: ctx.now,
        updatedAt: ctx.now,
        createdBy: ctx.actor.id,
        updatedBy: ctx.actor.id,
      });
      emit(
        appEvent(
          "task.created",
          ctx,
          { type: "task", id },
          {
            after: {
              code,
              title: input.title,
              assigneeId: target.id,
              dueAt: input.dueAt,
              priority: input.priority,
            },
            notify: [
              {
                userId: target.id,
                type: "task.assigned",
                title: `Nueva tarea ${code}`,
                body: `${input.title}. Vence el ${formatDateTime(input.dueAt)}.`,
                href: href(code),
                email: true,
              },
            ],
          },
        ),
      );
      out.push(code);
    }
    return out;
  });
  return ok({ codes });
}

// ─────────────────────────────── Estado (Kanban, HU-20/21) ───────────────────────────────

export const changeTaskStatusInput = z.object({
  taskId: z.uuid(),
  to: z.enum(["pendiente", "en_progreso", "completada", "cancelada"]),
  reason: z.string().trim().max(300).optional(),
});

export async function changeTaskStatus(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof changeTaskStatusInput>,
): Promise<Result<{ status: TaskStatus }, DomainError>> {
  const t = await loadTask(c.db, input.taskId);
  if (!t) return err(notFound("esa tarea"));
  const kinds = kindsOn(ctx, t);
  if (!kinds.length) return err(forbidden("No puedes cambiar esta tarea."));
  if (
    kinds.includes("assignee") &&
    !kinds.includes("assigner") &&
    !can(ctx.actor, "task.update.own", { assigneeId: t.assigneeId })
  )
    return err(forbidden());

  const evidence = input.to === "completada" ? await evidenceCount(c.db, t.id) : 0;
  const r = taskTransition({
    from: t.status,
    to: input.to,
    by: kinds,
    requiresEvidence: t.requiresEvidence,
    evidenceCount: evidence,
  });
  if (!r.ok) return r;

  await unitOfWork(c, async (tx, emit) => {
    const fresh = (await loadTask(tx, t.id, true)) ?? t;
    if (fresh.status !== t.status)
      throw new DomainError("CONFLICT", "La tarea cambió mientras tanto. Recarga la página.");
    const stamps = taskTimestamps(input.to, fresh, ctx.now);
    await tx
      .update(tasks)
      .set({ status: input.to, ...stamps, updatedAt: ctx.now, updatedBy: ctx.actor.id })
      .where(eq(tasks.id, t.id));

    const notify: NotificationIntent[] = [];
    const label = TASK_STATUS_LABEL[input.to].toLowerCase();
    if (input.to === "completada" || input.to === "en_progreso") {
      if (fresh.assignedBy !== ctx.actor.id)
        notify.push({
          userId: fresh.assignedBy,
          type: `task.${input.to}`,
          title: `${fresh.code} está ${label}`,
          body: fresh.title,
          href: href(fresh.code),
        });
    } else if (input.to === "cancelada" && fresh.assigneeId) {
      notify.push({
        userId: fresh.assigneeId,
        type: "task.cancelled",
        title: `Se canceló la tarea ${fresh.code}`,
        body: input.reason || fresh.title,
        href: href(fresh.code),
      });
    }
    const action =
      input.to === "completada"
        ? "task.completed"
        : input.to === "cancelada"
          ? "task.cancelled"
          : "task.status_changed";
    emit(
      appEvent(
        action,
        ctx,
        { type: "task", id: t.id },
        {
          before: { status: fresh.status },
          after: { status: input.to, ...(input.reason ? { reason: input.reason } : {}) },
          notify,
        },
      ),
    );
  });
  return ok({ status: input.to });
}

// ─────────────────────────────── Evidencia ───────────────────────────────

export const addEvidenceInput = z.object({
  taskId: z.uuid(),
  note: z.string().trim().max(2000).optional(),
  complete: z.boolean().default(false),
});

/** Agrega evidencia (nota y/o archivos) y, si se pide, completa la tarea en la misma operación. */
export async function addEvidence(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof addEvidenceInput>,
  files: IncomingFile[] = [],
): Promise<Result<{ evidenceId: string; status: TaskStatus }, DomainError>> {
  const t = await loadTask(c.db, input.taskId);
  if (!t) return err(notFound("esa tarea"));
  if (!can(ctx.actor, "task.update.own", { assigneeId: t.assigneeId }))
    return err(forbidden("Solo quien tiene la tarea puede agregar evidencia."));
  if (!input.note && !files.length)
    return err(
      validationError("Escribe una nota o adjunta al menos un archivo.", {
        note: ["Agrega una nota o un archivo."],
      }),
    );
  if (t.status === "cancelada") return err(validationError("La tarea está cancelada."));

  if (input.complete) {
    const pre = taskTransition({
      from: t.status,
      to: "completada",
      by: ["assignee"],
      requiresEvidence: t.requiresEvidence,
      evidenceCount: 1,
    });
    if (!pre.ok) return pre;
  }

  const evidenceId = c.ids.next();
  const up = await storeUploads({ db: c.db, storage: c.storage, ids: c.ids }, files, {
    ownerType: "evidence",
    ownerId: evidenceId,
    uploadedBy: ctx.actor.id,
    now: ctx.now,
    maxFiles: 5,
  });
  if (!up.ok) return up;

  const status = await unitOfWork(c, async (tx, emit) => {
    const fresh = (await loadTask(tx, t.id, true)) ?? t;
    await tx
      .insert(taskEvidence)
      .values({
        id: evidenceId,
        taskId: t.id,
        authorId: ctx.actor.id,
        note: input.note || null,
        createdAt: ctx.now,
      });
    if (up.value.length) await tx.insert(attachments).values(up.value);
    emit(
      appEvent(
        "task.evidence_added",
        ctx,
        { type: "task", id: t.id },
        { after: { evidenceId, note: !!input.note, files: up.value.length } },
      ),
    );
    let next = fresh.status;
    if (input.complete && fresh.status !== "completada") {
      next = "completada";
      await tx
        .update(tasks)
        .set({
          status: next,
          ...taskTimestamps(next, fresh, ctx.now),
          updatedAt: ctx.now,
          updatedBy: ctx.actor.id,
        })
        .where(eq(tasks.id, t.id));
      emit(
        appEvent(
          "task.completed",
          ctx,
          { type: "task", id: t.id },
          {
            before: { status: fresh.status },
            after: { status: next, onTime: !fresh.dueAt || ctx.now <= fresh.dueAt },
            notify:
              fresh.assignedBy !== ctx.actor.id
                ? [
                    {
                      userId: fresh.assignedBy,
                      type: "task.completed",
                      title: `${fresh.code} está completada`,
                      body: fresh.title,
                      href: href(fresh.code),
                    },
                  ]
                : [],
          },
        ),
      );
    }
    return next;
  });
  return ok({ evidenceId, status });
}

// ─────────────────────────────── Reasignar (HU-31) ───────────────────────────────

export const reassignTaskInput = z.object({ taskId: z.uuid(), assigneeId: z.uuid() });

export async function reassignTask(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof reassignTaskInput>,
): Promise<Result<{ assigneeId: string }, DomainError>> {
  const t = await loadTask(c.db, input.taskId);
  if (!t) return err(notFound("esa tarea"));
  if (t.status === "completada" || t.status === "cancelada")
    return err(validationError("Solo se reasignan tareas abiertas."));
  const dir = new Directory(c.db);
  const target = await dir.basic(input.assigneeId);
  if (!target || target.status !== "activo" || !["auxiliar", "lider"].includes(target.role))
    return err(validationError("Las tareas se asignan a auxiliares o líderes activos."));
  const teamId = await dir.activeTeamOf(target.id);
  if (
    !can(ctx.actor, "task.assign", { targetTeamId: teamId }) ||
    (ctx.actor.role === "lider" && !can(ctx.actor, "task.assign", { targetTeamId: t.teamId }))
  ) {
    return err(forbidden("Solo puedes reasignar dentro de tu equipo."));
  }
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(tasks)
      .set({ assigneeId: target.id, teamId, updatedAt: ctx.now, updatedBy: ctx.actor.id })
      .where(eq(tasks.id, t.id));
    const notify: NotificationIntent[] = [
      {
        userId: target.id,
        type: "task.assigned",
        title: `Te reasignaron ${t.code}`,
        body: t.title,
        href: href(t.code),
        email: true,
      },
    ];
    if (t.assigneeId)
      notify.push({
        userId: t.assigneeId,
        type: "task.reassigned",
        title: `${t.code} pasó a ${target.name}`,
        body: t.title,
        href: href(t.code),
      });
    emit(
      appEvent(
        "task.reassigned",
        ctx,
        { type: "task", id: t.id },
        { before: { assigneeId: t.assigneeId }, after: { assigneeId: target.id }, notify },
      ),
    );
  });
  return ok({ assigneeId: target.id });
}

// ─────────────────────────────── Recordatorios (cron) ───────────────────────────────

/** Avisa de tareas que vencen en las próximas `hours` horas (una vez por tarea). */
export async function remindDueTasks(c: Deps, now: Date, hours = 24): Promise<number> {
  const until = new Date(now.getTime() + hours * 3_600_000);
  const rows = await c.db.execute<{
    id: string;
    code: string;
    title: string;
    assignee_id: string;
    due_at: string;
  }>(sql`
    select t.id, t.code, t.title, t.assignee_id, t.due_at from tasks t
    where t.status in ('pendiente','en_progreso') and t.deleted_at is null and t.assignee_id is not null
      and t.due_at > ${now} and t.due_at <= ${until}
      and not exists (select 1 from notifications n where n.type = 'task.due_soon' and n.href = '/tareas/' || t.code)
    limit 200`);
  const list = (rows as unknown as { rows?: unknown[] }).rows ?? (rows as unknown as unknown[]);
  const items = list as {
    id: string;
    code: string;
    title: string;
    assignee_id: string;
    due_at: string;
  }[];
  if (!items.length) return 0;
  await unitOfWork(c, async (tx) => {
    await tx.insert(notifications).values(
      items.map((t) => ({
        userId: t.assignee_id,
        type: "task.due_soon",
        title: `${t.code} vence pronto`,
        body: `${t.title}. Vence el ${formatDateTime(new Date(t.due_at))}.`,
        href: href(t.code),
        createdAt: now,
      })),
    );
  });
  return items.length;
}
