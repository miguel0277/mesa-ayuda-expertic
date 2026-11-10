import type { TaskStatus } from "@/shared/db/schema/enums";

/**
 * Semáforo de cumplimiento (sección 5.5). Funciones puras.
 *
 * - A tiempo:   completada antes (o en) `due_at`, o abierta con más de `riskHours` para vencer.
 * - En riesgo:  abierta y vence en ≤ `riskHours`.
 * - Atrasada:   abierta con `due_at` vencido, o completada después de `due_at` (cumplida tarde).
 * - % cumplimiento = completadas a tiempo ÷ tareas con `due_at` ya cumplido en el periodo.
 * - Estado del auxiliar = el peor estado entre sus tareas ABIERTAS.
 */
export type Signal = "a_tiempo" | "en_riesgo" | "atrasada";

export type TaskLike = {
  status: TaskStatus;
  dueAt: Date | null;
  completedAt: Date | null;
};

const HOUR = 3_600_000;
const RANK: Record<Signal, number> = { a_tiempo: 0, en_riesgo: 1, atrasada: 2 };

export function taskSignal(t: TaskLike, now: Date, riskHours = 24): Signal | null {
  if (t.status === "cancelada" || !t.dueAt) return null;
  if (t.status === "completada") {
    return t.completedAt && t.completedAt.getTime() <= t.dueAt.getTime() ? "a_tiempo" : "atrasada";
  }
  const left = t.dueAt.getTime() - now.getTime();
  if (left < 0) return "atrasada";
  if (left <= riskHours * HOUR) return "en_riesgo";
  return "a_tiempo";
}

/** Peor señal entre las tareas abiertas (null si no tiene abiertas con fecha). */
export function assistantSignal(tasks: TaskLike[], now: Date, riskHours = 24): Signal | null {
  let worst: Signal | null = null;
  for (const t of tasks) {
    if (t.status !== "pendiente" && t.status !== "en_progreso") continue;
    const s = taskSignal(t, now, riskHours);
    if (s && (!worst || RANK[s] > RANK[worst])) worst = s;
  }
  return worst;
}

export type Compliance = {
  /** null si aún no hay tareas con fecha cumplida (no hay contra qué medir). */
  pct: number | null;
  onTime: number;
  dueElapsed: number;
  completed: number;
  completedLate: number;
  open: number;
  overdue: number;
  atRisk: number;
};

/** Cumplimiento de un conjunto de tareas en un periodo (definido por quien llama). */
export function compliance(tasks: TaskLike[], now: Date, riskHours = 24): Compliance {
  let onTime = 0;
  let dueElapsed = 0;
  let completed = 0;
  let completedLate = 0;
  let open = 0;
  let overdue = 0;
  let atRisk = 0;
  for (const t of tasks) {
    if (t.status === "cancelada") continue;
    const isOpen = t.status === "pendiente" || t.status === "en_progreso";
    if (isOpen) open++;
    if (t.status === "completada") {
      completed++;
      if (t.dueAt && t.completedAt && t.completedAt > t.dueAt) completedLate++;
    }
    const s = taskSignal(t, now, riskHours);
    if (isOpen && s === "atrasada") overdue++;
    if (isOpen && s === "en_riesgo") atRisk++;
    if (t.dueAt && t.dueAt.getTime() <= now.getTime()) {
      dueElapsed++;
      if (t.status === "completada" && t.completedAt && t.completedAt <= t.dueAt) onTime++;
    }
  }
  return {
    pct: dueElapsed ? Math.round((onTime / dueElapsed) * 1000) / 10 : null,
    onTime,
    dueElapsed,
    completed,
    completedLate,
    open,
    overdue,
    atRisk,
  };
}

/** Racha: tareas completadas a tiempo seguidas, desde la más reciente hacia atrás. */
export function onTimeStreak(tasks: TaskLike[]): number {
  const done = tasks
    .filter((t) => t.status === "completada" && t.completedAt && t.dueAt)
    .sort((a, b) => b.completedAt!.getTime() - a.completedAt!.getTime());
  let streak = 0;
  for (const t of done) {
    if (t.completedAt! <= t.dueAt!) streak++;
    else break;
  }
  return streak;
}

export const SIGNAL_RANK = RANK;
