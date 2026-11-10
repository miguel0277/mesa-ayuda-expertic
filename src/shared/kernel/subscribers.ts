import { inArray } from "drizzle-orm";
import { DrizzleAuditRepository } from "@/modules/audit/infrastructure/drizzle-audit-repository";
import { notifications, user } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import { enqueueEmail } from "@/shared/email/outbox";
import { emails } from "@/shared/email/templates";
import type { AppEvent } from "./app-event";
import type { EventBus } from "./event-bus";

type Deps = { events: EventBus<DbExecutor>; appUrl?: string };

/** Auditoría total: cada evento de aplicación deja una fila en audit_log (en la misma transacción). */
export async function auditSubscriber(event: AppEvent, tx: DbExecutor) {
  const p = event.payload;
  await new DrizzleAuditRepository(tx).append({
    occurredAt: event.occurredAt,
    actorId: p.actor?.id ?? null,
    actorRole: p.actor?.role ?? null,
    action: event.type,
    entityType: p.entity.type,
    entityId: p.entity.id,
    before: p.before ?? null,
    after: p.after ?? null,
    ip: p.meta.ip,
    userAgent: p.meta.userAgent,
    requestId: p.meta.requestId,
  });
}

/**
 * Notificaciones: aviso en la app para cada destinatario (nunca al propio actor) y, si se pide,
 * correo encolado en la bandeja de salida (se envía después de confirmar la transacción).
 */
export async function notificationSubscriber(event: AppEvent, tx: DbExecutor, appUrl: string) {
  const intents = (event.payload.notify ?? []).filter((n) => n.userId !== event.payload.actor?.id);
  // Un aviso por persona y evento.
  const unique = [...new Map(intents.map((n) => [n.userId, n])).values()];
  if (!unique.length) return;

  await tx.insert(notifications).values(
    unique.map((n) => ({
      userId: n.userId,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      createdAt: event.occurredAt,
    })),
  );

  const emailTargets = unique.filter((n) => n.email);
  if (!emailTargets.length) return;
  const recipients = await tx
    .select({ id: user.id, email: user.email, status: user.status })
    .from(user)
    .where(
      inArray(
        user.id,
        emailTargets.map((n) => n.userId),
      ),
    );
  for (const n of emailTargets) {
    const r = recipients.find((x) => x.id === n.userId);
    if (!r || r.status !== "activo") continue;
    await enqueueEmail(
      tx,
      emails.notice(r.email, n.title, n.title, n.body, new URL(n.href, appUrl).toString()),
      event.occurredAt,
    );
  }
}

/** Registra los suscriptores en el bus (se llama una vez desde el Composition Root). */
export function registerSubscribers({ events, appUrl }: Deps) {
  const url = appUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  events.subscribe<AppEvent>("*", (e, { tx }) => auditSubscriber(e, tx), {
    critical: true,
    name: "auditoria",
  });
  events.subscribe<AppEvent>("*", (e, { tx }) => notificationSubscriber(e, tx, url), {
    critical: true,
    name: "notificaciones",
  });
}
