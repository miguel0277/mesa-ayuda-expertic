import { DomainError, invalidTransition } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import type { TaskStatus } from "@/shared/db/schema/enums";

/**
 * Máquina de estados de la tarea (sección 5.4):
 *   pendiente → en_progreso → completada
 *   cancelada: solo quien la asignó (o el admin)
 * Completar exige al menos una evidencia (nota o archivo) si `requiresEvidence`.
 */
export type TaskActorKind = "assignee" | "assigner";

type Rule = { to: TaskStatus; by: readonly TaskActorKind[] };

export const TASK_TRANSITIONS: Record<TaskStatus, readonly Rule[]> = {
  pendiente: [
    { to: "en_progreso", by: ["assignee"] },
    { to: "completada", by: ["assignee"] },
    { to: "cancelada", by: ["assigner"] },
  ],
  en_progreso: [
    { to: "pendiente", by: ["assignee"] },
    { to: "completada", by: ["assignee"] },
    { to: "cancelada", by: ["assigner"] },
  ],
  // Reabrir una tarea completada: quien la asignó (p. ej. si la evidencia no basta).
  completada: [{ to: "en_progreso", by: ["assigner"] }],
  cancelada: [{ to: "pendiente", by: ["assigner"] }],
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ["pendiente", "en_progreso"];

export function taskTransition(input: {
  from: TaskStatus;
  to: TaskStatus;
  by: readonly TaskActorKind[];
  requiresEvidence: boolean;
  evidenceCount: number;
}): Result<TaskStatus, DomainError> {
  const rule = TASK_TRANSITIONS[input.from].find((r) => r.to === input.to);
  if (!rule || !rule.by.some((b) => input.by.includes(b))) {
    return err(
      invalidTransition("tarea", TASK_STATUS_LABEL[input.from], TASK_STATUS_LABEL[input.to]),
    );
  }
  if (input.to === "completada" && input.requiresEvidence && input.evidenceCount < 1) {
    return err(
      new DomainError(
        "VALIDATION",
        "Para completar esta tarea agrega al menos una evidencia: una nota o un archivo.",
      ),
    );
  }
  return ok(input.to);
}

/** Marcas de tiempo al entrar a un estado. */
export function taskTimestamps(
  to: TaskStatus,
  current: { startedAt: Date | null; completedAt: Date | null; cancelledAt: Date | null },
  now: Date,
) {
  switch (to) {
    case "en_progreso":
      return { startedAt: current.startedAt ?? now, completedAt: null, cancelledAt: null };
    case "completada":
      return { startedAt: current.startedAt ?? now, completedAt: now, cancelledAt: null };
    case "cancelada":
      return { ...current, cancelledAt: now };
    case "pendiente":
      return { startedAt: current.startedAt, completedAt: null, cancelledAt: null };
  }
}
