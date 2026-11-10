import { DomainError, invalidTransition } from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import type { TicketStatus } from "@/shared/db/schema/enums";

/**
 * Máquina de estados del ticket (sección 5.3).
 *
 *   abierto → asignado → en_progreso → respondido → cerrado
 *   respondido → en_progreso   (el solicitante responde)
 *   cerrado → reabierto → asignado   (si se reabre dentro de la ventana)
 *
 * Cada transición indica quién puede hacerla. Una transición inválida devuelve un error de
 * dominio; nunca se hace en silencio.
 */
export type TicketActorKind = "staff" | "requester" | "system";

type Rule = { to: TicketStatus; by: readonly TicketActorKind[]; label: string };

export const TICKET_TRANSITIONS: Record<TicketStatus, readonly Rule[]> = {
  abierto: [
    { to: "asignado", by: ["staff"], label: "Asignar" },
    { to: "cerrado", by: ["requester", "staff"], label: "Cerrar" },
  ],
  asignado: [
    { to: "en_progreso", by: ["staff"], label: "Empezar a trabajar" },
    { to: "respondido", by: ["staff"], label: "Marcar como respondido" },
    { to: "cerrado", by: ["requester", "staff"], label: "Cerrar" },
  ],
  en_progreso: [
    { to: "respondido", by: ["staff"], label: "Marcar como respondido" },
    { to: "cerrado", by: ["requester", "staff"], label: "Cerrar" },
  ],
  respondido: [
    { to: "en_progreso", by: ["requester", "staff"], label: "Volver a en progreso" },
    { to: "cerrado", by: ["requester", "staff", "system"], label: "Marcar como resuelto" },
  ],
  cerrado: [{ to: "reabierto", by: ["requester", "staff"], label: "Reabrir" }],
  reabierto: [
    { to: "asignado", by: ["staff"], label: "Asignar" },
    { to: "en_progreso", by: ["staff"], label: "Empezar a trabajar" },
    { to: "respondido", by: ["staff"], label: "Marcar como respondido" },
    { to: "cerrado", by: ["requester", "staff"], label: "Cerrar" },
  ],
};

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  abierto: "Abierto",
  asignado: "Asignado",
  en_progreso: "En progreso",
  respondido: "Respondido",
  cerrado: "Cerrado",
  reabierto: "Reabierto",
};

/** Estados en los que el ticket sigue "vivo" (cuenta para SLA y bandejas). */
export const OPEN_STATUSES: readonly TicketStatus[] = [
  "abierto",
  "asignado",
  "en_progreso",
  "respondido",
  "reabierto",
];

export function allowedTransitions(from: TicketStatus, by: TicketActorKind): Rule[] {
  return TICKET_TRANSITIONS[from].filter((r) => r.by.includes(by));
}

export type TransitionInput = {
  from: TicketStatus;
  to: TicketStatus;
  by: TicketActorKind;
  now: Date;
  /** Para reabrir: cuándo se cerró y la ventana permitida en días (D-006/5.3). */
  closedAt?: Date | null;
  reopenWindowDays?: number;
};

export function transition(input: TransitionInput): Result<TicketStatus, DomainError> {
  const rule = TICKET_TRANSITIONS[input.from].find((r) => r.to === input.to);
  if (!rule || !rule.by.includes(input.by)) {
    return err(
      invalidTransition("ticket", TICKET_STATUS_LABEL[input.from], TICKET_STATUS_LABEL[input.to]),
    );
  }
  if (input.to === "reabierto" && input.by === "requester") {
    const days = input.reopenWindowDays ?? 7;
    if (!input.closedAt || input.now.getTime() - input.closedAt.getTime() > days * 86_400_000) {
      return err(
        new DomainError(
          "INVALID_TRANSITION",
          `Solo puedes reabrir una solicitud durante los ${days} días siguientes a su cierre. Crea una nueva.`,
        ),
      );
    }
  }
  return ok(input.to);
}

/** Efectos de entrar a un estado sobre las marcas de tiempo del ticket. */
export function timestampsFor(
  to: TicketStatus,
  current: { firstResponseAt: Date | null; resolvedAt: Date | null; closedAt: Date | null },
  now: Date,
) {
  switch (to) {
    case "respondido":
      return {
        firstResponseAt: current.firstResponseAt ?? now,
        resolvedAt: current.resolvedAt ?? now,
        closedAt: current.closedAt,
      };
    case "cerrado":
      return {
        firstResponseAt: current.firstResponseAt,
        resolvedAt: current.resolvedAt ?? now,
        closedAt: now,
      };
    case "reabierto":
      return { firstResponseAt: current.firstResponseAt, resolvedAt: null, closedAt: null };
    default:
      return current;
  }
}
