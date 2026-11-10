import { pgEnum } from "drizzle-orm/pg-core";
// Ruta relativa a propósito: drizzle-kit carga este archivo fuera de Next.
import { ROLES } from "../../auth/roles";

export { ROLES };
export type { Role } from "../../auth/roles";

export const USER_STATUSES = ["pendiente", "activo", "inactivo", "bloqueado"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PRIORITIES = ["baja", "media", "alta"] as const;
export type Priority = (typeof PRIORITIES)[number];

export const TICKET_STATUSES = [
  "abierto",
  "asignado",
  "en_progreso",
  "respondido",
  "cerrado",
  "reabierto",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export const TASK_STATUSES = ["pendiente", "en_progreso", "completada", "cancelada"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ATTACHMENT_OWNERS = ["ticket", "message", "task", "evidence"] as const;
export type AttachmentOwner = (typeof ATTACHMENT_OWNERS)[number];

export const OUTBOX_STATUSES = ["pendiente", "enviado", "fallido"] as const;
export type OutboxStatus = (typeof OUTBOX_STATUSES)[number];

export const roleEnum = pgEnum("user_role", ROLES);
export const userStatusEnum = pgEnum("user_status", USER_STATUSES);
export const priorityEnum = pgEnum("priority", PRIORITIES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const taskStatusEnum = pgEnum("task_status", TASK_STATUSES);
export const attachmentOwnerEnum = pgEnum("attachment_owner", ATTACHMENT_OWNERS);
export const outboxStatusEnum = pgEnum("outbox_status", OUTBOX_STATUSES);
