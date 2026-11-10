import type { RequestMeta } from "@/modules/audit/domain/audit-entry";
import type { Actor } from "@/shared/auth/permissions";
import { createEvent, type DomainEvent } from "./event-bus";

/**
 * Evento de aplicación: lo publica un caso de uso al cambiar estado.
 * - El AuditSubscriber lo convierte en una fila de audit_log (action = type).
 * - El NotificationSubscriber crea las notificaciones y correos indicados en `notify`.
 * Así la trazabilidad queda desacoplada de la lógica de negocio (patrón Observer).
 */
export type EntityType =
  "ticket" | "task" | "user" | "team" | "ticket_type" | "sla_policy" | "setting" | "attachment";

export type NotificationIntent = {
  userId: string;
  type: string;
  title: string;
  body: string;
  href: string;
  /** Además del aviso en la app, enviar correo. */
  email?: boolean;
};

export type AppEventPayload = {
  actor: Pick<Actor, "id" | "role"> | null;
  meta: RequestMeta;
  entity: { type: EntityType; id: string };
  before?: unknown;
  after?: unknown;
  notify?: NotificationIntent[];
};

export type AppEvent = DomainEvent<string, AppEventPayload>;

export type UseCaseContext = {
  actor: Actor;
  meta: RequestMeta;
  now: Date;
};

export function appEvent(
  type: string,
  ctx: UseCaseContext,
  entity: AppEventPayload["entity"],
  data: Omit<AppEventPayload, "actor" | "meta" | "entity"> = {},
): AppEvent {
  return createEvent(
    type,
    { actor: { id: ctx.actor.id, role: ctx.actor.role }, meta: ctx.meta, entity, ...data },
    ctx.now,
  );
}
