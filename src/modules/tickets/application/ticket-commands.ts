import { and, eq, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { buildTicketForm, compactValues } from "@/modules/templates/domain/ticket-form-factory";
import { Directory } from "@/modules/users/infrastructure/directory";
import { can, canReadTicket, type Actor } from "@/shared/auth/permissions";
import { getSetting, getSettings } from "@/shared/config/settings-service";
import { slaPolicies, tickets, ticketTypes } from "@/shared/db/schema";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";
import { PRIORITIES } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";
import { DomainError, forbidden, notFound, validationError } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import { appEvent, type NotificationIntent, type UseCaseContext } from "@/shared/kernel/app-event";
import { createEvent } from "@/shared/kernel/event-bus";
import type { Container } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";
import { storeUploads, type AttachmentRow, type IncomingFile } from "@/shared/storage/uploads";
import { computeSlaDues, type SlaPolicy } from "../domain/sla";
import type { TicketRecord } from "../domain/ticket-repository";
import {
  TICKET_STATUS_LABEL,
  timestampsFor,
  transition,
  type TicketActorKind,
} from "../domain/ticket-state";
import { DrizzleTicketRepository } from "../infrastructure/drizzle-ticket-repository";

type Deps = Pick<Container, "db" | "events" | "email" | "logger" | "clock" | "ids" | "storage">;

const PRIORITY_LABEL: Record<Priority, string> = { baja: "baja", media: "media", alta: "alta" };
const href = (code: string) => `/solicitudes/${code}`;
const resourceOf = (t: TicketRecord) => ({
  requesterId: t.requesterId,
  assigneeId: t.assigneeId,
  teamId: t.teamId,
});

/** ¿Actúa sobre este ticket como personal de soporte o como solicitante? */
export function actorKindOn(actor: Actor, t: TicketRecord): TicketActorKind | null {
  const r = resourceOf(t);
  const staff =
    can(actor, "ticket.read.all", r) ||
    can(actor, "ticket.read.assigned", r) ||
    can(actor, "ticket.read.team", r);
  if (staff && (actor.role !== "auxiliar" || t.assigneeId === actor.id)) return "staff";
  if (t.requesterId === actor.id) return "requester";
  return staff ? "staff" : null;
}

async function loadPolicy(db: DbExecutor, priority: Priority): Promise<SlaPolicy> {
  const [p] = await db
    .select()
    .from(slaPolicies)
    .where(eq(slaPolicies.priority, priority))
    .limit(1);
  if (!p)
    throw new DomainError("UNEXPECTED", "No hay política de SLA configurada para esa prioridad.");
  return p;
}

// ─────────────────────────────── Crear ───────────────────────────────

export const createTicketInput = z.object({
  typeId: z.uuid("Elige una categoría."),
  title: z
    .string()
    .trim()
    .min(5, "Escribe un título de al menos 5 caracteres.")
    .max(140, "Máximo 140 caracteres."),
  description: z
    .string()
    .trim()
    .min(10, "Cuéntanos un poco más (al menos 10 caracteres).")
    .max(5000),
  priority: z.enum(PRIORITIES).optional(),
  values: z.record(z.string(), z.unknown()).default({}),
});
export type CreateTicketInput = z.infer<typeof createTicketInput>;

export async function createTicket(
  c: Deps,
  ctx: UseCaseContext,
  input: CreateTicketInput,
  files: Record<string, IncomingFile[]> = {},
): Promise<Result<{ id: string; code: string }, DomainError>> {
  if (!can(ctx.actor, "ticket.create")) return err(forbidden());

  const [type] = await c.db
    .select()
    .from(ticketTypes)
    .where(
      and(
        eq(ticketTypes.id, input.typeId),
        eq(ticketTypes.active, true),
        isNull(ticketTypes.deletedAt),
      ),
    )
    .limit(1);
  if (!type) return err(notFound("esa categoría"));

  // Misma validación que el formulario del navegador (TicketFormFactory).
  const form = buildTicketForm(type.fields, () => ctx.now);
  const parsed = form.valuesSchema.safeParse(input.values);
  if (!parsed.success) {
    const fieldErrors: Record<string, string[]> = {};
    for (const i of parsed.error.issues)
      (fieldErrors[`values.${i.path.join(".")}`] ??= []).push(i.message);
    return err(validationError("Revisa los campos marcados.", fieldErrors));
  }
  for (const rule of form.fileRules) {
    if (rule.required && !(files[rule.key]?.length ?? 0))
      return err(validationError(`${rule.label}: adjunta al menos un archivo.`));
  }

  const priority: Priority = input.priority ?? type.defaultPriority;
  const policy = await loadPolicy(c.db, priority);
  const extra = await getSetting(c.db, "sla.extraHolidays");
  const dues = computeSlaDues(ctx.now, policy, extra);
  const id = c.ids.next();

  // Archivos: se validan todos y se guardan antes de la transacción.
  const stored: AttachmentRow[] = [];
  for (const rule of form.fileRules) {
    const r = await storeUploads(
      { db: c.db, storage: c.storage, ids: c.ids },
      files[rule.key] ?? [],
      {
        ownerType: "ticket",
        ownerId: id,
        uploadedBy: ctx.actor.id,
        now: ctx.now,
        accept: rule.accept,
        maxFiles: rule.maxFiles,
        label: rule.label,
      },
    );
    if (!r.ok) return r;
    stored.push(...r.value);
  }

  const code = await unitOfWork(c, async (tx, emit) => {
    const repo = new DrizzleTicketRepository(tx);
    const code = await repo.nextCode(ctx.now);
    await repo.insert({
      id,
      code,
      typeId: type.id,
      requesterId: ctx.actor.id,
      priority,
      status: "abierto",
      title: input.title,
      description: input.description,
      values: compactValues(parsed.data),
      requiredAt:
        typeof parsed.data.fecha_requerida === "string"
          ? new Date(parsed.data.fecha_requerida)
          : null,
      lastActivityAt: ctx.now,
      ...dues,
      createdAt: ctx.now,
      updatedAt: ctx.now,
      createdBy: ctx.actor.id,
      updatedBy: ctx.actor.id,
    });
    await repo.addAttachments(stored);

    const docentes = await new Directory(tx).activeIdsByRole(["docente"]);
    emit(
      appEvent(
        "ticket.created",
        ctx,
        { type: "ticket", id },
        {
          after: {
            code,
            type: type.name,
            priority,
            title: input.title,
            attachments: stored.length,
          },
          notify: docentes.map((userId) => ({
            userId,
            type: "ticket.created",
            title: `Nueva solicitud ${code}`,
            body: `${type.name}: ${input.title}`,
            href: href(code),
            email: true,
          })),
        },
      ),
    );
    return code;
  });

  return ok({ id, code });
}

// ─────────────────────────────── Responder ───────────────────────────────

export const replyTicketInput = z.object({
  ticketId: z.uuid(),
  body: z.string().trim().min(1, "Escribe un mensaje.").max(5000, "Máximo 5000 caracteres."),
  internal: z.boolean().default(false),
});

export async function replyTicket(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof replyTicketInput>,
  files: IncomingFile[] = [],
): Promise<Result<{ messageId: string; status: TicketStatus }, DomainError>> {
  const repo = new DrizzleTicketRepository(c.db);
  const t = await repo.byId(input.ticketId);
  if (!t || !canReadTicket(ctx.actor, resourceOf(t))) return err(notFound("esa solicitud"));
  const kind = actorKindOn(ctx.actor, t);
  if (!can(ctx.actor, "ticket.reply", resourceOf(t)) || !kind)
    return err(forbidden("No puedes responder esta solicitud."));
  if (input.internal && !can(ctx.actor, "ticket.internal_note", resourceOf(t))) {
    return err(forbidden("Solo el equipo de soporte puede dejar notas internas."));
  }
  if (t.status === "cerrado")
    return err(validationError("La solicitud está cerrada. Reábrela para responder."));

  const messageId = c.ids.next();
  const up = await storeUploads({ db: c.db, storage: c.storage, ids: c.ids }, files, {
    ownerType: "message",
    ownerId: messageId,
    uploadedBy: ctx.actor.id,
    now: ctx.now,
    maxFiles: 5,
  });
  if (!up.ok) return up;

  const status = await unitOfWork(c, async (tx, emit) => {
    const r = new DrizzleTicketRepository(tx);
    const fresh = (await r.byIdForUpdate(t.id)) ?? t;
    await r.addMessage({
      id: messageId,
      ticketId: t.id,
      authorId: ctx.actor.id,
      body: input.body,
      isInternal: input.internal,
      createdAt: ctx.now,
    });
    await r.addAttachments(up.value);

    // Efectos sobre el estado: el solicitante responde → vuelve a "en progreso".
    let next: TicketStatus = fresh.status;
    const patch: Partial<TicketRecord> = {
      lastActivityAt: ctx.now,
      updatedAt: ctx.now,
      updatedBy: ctx.actor.id,
    };
    if (!input.internal && kind === "requester" && fresh.status === "respondido")
      next = "en_progreso";
    if (!input.internal && kind === "staff" && !fresh.firstResponseAt)
      patch.firstResponseAt = ctx.now;
    if (next !== fresh.status) patch.status = next;
    await r.update(t.id, patch);

    const notify: NotificationIntent[] = [];
    if (input.internal) {
      const lead = await new Directory(tx).teamLeader(fresh.teamId);
      for (const userId of [fresh.assigneeId, lead].filter((x): x is string => !!x)) {
        notify.push({
          userId,
          type: "ticket.internal_note",
          title: `Nota interna en ${fresh.code}`,
          body: input.body.slice(0, 140),
          href: href(fresh.code),
        });
      }
    } else if (kind === "staff") {
      notify.push({
        userId: fresh.requesterId,
        type: "ticket.replied",
        title: `Respondieron tu solicitud ${fresh.code}`,
        body: input.body.slice(0, 160),
        href: href(fresh.code),
        email: true,
      });
    } else {
      const targets = fresh.assigneeId
        ? [fresh.assigneeId]
        : await new Directory(tx).activeIdsByRole(["docente"]);
      for (const userId of targets) {
        notify.push({
          userId,
          type: "ticket.replied",
          title: `Nuevo mensaje en ${fresh.code}`,
          body: input.body.slice(0, 160),
          href: href(fresh.code),
          email: true,
        });
      }
    }
    emit(
      appEvent(
        input.internal ? "ticket.internal_note_added" : "ticket.replied",
        ctx,
        { type: "ticket", id: t.id },
        {
          before: next !== fresh.status ? { status: fresh.status } : null,
          after: {
            messageId,
            internal: input.internal,
            attachments: up.value.length,
            ...(next !== fresh.status ? { status: next } : {}),
          },
          notify,
        },
      ),
    );
    return next;
  });

  return ok({ messageId, status });
}

// ─────────────────────────────── Cambiar estado ───────────────────────────────

export const changeStatusInput = z.object({
  ticketId: z.uuid(),
  to: z.enum(["abierto", "asignado", "en_progreso", "respondido", "cerrado", "reabierto"]),
});

export async function changeTicketStatus(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof changeStatusInput>,
): Promise<Result<{ status: TicketStatus }, DomainError>> {
  const t = await new DrizzleTicketRepository(c.db).byId(input.ticketId);
  if (!t || !canReadTicket(ctx.actor, resourceOf(t))) return err(notFound("esa solicitud"));
  const kind = actorKindOn(ctx.actor, t);
  if (!kind || !can(ctx.actor, "ticket.status", resourceOf(t))) return err(forbidden());

  const reopenWindowDays = await getSetting(c.db, "tickets.reopenWindowDays");
  const result = transition({
    from: t.status,
    to: input.to,
    by: kind,
    now: ctx.now,
    closedAt: t.closedAt,
    reopenWindowDays,
  });
  if (!result.ok) return result;
  if (input.to === "asignado" && !t.assigneeId)
    return err(validationError("Primero asigna la solicitud a alguien."));

  await unitOfWork(c, async (tx, emit) => {
    const r = new DrizzleTicketRepository(tx);
    const fresh = (await r.byIdForUpdate(t.id)) ?? t;
    if (fresh.status !== t.status)
      throw new DomainError(
        "CONFLICT",
        "Alguien cambió esta solicitud mientras tanto. Recarga la página.",
      );
    const stamps = timestampsFor(input.to, fresh, ctx.now);
    await r.update(t.id, {
      status: input.to,
      ...stamps,
      // Reabrir vuelve a "asignado" lógico si ya tenía responsable (5.3: reabierto → asignado).
      lastActivityAt: ctx.now,
      updatedAt: ctx.now,
      updatedBy: ctx.actor.id,
    });
    const notify: NotificationIntent[] = [];
    const msg = `Ahora está "${TICKET_STATUS_LABEL[input.to]}".`;
    if (kind === "staff") {
      notify.push({
        userId: fresh.requesterId,
        type: "ticket.status_changed",
        title: `Tu solicitud ${fresh.code} cambió`,
        body: msg,
        href: href(fresh.code),
        email: input.to === "respondido" || input.to === "cerrado",
      });
    } else if (fresh.assigneeId) {
      notify.push({
        userId: fresh.assigneeId,
        type: "ticket.status_changed",
        title: `${fresh.code}: ${TICKET_STATUS_LABEL[input.to].toLowerCase()} por el solicitante`,
        body: msg,
        href: href(fresh.code),
        email: input.to === "reabierto",
      });
    }
    emit(
      appEvent(
        "ticket.status_changed",
        ctx,
        { type: "ticket", id: t.id },
        { before: { status: fresh.status }, after: { status: input.to }, notify },
      ),
    );
  });

  return ok({ status: input.to });
}

// ─────────────────────────────── Asignar ───────────────────────────────

export const assignTicketInput = z.object({ ticketId: z.uuid(), assigneeId: z.uuid().nullable() });

export async function assignTicket(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof assignTicketInput>,
): Promise<Result<{ assigneeId: string | null; status: TicketStatus }, DomainError>> {
  const t = await new DrizzleTicketRepository(c.db).byId(input.ticketId);
  if (!t) return err(notFound("esa solicitud"));
  const dir = new Directory(c.db);

  let teamId: string | null = null;
  if (input.assigneeId) {
    const target = await dir.basic(input.assigneeId);
    if (
      !target ||
      target.status !== "activo" ||
      !["auxiliar", "lider", "docente", "admin"].includes(target.role)
    ) {
      return err(validationError("Esa persona no puede atender solicitudes."));
    }
    teamId = await dir.activeTeamOf(input.assigneeId);
    // El líder solo asigna dentro de su equipo (tanto el ticket como la persona).
    if (ctx.actor.role === "lider" && (!teamId || !ctx.actor.leadTeamIds.includes(teamId))) {
      return err(forbidden("Solo puedes asignar a personas de tu equipo."));
    }
  }
  const resource = {
    ...resourceOf(t),
    teamId: ctx.actor.role === "lider" ? (t.teamId ?? teamId) : t.teamId,
  };
  if (!can(ctx.actor, "ticket.assign", resource))
    return err(forbidden("No puedes asignar esta solicitud."));
  if (t.status === "cerrado") return err(validationError("La solicitud está cerrada."));

  const nextStatus: TicketStatus =
    input.assigneeId && (t.status === "abierto" || t.status === "reabierto")
      ? "asignado"
      : !input.assigneeId && t.status === "asignado"
        ? "abierto"
        : t.status;

  await unitOfWork(c, async (tx, emit) => {
    const r = new DrizzleTicketRepository(tx);
    await r.byIdForUpdate(t.id);
    await r.update(t.id, {
      assigneeId: input.assigneeId,
      teamId,
      status: nextStatus,
      lastActivityAt: ctx.now,
      updatedAt: ctx.now,
      updatedBy: ctx.actor.id,
    });
    const notify: NotificationIntent[] = [];
    if (input.assigneeId) {
      notify.push({
        userId: input.assigneeId,
        type: "ticket.assigned",
        title: `Te asignaron ${t.code}`,
        body: t.title,
        href: href(t.code),
        email: true,
      });
      notify.push({
        userId: t.requesterId,
        type: "ticket.assigned",
        title: `Tu solicitud ${t.code} ya tiene responsable`,
        body: "Alguien del equipo la está atendiendo.",
        href: href(t.code),
      });
    }
    emit(
      appEvent(
        "ticket.assigned",
        ctx,
        { type: "ticket", id: t.id },
        {
          before: { assigneeId: t.assigneeId, status: t.status },
          after: { assigneeId: input.assigneeId, status: nextStatus, teamId },
          notify,
        },
      ),
    );
  });
  return ok({ assigneeId: input.assigneeId, status: nextStatus });
}

// ─────────────────────────────── Prioridad (D-006) ───────────────────────────────

export const changePriorityInput = z.object({ ticketId: z.uuid(), priority: z.enum(PRIORITIES) });

export async function changeTicketPriority(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof changePriorityInput>,
): Promise<Result<{ priority: Priority }, DomainError>> {
  const t = await new DrizzleTicketRepository(c.db).byId(input.ticketId);
  if (!t) return err(notFound("esa solicitud"));
  if (!can(ctx.actor, "ticket.priority", resourceOf(t)))
    return err(forbidden("Solo el docente o el líder del equipo cambian la prioridad."));
  if (t.priority === input.priority) return ok({ priority: t.priority });

  // Se recalculan los vencimientos desde la creación con la nueva política.
  const policy = await loadPolicy(c.db, input.priority);
  const extra = await getSetting(c.db, "sla.extraHolidays");
  const dues = computeSlaDues(t.createdAt, policy, extra);

  await unitOfWork(c, async (tx, emit) => {
    await new DrizzleTicketRepository(tx).update(t.id, {
      priority: input.priority,
      ...dues,
      updatedAt: ctx.now,
      updatedBy: ctx.actor.id,
    });
    emit(
      appEvent(
        "ticket.priority_changed",
        ctx,
        { type: "ticket", id: t.id },
        {
          before: { priority: t.priority, slaResolutionDue: t.slaResolutionDue },
          after: { priority: input.priority, slaResolutionDue: dues.slaResolutionDue },
          notify: t.assigneeId
            ? [
                {
                  userId: t.assigneeId,
                  type: "ticket.priority_changed",
                  title: `${t.code} ahora es prioridad ${PRIORITY_LABEL[input.priority]}`,
                  body: t.title,
                  href: href(t.code),
                },
              ]
            : [],
        },
      ),
    );
  });
  return ok({ priority: input.priority });
}

// ─────────────────────────────── Calificar ───────────────────────────────

export const rateTicketInput = z.object({
  ticketId: z.uuid(),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5),
  comment: z.string().trim().max(500).optional(),
});

export async function rateTicket(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof rateTicketInput>,
): Promise<Result<{ rating: number }, DomainError>> {
  const t = await new DrizzleTicketRepository(c.db).byId(input.ticketId);
  if (!t || !can(ctx.actor, "ticket.rate", resourceOf(t))) return err(notFound("esa solicitud"));
  if (t.status !== "cerrado")
    return err(validationError("Puedes calificar la atención cuando la solicitud esté cerrada."));
  await unitOfWork(c, async (tx, emit) => {
    await new DrizzleTicketRepository(tx).update(t.id, {
      rating: input.rating,
      ratingComment: input.comment || null,
      updatedAt: ctx.now,
      updatedBy: ctx.actor.id,
    });
    emit(
      appEvent(
        "ticket.rated",
        ctx,
        { type: "ticket", id: t.id },
        {
          before: { rating: t.rating },
          after: { rating: input.rating },
          notify: t.assigneeId
            ? [
                {
                  userId: t.assigneeId,
                  type: "ticket.rated",
                  title: `Calificaron ${t.code} con ${input.rating}/5`,
                  body: input.comment ?? t.title,
                  href: href(t.code),
                },
              ]
            : [],
        },
      ),
    );
  });
  return ok({ rating: input.rating });
}

// ─────────────────────────────── Autocierre (cron) ───────────────────────────────

/** Cierra los tickets "respondidos" sin actividad durante N días (sección 5.3). */
export async function autoCloseTickets(c: Deps, now: Date): Promise<number> {
  const { "tickets.autoCloseDays": days } = await getSettings(c.db, ["tickets.autoCloseDays"]);
  const limit = new Date(now.getTime() - days * 86_400_000);
  const stale = await c.db
    .select()
    .from(tickets)
    .where(
      and(
        eq(tickets.status, "respondido"),
        lt(tickets.lastActivityAt, limit),
        isNull(tickets.deletedAt),
      ),
    )
    .limit(100);
  const meta = { ip: null, userAgent: "cron", requestId: "cron" };
  for (const t of stale) {
    await unitOfWork(c, async (tx, emit) => {
      await new DrizzleTicketRepository(tx).update(t.id, {
        status: "cerrado",
        ...timestampsFor("cerrado", t, now),
        updatedAt: now,
      });
      // Actor nulo: lo hace el sistema, no una persona.
      emit(
        createEvent(
          "ticket.auto_closed",
          {
            actor: null,
            meta,
            entity: { type: "ticket", id: t.id },
            before: { status: "respondido" },
            after: { status: "cerrado", reason: `Sin actividad durante ${days} días` },
            notify: [
              {
                userId: t.requesterId,
                type: "ticket.auto_closed",
                title: `Cerramos tu solicitud ${t.code}`,
                body: `No tuvo actividad en ${days} días. Si aún lo necesitas, puedes reabrirla.`,
                href: href(t.code),
              },
            ],
          },
          now,
        ),
      );
    });
  }
  return stale.length;
}
