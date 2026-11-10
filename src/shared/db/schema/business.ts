import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgSequence,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
// Rutas relativas a propósito: drizzle-kit carga este archivo fuera de Next.
import { newId } from "../../kernel/id";
import type { TemplateField } from "../../../modules/templates/domain/template-field";
import { user } from "./auth";
import {
  attachmentOwnerEnum,
  outboxStatusEnum,
  priorityEnum,
  taskStatusEnum,
  ticketStatusEnum,
} from "./enums";

const ts = (name: string) => timestamp(name, { withTimezone: true });
const pk = () => uuid("id").primaryKey().$defaultFn(newId);

/** Columnas de trazabilidad + soft delete de las tablas de negocio. */
const tracking = () => ({
  createdAt: ts("created_at").notNull().defaultNow(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  createdBy: uuid("created_by").references(() => user.id, { onDelete: "set null" }),
  updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
  deletedAt: ts("deleted_at"),
});

// ── Secuencias para códigos legibles (EXP-2026-00042, TAR-2026-00007) ──
export const ticketCodeSeq = pgSequence("ticket_code_seq", { startWith: 1, increment: 1 });
export const taskCodeSeq = pgSequence("task_code_seq", { startWith: 1, increment: 1 });

// ── Equipos ──
export const teams = pgTable(
  "teams",
  {
    id: pk(),
    name: text("name").notNull(),
    liderId: uuid("lider_id").references(() => user.id, { onDelete: "set null" }),
    semester: text("semester").notNull(),
    active: boolean("active").notNull().default(true),
    ...tracking(),
  },
  (t) => [
    index("teams_semester_idx").on(t.semester, t.active),
    check("teams_semester_format", sql`${t.semester} ~ '^[0-9]{4}-[12]$'`),
  ],
);

export const teamMembers = pgTable(
  "team_members",
  {
    id: pk(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    since: ts("since").notNull().defaultNow(),
    until: ts("until"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("team_members_team_idx").on(t.teamId),
    index("team_members_user_idx").on(t.userId),
    // Una sola membresía vigente por persona y equipo; el historial queda con `until`.
    uniqueIndex("team_members_active_uq")
      .on(t.teamId, t.userId)
      .where(sql`${t.until} is null`),
  ],
);

// ── Tipos de ticket (motor de plantillas) ──
export const ticketTypes = pgTable(
  "ticket_types",
  {
    id: pk(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("circle-help"),
    color: text("color").notNull().default("#1673BB"),
    fields: jsonb("fields").$type<TemplateField[]>().notNull().default([]),
    defaultPriority: priorityEnum("default_priority").notNull().default("media"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    ...tracking(),
  },
  (t) => [index("ticket_types_active_order_idx").on(t.active, t.sortOrder)],
);

// ── Políticas de SLA ──
export type BusinessHours = {
  timezone: string;
  /** 1 = lunes … 7 = domingo (ISO). */
  days: number[];
  start: string; // "07:00"
  end: string; // "18:00"
};

export const slaPolicies = pgTable("sla_policies", {
  id: pk(),
  priority: priorityEnum("priority").notNull().unique(),
  firstResponseMinutes: integer("first_response_minutes").notNull(),
  resolutionMinutes: integer("resolution_minutes").notNull(),
  businessHours: jsonb("business_hours").$type<BusinessHours>().notNull(),
  ...tracking(),
});

// ── Tickets ──
export const tickets = pgTable(
  "tickets",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    typeId: uuid("type_id")
      .notNull()
      .references(() => ticketTypes.id),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => user.id),
    assigneeId: uuid("assignee_id").references(() => user.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    priority: priorityEnum("priority").notNull(),
    status: ticketStatusEnum("status").notNull().default("abierto"),
    title: text("title").notNull(),
    description: text("description").notNull(),
    requiredAt: ts("required_at"),
    values: jsonb("values").$type<Record<string, unknown>>().notNull().default({}),
    firstResponseAt: ts("first_response_at"),
    resolvedAt: ts("resolved_at"),
    closedAt: ts("closed_at"),
    lastActivityAt: ts("last_activity_at").notNull().defaultNow(),
    slaFirstResponseDue: ts("sla_first_response_due").notNull(),
    slaResolutionDue: ts("sla_resolution_due").notNull(),
    rating: smallint("rating"),
    ratingComment: text("rating_comment"),
    ...tracking(),
  },
  (t) => [
    index("tickets_status_priority_idx").on(t.status, t.priority),
    index("tickets_requester_idx").on(t.requesterId),
    index("tickets_assignee_status_idx").on(t.assigneeId, t.status),
    index("tickets_team_idx").on(t.teamId),
    index("tickets_created_idx").on(t.createdAt.desc()),
    check("tickets_rating_range", sql`${t.rating} is null or ${t.rating} between 1 and 5`),
  ],
);

export const ticketMessages = pgTable(
  "ticket_messages",
  {
    id: pk(),
    ticketId: uuid("ticket_id")
      .notNull()
      .references(() => tickets.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id),
    body: text("body").notNull(),
    /** Nota interna: el solicitante no la ve. */
    isInternal: boolean("is_internal").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [index("ticket_messages_ticket_idx").on(t.ticketId, t.createdAt)],
);

// ── Tareas (módulo separado de tickets, D-004) ──
export const tasks = pgTable(
  "tasks",
  {
    id: pk(),
    code: text("code").notNull().unique(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => user.id),
    assigneeId: uuid("assignee_id").references(() => user.id, { onDelete: "set null" }),
    teamId: uuid("team_id").references(() => teams.id, { onDelete: "set null" }),
    /** Vínculo opcional con un ticket. */
    ticketId: uuid("ticket_id").references(() => tickets.id, { onDelete: "set null" }),
    priority: priorityEnum("priority").notNull().default("media"),
    status: taskStatusEnum("status").notNull().default("pendiente"),
    dueAt: ts("due_at"),
    startedAt: ts("started_at"),
    completedAt: ts("completed_at"),
    cancelledAt: ts("cancelled_at"),
    requiresEvidence: boolean("requires_evidence").notNull().default(true),
    ...tracking(),
  },
  (t) => [
    index("tasks_assignee_status_due_idx").on(t.assigneeId, t.status, t.dueAt),
    index("tasks_team_idx").on(t.teamId),
    index("tasks_ticket_idx").on(t.ticketId),
  ],
);

export const taskEvidence = pgTable(
  "task_evidence",
  {
    id: pk(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => user.id),
    note: text("note"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("task_evidence_task_idx").on(t.taskId)],
);

// ── Adjuntos (los bytes viven en el StorageProvider, nunca en la BD) ──
export const attachments = pgTable(
  "attachments",
  {
    id: pk(),
    ownerType: attachmentOwnerEnum("owner_type").notNull(),
    ownerId: uuid("owner_id").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    storageKey: text("storage_key").notNull().unique(),
    uploadedBy: uuid("uploaded_by")
      .notNull()
      .references(() => user.id),
    createdAt: ts("created_at").notNull().defaultNow(),
    deletedAt: ts("deleted_at"),
  },
  (t) => [
    index("attachments_owner_idx").on(t.ownerType, t.ownerId),
    check("attachments_size_positive", sql`${t.sizeBytes} > 0`),
  ],
);

// ── Auditoría: SOLO inserción (un trigger bloquea UPDATE y DELETE) ──
export const auditLog = pgTable(
  "audit_log",
  {
    id: pk(),
    occurredAt: ts("occurred_at").notNull().defaultNow(),
    /** Sin FK a propósito: la auditoría sobrevive aunque cambie el usuario. */
    actorId: uuid("actor_id"),
    actorRole: text("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    requestId: text("request_id"),
  },
  (t) => [
    index("audit_log_entity_idx").on(t.entityType, t.entityId, t.occurredAt.desc()),
    index("audit_log_actor_idx").on(t.actorId, t.occurredAt.desc()),
    index("audit_log_action_idx").on(t.action, t.occurredAt.desc()),
  ],
);

// ── Notificaciones en la app ──
export const notifications = pgTable(
  "notifications",
  {
    id: pk(),
    userId: uuid("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href"),
    readAt: ts("read_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("notifications_user_read_idx").on(t.userId, t.readAt)],
);

// ── Bandeja de salida de correo (reintentos, D-013) ──
export const emailOutbox = pgTable(
  "email_outbox",
  {
    id: pk(),
    to: text("to").notNull(),
    subject: text("subject").notNull(),
    html: text("html").notNull(),
    text: text("text").notNull(),
    status: outboxStatusEnum("status").notNull().default("pendiente"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    nextAttemptAt: ts("next_attempt_at").notNull().defaultNow(),
    sentAt: ts("sent_at"),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("email_outbox_pending_idx").on(t.status, t.nextAttemptAt)],
);

// ── Ajustes de la aplicación ──
export const appSettings = pgTable("app_settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: ts("updated_at")
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
  updatedBy: uuid("updated_by").references(() => user.id, { onDelete: "set null" }),
});
