import { describe, expect, it } from "vitest";
import { assistantSignal, compliance, onTimeStreak, taskSignal, type TaskLike } from "./compliance";
import { taskTimestamps, taskTransition } from "./task-state";

const now = new Date("2026-11-10T15:00:00Z");
const h = (n: number) => new Date(now.getTime() + n * 3_600_000);
const open = (dueH: number | null, status: TaskLike["status"] = "pendiente"): TaskLike => ({
  status,
  dueAt: dueH === null ? null : h(dueH),
  completedAt: null,
});
const done = (dueH: number, doneH: number): TaskLike => ({
  status: "completada",
  dueAt: h(dueH),
  completedAt: h(doneH),
});

describe("semáforo por tarea (5.5)", () => {
  it("abierta con más de 24 h para vencer: a tiempo", () =>
    expect(taskSignal(open(25), now)).toBe("a_tiempo"));
  it("abierta que vence en ≤ 24 h: en riesgo", () => {
    expect(taskSignal(open(24), now)).toBe("en_riesgo");
    expect(taskSignal(open(1), now)).toBe("en_riesgo");
  });
  it("abierta y vencida: atrasada", () =>
    expect(taskSignal(open(-1, "en_progreso"), now)).toBe("atrasada"));
  it("completada antes o en el vencimiento: a tiempo", () => {
    expect(taskSignal(done(-5, -6), now)).toBe("a_tiempo");
    expect(taskSignal(done(-5, -5), now)).toBe("a_tiempo");
  });
  it("completada después del vencimiento: atrasada (cumplida tarde)", () =>
    expect(taskSignal(done(-5, -1), now)).toBe("atrasada"));
  it("sin fecha o cancelada: sin señal", () => {
    expect(taskSignal(open(null), now)).toBeNull();
    expect(taskSignal({ status: "cancelada", dueAt: h(-1), completedAt: null }, now)).toBeNull();
  });
  it("el umbral de riesgo es configurable", () => {
    expect(taskSignal(open(30), now, 48)).toBe("en_riesgo");
    expect(taskSignal(open(30), now, 24)).toBe("a_tiempo");
  });
});

describe("estado del auxiliar = peor de sus abiertas", () => {
  it("ignora las completadas tarde y toma la peor abierta", () => {
    expect(assistantSignal([done(-5, -1), open(48), open(10)], now)).toBe("en_riesgo");
    expect(assistantSignal([open(48), open(-2, "en_progreso")], now)).toBe("atrasada");
    expect(assistantSignal([done(-5, -1)], now)).toBeNull();
  });
});

describe("% de cumplimiento", () => {
  it("completadas a tiempo ÷ tareas con fecha ya cumplida", () => {
    const c = compliance(
      [
        done(-10, -11), // a tiempo, vencida → cuenta
        done(-10, -2), // tarde → cuenta en el denominador
        open(-3), // vencida sin hacer → denominador
        open(20), // aún no vence → no cuenta
        done(30, -1), // completada antes, pero su fecha no ha llegado → no cuenta
        { status: "cancelada", dueAt: h(-1), completedAt: null },
      ],
      now,
    );
    expect(c.dueElapsed).toBe(3);
    expect(c.onTime).toBe(1);
    expect(c.pct).toBe(33.3);
    expect(c.overdue).toBe(1);
    expect(c.atRisk).toBe(1);
    expect(c.completedLate).toBe(1);
  });
  it("sin tareas vencidas no hay porcentaje", () =>
    expect(compliance([open(50)], now).pct).toBeNull());
});

describe("racha de tareas a tiempo", () => {
  it("cuenta desde la más reciente hasta la primera tardía", () => {
    expect(onTimeStreak([done(-1, -2), done(-20, -21), done(-40, -30), done(-60, -61)])).toBe(2);
    expect(onTimeStreak([])).toBe(0);
  });
});

describe("máquina de estados de la tarea (5.4)", () => {
  it("flujo normal y exigencia de evidencia", () => {
    expect(
      taskTransition({
        from: "pendiente",
        to: "en_progreso",
        by: ["assignee"],
        requiresEvidence: true,
        evidenceCount: 0,
      }).ok,
    ).toBe(true);
    const noEvidence = taskTransition({
      from: "en_progreso",
      to: "completada",
      by: ["assignee"],
      requiresEvidence: true,
      evidenceCount: 0,
    });
    expect(noEvidence.ok).toBe(false);
    if (!noEvidence.ok) expect(noEvidence.error.message).toMatch(/evidencia/);
    expect(
      taskTransition({
        from: "en_progreso",
        to: "completada",
        by: ["assignee"],
        requiresEvidence: true,
        evidenceCount: 1,
      }).ok,
    ).toBe(true);
    expect(
      taskTransition({
        from: "en_progreso",
        to: "completada",
        by: ["assignee"],
        requiresEvidence: false,
        evidenceCount: 0,
      }).ok,
    ).toBe(true);
  });
  it("solo quien asignó cancela o reabre", () => {
    expect(
      taskTransition({
        from: "pendiente",
        to: "cancelada",
        by: ["assignee"],
        requiresEvidence: false,
        evidenceCount: 0,
      }).ok,
    ).toBe(false);
    expect(
      taskTransition({
        from: "pendiente",
        to: "cancelada",
        by: ["assigner"],
        requiresEvidence: false,
        evidenceCount: 0,
      }).ok,
    ).toBe(true);
    expect(
      taskTransition({
        from: "completada",
        to: "en_progreso",
        by: ["assignee"],
        requiresEvidence: false,
        evidenceCount: 0,
      }).ok,
    ).toBe(false);
  });
  it("marcas de tiempo", () => {
    const base = { startedAt: null, completedAt: null, cancelledAt: null };
    expect(taskTimestamps("completada", base, now)).toEqual({
      startedAt: now,
      completedAt: now,
      cancelledAt: null,
    });
    expect(
      taskTimestamps("pendiente", { ...base, startedAt: now, completedAt: now }, now).completedAt,
    ).toBeNull();
  });
});
