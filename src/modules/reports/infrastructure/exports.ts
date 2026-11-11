import { and, asc, eq, gte, isNull, lte, sql } from "drizzle-orm";
import { taskSignal } from "@/modules/tasks/domain/compliance";
import { TASK_STATUS_LABEL } from "@/modules/tasks/domain/task-state";
import { slaView } from "@/modules/tickets/domain/sla";
import { TICKET_STATUS_LABEL } from "@/modules/tickets/domain/ticket-state";
import { ROLE_LABEL } from "@/shared/auth/roles";
import { tasks, teams, tickets, ticketTypes, user } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import { formatDateTime } from "@/shared/lib/dates";

/**
 * Exportación de tickets y tareas (HU-45). Devuelve filas planas con encabezados en español;
 * el formato (CSV o Excel) lo decide quien llama.
 */
export type Sheet = { name: string; headers: string[]; rows: (string | number | null)[][] };

const dt = (d: Date | null) => (d ? formatDateTime(d) : "");
const PRIORITY = { alta: "Alta", media: "Media", baja: "Baja" } as const;
const SIGNAL = { a_tiempo: "A tiempo", en_riesgo: "En riesgo", atrasada: "Atrasada" } as const;

export async function ticketsSheet(
  db: DbExecutor,
  from: Date,
  to: Date,
  now: Date,
): Promise<Sheet> {
  const rows = await db
    .select({
      t: tickets,
      type: ticketTypes.name,
      requester: user.name,
      requesterEmail: user.email,
      requesterRole: user.role,
      assignee: sql<
        string | null
      >`(select u.name from ${user} u where u.id = ${tickets.assigneeId})`,
      team: sql<string | null>`(select tm.name from ${teams} tm where tm.id = ${tickets.teamId})`,
    })
    .from(tickets)
    .innerJoin(ticketTypes, eq(ticketTypes.id, tickets.typeId))
    .innerJoin(user, eq(user.id, tickets.requesterId))
    .where(and(isNull(tickets.deletedAt), gte(tickets.createdAt, from), lte(tickets.createdAt, to)))
    .orderBy(asc(tickets.createdAt))
    .limit(10_000);
  return {
    name: "Tickets",
    headers: [
      "Código",
      "Categoría",
      "Título",
      "Estado",
      "Prioridad",
      "Solicitante",
      "Rol",
      "Correo",
      "Creado",
      "Responsable",
      "Equipo",
      "Primera respuesta",
      "Resuelto",
      "Cerrado",
      "Vence (solución)",
      "SLA",
      "Calificación",
    ],
    rows: rows.map(({ t, type, requester, requesterEmail, requesterRole, assignee, team }) => [
      t.code,
      type,
      t.title,
      TICKET_STATUS_LABEL[t.status],
      PRIORITY[t.priority],
      requester,
      ROLE_LABEL[requesterRole],
      requesterEmail,
      dt(t.createdAt),
      assignee ?? "",
      team ?? "",
      dt(t.firstResponseAt),
      dt(t.resolvedAt),
      dt(t.closedAt),
      dt(t.slaResolutionDue),
      slaView(t, now).label,
      t.rating,
    ]),
  };
}

export async function tasksSheet(
  db: DbExecutor,
  from: Date,
  to: Date,
  now: Date,
  riskHours: number,
): Promise<Sheet> {
  const rows = await db
    .select({
      t: tasks,
      assignee: user.name,
      assigner: sql<string>`(select u.name from ${user} u where u.id = ${tasks.assignedBy})`,
      team: sql<string | null>`(select tm.name from ${teams} tm where tm.id = ${tasks.teamId})`,
      ticket: sql<
        string | null
      >`(select tk.code from ${tickets} tk where tk.id = ${tasks.ticketId})`,
      evidence: sql<number>`(select count(*)::int from task_evidence e where e.task_id = ${tasks.id})`,
    })
    .from(tasks)
    .leftJoin(user, eq(user.id, tasks.assigneeId))
    .where(and(isNull(tasks.deletedAt), gte(tasks.createdAt, from), lte(tasks.createdAt, to)))
    .orderBy(asc(tasks.createdAt))
    .limit(10_000);
  return {
    name: "Tareas",
    headers: [
      "Código",
      "Título",
      "Responsable",
      "Equipo",
      "Asignó",
      "Estado",
      "Prioridad",
      "Creada",
      "Fecha límite",
      "Iniciada",
      "Completada",
      "Semáforo",
      "Ticket",
      "Evidencias",
    ],
    rows: rows.map(({ t, assignee, assigner, team, ticket, evidence }) => {
      const s = taskSignal(t, now, riskHours);
      return [
        t.code,
        t.title,
        assignee ?? "",
        team ?? "",
        assigner,
        TASK_STATUS_LABEL[t.status],
        PRIORITY[t.priority],
        dt(t.createdAt),
        dt(t.dueAt),
        dt(t.startedAt),
        dt(t.completedAt),
        s ? SIGNAL[s] : "",
        ticket ?? "",
        evidence,
      ];
    }),
  };
}

/** CSV para Excel en español: separador ";" y BOM UTF-8 (tildes y eñes correctas). */
export function toCsv(sheet: Sheet): string {
  const esc = (v: string | number | null) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    // Evita inyección de fórmulas al abrir en Excel.
    const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
    return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  return "﻿" + [sheet.headers, ...sheet.rows].map((r) => r.map(esc).join(";")).join("\r\n");
}

export async function toXlsx(sheets: Sheet[]): Promise<Uint8Array> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Mesa de Ayuda ExperTIC";
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name, { views: [{ state: "frozen", ySplit: 1 }] });
    ws.addRow(s.headers);
    for (const r of s.rows)
      ws.addRow(r.map((v) => (typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : v)));
    const header = ws.getRow(1);
    header.font = { bold: true, color: { argb: "FFFFFFFF" } };
    header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1673BB" } };
    ws.columns.forEach((col, i) => {
      const longest = Math.max(
        s.headers[i]?.length ?? 10,
        ...s.rows.slice(0, 200).map((r) => String(r[i] ?? "").length),
      );
      col.width = Math.min(Math.max(longest + 2, 10), 60);
    });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.headers.length } };
  }
  const buf = await wb.xlsx.writeBuffer();
  return new Uint8Array(buf as ArrayBuffer);
}
