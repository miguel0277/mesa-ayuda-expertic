import { and, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import { outer } from "@/shared/db/sql";
import { connection, NextResponse, type NextRequest } from "next/server";
import { remindDueTasks } from "@/modules/tasks/application/task-commands";
import { autoCloseTickets } from "@/modules/tickets/application/ticket-commands";
import { getEnv } from "@/env";
import { notifications, tickets, user } from "@/shared/db/schema";
import { processOutbox } from "@/shared/email/outbox";
import { createEvent } from "@/shared/kernel/event-bus";
import { getContainer } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";
import { logger } from "@/shared/lib/logger";

/**
 * GET /api/cron/sla (Vercel Cron, protegido con CRON_SECRET):
 * 1. Avisa de tickets a punto de vencer su SLA (una vez por ticket).
 * 2. Recuerda tareas que vencen en las próximas 24 h.
 * 3. Cierra tickets "respondidos" sin actividad.
 * 4. Reintenta correos pendientes de la bandeja de salida.
 */
export async function GET(request: NextRequest) {
  await connection();
  const secret = getEnv().CRON_SECRET;
  const auth = request.headers.get("authorization");
  if (!secret || auth !== `Bearer ${secret}`)
    return new NextResponse("No autorizado", { status: 401 });

  const c = getContainer();
  const now = new Date();
  const soon = new Date(now.getTime() + 2 * 3_600_000);

  // 1. Tickets cuyo plazo de solución vence en ≤ 2 h y aún no se han avisado.
  const atRisk = await c.db
    .select({
      id: tickets.id,
      code: tickets.code,
      title: tickets.title,
      assigneeId: tickets.assigneeId,
    })
    .from(tickets)
    .where(
      and(
        isNull(tickets.deletedAt),
        inArray(tickets.status, ["abierto", "asignado", "en_progreso", "reabierto"]),
        gt(tickets.slaResolutionDue, now),
        lte(tickets.slaResolutionDue, soon),
        sql`not exists (select 1 from ${notifications} n where n.type = 'ticket.sla_risk' and n.href = '/solicitudes/' || ${outer(tickets.code)})`,
      ),
    )
    .limit(100);
  const docentes = atRisk.some((t) => !t.assigneeId)
    ? (
        await c.db
          .select({ id: user.id })
          .from(user)
          .where(and(eq(user.role, "docente"), eq(user.status, "activo")))
      ).map((u) => u.id)
    : [];
  for (const t of atRisk) {
    await unitOfWork(c, async (_tx, emit) =>
      emit(
        createEvent(
          "ticket.sla_risk",
          {
            actor: null,
            meta: { ip: null, userAgent: "cron", requestId: "cron" },
            entity: { type: "ticket" as const, id: t.id },
            after: { code: t.code },
            notify: (t.assigneeId ? [t.assigneeId] : docentes).map((userId) => ({
              userId,
              type: "ticket.sla_risk",
              title: `${t.code} está por vencer`,
              body: `${t.title}. Le quedan menos de 2 horas hábiles.`,
              href: `/solicitudes/${t.code}`,
              email: true,
            })),
          },
          now,
        ),
      ),
    );
  }

  const reminded = await remindDueTasks(c, now);
  const closed = await autoCloseTickets(c, now);
  const mailed = await processOutbox(c.db, c.email, now);

  const summary = {
    slaAlerts: atRisk.length,
    taskReminders: reminded,
    autoClosed: closed,
    emailsProcessed: mailed,
  };
  await unitOfWork(c, async (_tx, emit) =>
    emit(
      createEvent(
        "system.cron_ran",
        {
          actor: null,
          meta: { ip: null, userAgent: "cron", requestId: "cron" },
          entity: { type: "setting" as const, id: "cron" },
          after: summary,
        },
        now,
      ),
    ),
  );
  logger.info({ ...summary }, "cron ejecutado");
  return NextResponse.json({ ok: true, ...summary });
}
