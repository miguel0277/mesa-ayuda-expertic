import type { Role } from "./roles";

/**
 * Matriz de permisos (sección 5.1 del prompt, con los ajustes de DECISIONES.md).
 *
 * `can(actor, action, resource?)` es la ÚNICA fuente de verdad para autorizar:
 * - La UI la usa para ocultar acciones.
 * - El servidor la usa para BLOQUEARLAS (casos de uso, páginas y route handlers).
 *
 * Cada permiso es una regla por rol: `true`, `false` o una condición sobre el recurso
 * (propio, asignado, de su equipo…). Ver docs/PERMISOS.md.
 */

export type Actor = {
  id: string;
  role: Role;
  /** Equipos en los que el actor es miembro vigente. */
  teamIds: readonly string[];
  /** Equipos que el actor lidera. */
  leadTeamIds: readonly string[];
};

/** Datos del recurso que algunas reglas necesitan. Todos opcionales. */
export type Resource = {
  /** Ticket: quién lo pidió. */
  requesterId?: string | null;
  /** Ticket o tarea: a quién está asignado. */
  assigneeId?: string | null;
  /** Ticket o tarea: equipo responsable. */
  teamId?: string | null;
  /** Tarea: quién la asignó. */
  assignedById?: string | null;
  /** Usuario objetivo (gestión de usuarios): su rol actual o el que se le quiere dar. */
  targetRole?: Role;
  /** Equipo del usuario o tarea objetivo (para líderes). */
  targetTeamId?: string | null;
};

export const ACTIONS = [
  "ticket.create",
  "ticket.read.own",
  "ticket.read.assigned",
  "ticket.read.team",
  "ticket.read.all",
  "ticket.assign",
  "ticket.reply",
  "ticket.status",
  "ticket.priority",
  "ticket.internal_note",
  "ticket.rate",
  "task.create",
  "task.assign",
  "task.read.own",
  "task.read.team",
  "task.read.all",
  "task.update.own",
  "task.complete",
  "task.cancel",
  "dashboard.global",
  "dashboard.team",
  "templates.manage",
  "sla.manage",
  "users.read",
  "users.manage",
  "users.approve",
  "roles.grant.admin",
  "audit.read",
  "admin.impersonate",
  "settings.manage",
  "reports.export",
  "system.health",
] as const;

export type Action = (typeof ACTIONS)[number];

type Rule = boolean | ((actor: Actor, r: Resource) => boolean);
type Matrix = Record<Action, Record<Role, Rule>>;

// ── Condiciones reutilizables ──
const own = (a: Actor, r: Resource) => !!r.requesterId && r.requesterId === a.id;
const assigned = (a: Actor, r: Resource) => !!r.assigneeId && r.assigneeId === a.id;
const inLedTeam = (a: Actor, r: Resource) => !!r.teamId && a.leadTeamIds.includes(r.teamId);
const targetInLedTeam = (a: Actor, r: Resource) =>
  !!r.targetTeamId && a.leadTeamIds.includes(r.targetTeamId);
const assignedOrTeam = (a: Actor, r: Resource) => assigned(a, r) || inLedTeam(a, r);
const STAFF_ROLES: readonly Role[] = ["auxiliar", "lider"];

const all = (rule: Rule): Record<Role, Rule> => ({
  admin: rule,
  docente: rule,
  lider: rule,
  auxiliar: rule,
  profesor: rule,
  estudiante: rule,
});

const MATRIX: Matrix = {
  "ticket.create": all(true),
  "ticket.read.own": all(own),
  "ticket.read.assigned": {
    admin: true,
    docente: true,
    lider: assigned,
    auxiliar: assigned,
    profesor: false,
    estudiante: false,
  },
  "ticket.read.team": {
    admin: true,
    docente: true,
    lider: inLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "ticket.read.all": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "ticket.assign": {
    admin: true,
    docente: true,
    lider: inLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  // Responder: el personal sobre lo que atiende; el solicitante sobre lo propio.
  "ticket.reply": {
    admin: true,
    docente: true,
    lider: (a, r) => assignedOrTeam(a, r) || own(a, r),
    auxiliar: (a, r) => assigned(a, r) || own(a, r),
    profesor: own,
    estudiante: own,
  },
  // Cambiar estado. Qué transición exacta se permite lo decide la máquina de estados según el rol
  // (el solicitante solo puede marcar resuelto o reabrir).
  "ticket.status": {
    admin: true,
    docente: true,
    lider: (a, r) => assignedOrTeam(a, r) || own(a, r),
    auxiliar: (a, r) => assigned(a, r) || own(a, r),
    profesor: own,
    estudiante: own,
  },
  // D-006: la prioridad la decide el docente o el líder (su equipo).
  "ticket.priority": {
    admin: true,
    docente: true,
    lider: inLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "ticket.internal_note": {
    admin: true,
    docente: true,
    lider: assignedOrTeam,
    auxiliar: assigned,
    profesor: false,
    estudiante: false,
  },
  "ticket.rate": all(own),

  "task.create": {
    admin: true,
    docente: true,
    lider: targetInLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "task.assign": {
    admin: true,
    docente: true,
    lider: targetInLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "task.read.own": {
    admin: true,
    docente: true,
    lider: assigned,
    auxiliar: assigned,
    profesor: false,
    estudiante: false,
  },
  "task.read.team": {
    admin: true,
    docente: true,
    lider: inLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "task.read.all": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  // Ejecutar la tarea: solo quien la tiene asignada (el docente asigna, no ejecuta).
  "task.update.own": {
    admin: true,
    docente: false,
    lider: assigned,
    auxiliar: assigned,
    profesor: false,
    estudiante: false,
  },
  "task.complete": {
    admin: true,
    docente: false,
    lider: assigned,
    auxiliar: assigned,
    profesor: false,
    estudiante: false,
  },
  // Cancelar: solo quien la asignó (5.4), o el admin.
  "task.cancel": {
    admin: true,
    docente: (a, r) => r.assignedById === a.id,
    lider: (a, r) => r.assignedById === a.id,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },

  "dashboard.global": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "dashboard.team": {
    admin: true,
    docente: true,
    lider: true,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "templates.manage": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "sla.manage": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "users.read": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  // El docente gestiona auxiliares y equipos: solo puede tocar/otorgar roles de auxiliar o líder.
  "users.manage": {
    admin: true,
    docente: (_a, r) => r.targetRole === undefined || STAFF_ROLES.includes(r.targetRole),
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  // D-002: las cuentas de personal (auxiliar, líder, docente) las aprueba el administrador.
  "users.approve": {
    admin: true,
    docente: false,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "roles.grant.admin": {
    admin: true,
    docente: false,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "audit.read": {
    admin: true,
    docente: true,
    lider: inLedTeam,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "admin.impersonate": {
    admin: true,
    docente: false,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "settings.manage": {
    admin: true,
    docente: false,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "reports.export": {
    admin: true,
    docente: true,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
  "system.health": {
    admin: true,
    docente: false,
    lider: false,
    auxiliar: false,
    profesor: false,
    estudiante: false,
  },
};

/** ¿Puede el actor ejecutar la acción sobre el recurso? */
export function can(
  actor: Actor | null | undefined,
  action: Action,
  resource: Resource = {},
): boolean {
  if (!actor) return false;
  const rule = MATRIX[action][actor.role];
  return typeof rule === "function" ? rule(actor, resource) : rule;
}

/** ¿Tiene el rol este permiso en algún caso? (para mostrar menús sin un recurso concreto). */
export function roleMayEver(role: Role, action: Action): boolean {
  return MATRIX[action][role] !== false;
}

/** Lectura de un ticket: propio, asignado, de su equipo o todos. */
export function canReadTicket(actor: Actor | null | undefined, r: Resource): boolean {
  return (
    can(actor, "ticket.read.all", r) ||
    can(actor, "ticket.read.own", r) ||
    can(actor, "ticket.read.assigned", r) ||
    can(actor, "ticket.read.team", r)
  );
}

/** Lectura de una tarea: propia, de su equipo o todas. */
export function canReadTask(actor: Actor | null | undefined, r: Resource): boolean {
  return (
    can(actor, "task.read.all", r) ||
    can(actor, "task.read.own", r) ||
    can(actor, "task.read.team", r)
  );
}

/** Exportado para generar docs/PERMISOS.md y para las pruebas. */
export const PERMISSION_MATRIX: Readonly<Matrix> = MATRIX;
