import { describe, expect, it } from "vitest";
import {
  ACTIONS,
  can,
  canReadTask,
  canReadTicket,
  PERMISSION_MATRIX,
  type Action,
  type Actor,
  type Resource,
} from "./permissions";
import { ROLES, type Role } from "./roles";

const actor = (role: Role, extra: Partial<Actor> = {}): Actor => ({
  id: `u-${role}`,
  role,
  teamIds: [],
  leadTeamIds: [],
  ...extra,
});

/**
 * Esperado por fila. "c" = condicional: se prueba con un recurso que cumple y otro que no.
 * Orden de columnas: admin, docente, lider, auxiliar, profesor, estudiante.
 */
type Cell = boolean | "c";
const EXPECTED: Record<Action, [Cell, Cell, Cell, Cell, Cell, Cell]> = {
  "ticket.create": [true, true, true, true, true, true],
  "ticket.read.own": ["c", "c", "c", "c", "c", "c"],
  "ticket.read.assigned": [true, true, "c", "c", false, false],
  "ticket.read.team": [true, true, "c", false, false, false],
  "ticket.read.all": [true, true, false, false, false, false],
  "ticket.assign": [true, true, "c", false, false, false],
  "ticket.reply": [true, true, "c", "c", "c", "c"],
  "ticket.status": [true, true, "c", "c", "c", "c"],
  "ticket.priority": [true, true, "c", false, false, false],
  "ticket.internal_note": [true, true, "c", "c", false, false],
  "ticket.rate": ["c", "c", "c", "c", "c", "c"],
  "task.create": [true, true, "c", false, false, false],
  "task.assign": [true, true, "c", false, false, false],
  "task.read.own": [true, true, "c", "c", false, false],
  "task.read.team": [true, true, "c", false, false, false],
  "task.read.all": [true, true, false, false, false, false],
  "task.update.own": [true, false, "c", "c", false, false],
  "task.complete": [true, false, "c", "c", false, false],
  "task.cancel": [true, "c", "c", false, false, false],
  "dashboard.global": [true, true, false, false, false, false],
  "dashboard.team": [true, true, true, false, false, false],
  "templates.manage": [true, true, false, false, false, false],
  "sla.manage": [true, true, false, false, false, false],
  "users.read": [true, true, false, false, false, false],
  "users.manage": [true, "c", false, false, false, false],
  "users.approve": [true, false, false, false, false, false],
  "roles.grant.admin": [true, false, false, false, false, false],
  "audit.read": [true, true, "c", false, false, false],
  "admin.impersonate": [true, false, false, false, false, false],
  "settings.manage": [true, false, false, false, false, false],
  "reports.export": [true, true, false, false, false, false],
  "system.health": [true, false, false, false, false, false],
};

const TEAM = "team-1";

/** Recurso que cumple la condición de cada acción para el rol dado. */
function matching(action: Action, a: Actor): { actor: Actor; resource: Resource } {
  const lead = { ...a, leadTeamIds: [TEAM], teamIds: [TEAM] };
  switch (action) {
    case "ticket.read.own":
    case "ticket.rate":
      return { actor: a, resource: { requesterId: a.id } };
    case "ticket.read.assigned":
    case "task.read.own":
    case "task.update.own":
    case "task.complete":
      return { actor: a, resource: { assigneeId: a.id } };
    case "ticket.reply":
    case "ticket.status":
      return { actor: a, resource: { requesterId: a.id } };
    case "ticket.internal_note":
      return { actor: a, resource: { assigneeId: a.id } };
    case "ticket.read.team":
    case "ticket.assign":
    case "ticket.priority":
    case "task.read.team":
    case "audit.read":
      return { actor: lead, resource: { teamId: TEAM } };
    case "task.create":
    case "task.assign":
      return { actor: lead, resource: { targetTeamId: TEAM } };
    case "task.cancel":
      return { actor: a, resource: { assignedById: a.id } };
    case "users.manage":
      return { actor: a, resource: { targetRole: "auxiliar" } };
    default:
      return { actor: a, resource: {} };
  }
}

/** Recurso ajeno: no es suyo, no lo tiene asignado, no es de su equipo. */
function foreign(action: Action, _a: Actor): Resource {
  if (action === "users.manage") return { targetRole: "admin" };
  return {
    requesterId: "otro",
    assigneeId: "otro",
    teamId: "otro-equipo",
    targetTeamId: "otro-equipo",
    assignedById: "otro",
  };
}

describe("matriz de permisos: cada fila y cada rol", () => {
  it("cubre todas las acciones declaradas", () => {
    expect(Object.keys(EXPECTED).sort()).toEqual([...ACTIONS].sort());
    expect(Object.keys(PERMISSION_MATRIX).sort()).toEqual([...ACTIONS].sort());
  });

  for (const action of ACTIONS) {
    describe(action, () => {
      ROLES.forEach((role, i) => {
        const cell = EXPECTED[action][i];
        if (cell === "c") {
          it(`${role}: permitido solo si se cumple la condición`, () => {
            const { actor: a, resource } = matching(action, actor(role));
            expect(can(a, action, resource)).toBe(true);
            expect(can(actor(role), action, foreign(action, actor(role)))).toBe(false);
          });
        } else {
          it(`${role}: ${cell ? "permitido" : "denegado"}`, () => {
            const a = actor(role, { leadTeamIds: [TEAM], teamIds: [TEAM] });
            expect(can(a, action, { teamId: TEAM, targetTeamId: TEAM })).toBe(cell);
            expect(can(a, action, foreign(action, a))).toBe(cell);
          });
        }
      });
    });
  }
});

describe("casos de negocio", () => {
  it("sin actor nunca se permite nada", () => {
    for (const action of ACTIONS) expect(can(null, action)).toBe(false);
  });

  it("un estudiante solo lee sus propios tickets", () => {
    const e = actor("estudiante");
    expect(canReadTicket(e, { requesterId: e.id })).toBe(true);
    expect(canReadTicket(e, { requesterId: "otro", assigneeId: e.id })).toBe(false);
  });

  it("un auxiliar lee lo que tiene asignado y lo que pidió, pero no lo de otros", () => {
    const a = actor("auxiliar");
    expect(canReadTicket(a, { assigneeId: a.id })).toBe(true);
    expect(canReadTicket(a, { requesterId: a.id })).toBe(true);
    expect(canReadTicket(a, { requesterId: "x", assigneeId: "y", teamId: TEAM })).toBe(false);
  });

  it("un líder lee y asigna dentro de su equipo, no fuera", () => {
    const l = actor("lider", { leadTeamIds: [TEAM] });
    expect(canReadTicket(l, { teamId: TEAM })).toBe(true);
    expect(can(l, "ticket.assign", { teamId: TEAM })).toBe(true);
    expect(can(l, "ticket.assign", { teamId: "otro" })).toBe(false);
    expect(can(l, "task.create", { targetTeamId: "otro" })).toBe(false);
  });

  it("el docente asigna tareas pero no las ejecuta", () => {
    const d = actor("docente");
    expect(can(d, "task.create")).toBe(true);
    expect(can(d, "task.complete", { assigneeId: d.id })).toBe(false);
  });

  it("solo quien asignó una tarea la puede cancelar", () => {
    const d = actor("docente");
    expect(can(d, "task.cancel", { assignedById: d.id })).toBe(true);
    expect(can(d, "task.cancel", { assignedById: "otro" })).toBe(false);
    expect(can(actor("admin"), "task.cancel", { assignedById: "otro" })).toBe(true);
  });

  it("el docente no puede otorgar el rol de docente ni de admin", () => {
    const d = actor("docente");
    expect(can(d, "users.manage", { targetRole: "lider" })).toBe(true);
    expect(can(d, "users.manage", { targetRole: "docente" })).toBe(false);
    expect(can(d, "users.manage", { targetRole: "admin" })).toBe(false);
  });

  it("lectura de tareas", () => {
    const a = actor("auxiliar");
    expect(canReadTask(a, { assigneeId: a.id })).toBe(true);
    expect(canReadTask(a, { assigneeId: "otro" })).toBe(false);
    expect(canReadTask(actor("docente"), {})).toBe(true);
  });
});
