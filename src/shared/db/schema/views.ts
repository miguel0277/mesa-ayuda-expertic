import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  integer,
  numeric,
  pgView,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { priorityEnum, ticketStatusEnum } from "./enums";

const ts = (name: string) => timestamp(name, { withTimezone: true });

/**
 * Cumplimiento de tareas por auxiliar y por mes (zona America/Bogota).
 *
 * Reglas (sección 5.5):
 * - % cumplimiento = completadas a tiempo ÷ tareas cuyo due_at ya se cumplió (no canceladas).
 *   Ambos términos cuentan solo tareas con due_at ≤ now().
 * - "En riesgo" depende de un umbral configurable, así que se calcula en la app
 *   (función pura del semáforo), no aquí.
 */
export const vTaskCompliance = pgView("v_task_compliance", {
  assigneeId: uuid("assignee_id").notNull(),
  teamId: uuid("team_id"),
  period: date("period", { mode: "string" }).notNull(),
  total: integer("total").notNull(),
  completed: integer("completed").notNull(),
  completedOnTime: integer("completed_on_time").notNull(),
  completedLate: integer("completed_late").notNull(),
  open: integer("open").notNull(),
  openOverdue: integer("open_overdue").notNull(),
  dueElapsed: integer("due_elapsed").notNull(),
  dueElapsedOnTime: integer("due_elapsed_on_time").notNull(),
  compliancePct: numeric("compliance_pct", { mode: "number" }),
}).as(sql`
  select
    t.assignee_id,
    t.team_id,
    date_trunc('month', t.due_at at time zone 'America/Bogota')::date as period,
    count(*)::int as total,
    count(*) filter (where t.status = 'completada')::int as completed,
    count(*) filter (where t.status = 'completada' and t.completed_at <= t.due_at)::int as completed_on_time,
    count(*) filter (where t.status = 'completada' and t.completed_at > t.due_at)::int as completed_late,
    count(*) filter (where t.status in ('pendiente', 'en_progreso'))::int as open,
    count(*) filter (where t.status in ('pendiente', 'en_progreso') and t.due_at < now())::int as open_overdue,
    count(*) filter (where t.due_at <= now())::int as due_elapsed,
    count(*) filter (where t.due_at <= now() and t.status = 'completada' and t.completed_at <= t.due_at)::int as due_elapsed_on_time,
    round(
      100.0 * count(*) filter (where t.due_at <= now() and t.status = 'completada' and t.completed_at <= t.due_at)
      / nullif(count(*) filter (where t.due_at <= now()), 0),
      1
    ) as compliance_pct
  from tasks t
  where t.deleted_at is null
    and t.status <> 'cancelada'
    and t.due_at is not null
    and t.assignee_id is not null
  group by t.assignee_id, t.team_id, date_trunc('month', t.due_at at time zone 'America/Bogota')
`);

/**
 * Estado del SLA por ticket.
 * sla_state: cumplido | incumplido (ya resuelto) · en_curso | vencido (aún abierto).
 */
export const vTicketSla = pgView("v_ticket_sla", {
  ticketId: uuid("ticket_id").notNull(),
  code: text("code").notNull(),
  typeId: uuid("type_id").notNull(),
  teamId: uuid("team_id"),
  assigneeId: uuid("assignee_id"),
  priority: priorityEnum("priority").notNull(),
  status: ticketStatusEnum("status").notNull(),
  createdAt: ts("created_at").notNull(),
  slaFirstResponseDue: ts("sla_first_response_due").notNull(),
  firstResponseAt: ts("first_response_at"),
  slaResolutionDue: ts("sla_resolution_due").notNull(),
  resolvedAt: ts("resolved_at"),
  firstResponseMet: boolean("first_response_met"),
  resolutionMet: boolean("resolution_met"),
  slaState: text("sla_state").notNull(),
}).as(sql`
  select
    t.id as ticket_id,
    t.code,
    t.type_id,
    t.team_id,
    t.assignee_id,
    t.priority,
    t.status,
    t.created_at,
    t.sla_first_response_due,
    t.first_response_at,
    t.sla_resolution_due,
    t.resolved_at,
    case
      when t.first_response_at is not null then t.first_response_at <= t.sla_first_response_due
      when now() > t.sla_first_response_due then false
      else null
    end as first_response_met,
    case
      when t.resolved_at is not null then t.resolved_at <= t.sla_resolution_due
      when now() > t.sla_resolution_due then false
      else null
    end as resolution_met,
    case
      when t.resolved_at is not null and t.resolved_at <= t.sla_resolution_due then 'cumplido'
      when t.resolved_at is not null then 'incumplido'
      when now() > t.sla_resolution_due then 'vencido'
      else 'en_curso'
    end as sla_state
  from tickets t
  where t.deleted_at is null
`);
