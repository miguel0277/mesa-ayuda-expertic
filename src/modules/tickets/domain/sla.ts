import {
  addBusinessMinutes,
  businessMinutesBetween,
  defaultCalendar,
  type BusinessCalendar,
} from "@/shared/lib/business-time";
import type { BusinessHours } from "@/shared/db/schema/business";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";

/**
 * SLA del ticket (sección 5.6): vencimientos en horas hábiles según la prioridad.
 * Funciones puras: el calendario y "ahora" se inyectan.
 */
export type SlaPolicy = {
  priority: Priority;
  firstResponseMinutes: number;
  resolutionMinutes: number;
  businessHours: BusinessHours;
};

export function calendarFor(
  policy: SlaPolicy,
  around: Date,
  extraHolidays: readonly string[] = [],
): BusinessCalendar {
  const y = around.getUTCFullYear();
  const base = defaultCalendar([y - 1, y, y + 1], extraHolidays);
  return { ...base, ...policy.businessHours, holidays: base.holidays };
}

export function computeSlaDues(
  createdAt: Date,
  policy: SlaPolicy,
  extraHolidays: readonly string[] = [],
) {
  const cal = calendarFor(policy, createdAt, extraHolidays);
  return {
    slaFirstResponseDue: addBusinessMinutes(createdAt, policy.firstResponseMinutes, cal),
    slaResolutionDue: addBusinessMinutes(createdAt, policy.resolutionMinutes, cal),
  };
}

export type SlaView = {
  /** cumplido | incumplido (ya resuelto) · en_curso | en_riesgo | vencido (abierto) */
  state: "cumplido" | "incumplido" | "en_curso" | "en_riesgo" | "vencido" | "pausado";
  signal: "a_tiempo" | "en_riesgo" | "atrasada";
  /** Vencimiento relevante ahora (respuesta inicial si aún no hay, si no resolución). */
  due: Date;
  target: "primera_respuesta" | "resolucion";
  label: string;
};

/**
 * Estado del SLA para mostrar en la UI. "En riesgo" cuando queda menos del 25 % del plazo.
 * Con el ticket "respondido" el reloj queda en pausa (se espera al solicitante).
 */
export function slaView(
  t: {
    status: TicketStatus;
    createdAt: Date;
    firstResponseAt: Date | null;
    resolvedAt: Date | null;
    slaFirstResponseDue: Date;
    slaResolutionDue: Date;
  },
  now: Date,
): SlaView {
  if (t.resolvedAt && (t.status === "cerrado" || t.status === "respondido")) {
    const met = t.resolvedAt <= t.slaResolutionDue;
    return {
      state: t.status === "respondido" ? "pausado" : met ? "cumplido" : "incumplido",
      signal: met ? "a_tiempo" : "atrasada",
      due: t.slaResolutionDue,
      target: "resolucion",
      label: met ? "Resuelta dentro del plazo" : "Resuelta fuera del plazo",
    };
  }
  const target = t.firstResponseAt ? "resolucion" : "primera_respuesta";
  const due = target === "primera_respuesta" ? t.slaFirstResponseDue : t.slaResolutionDue;
  const total = Math.max(due.getTime() - t.createdAt.getTime(), 1);
  const left = due.getTime() - now.getTime();
  if (left < 0) {
    return {
      state: "vencido",
      signal: "atrasada",
      due,
      target,
      label: target === "primera_respuesta" ? "Sin respuesta a tiempo" : "Plazo vencido",
    };
  }
  const risk = left / total < 0.25;
  return {
    state: risk ? "en_riesgo" : "en_curso",
    signal: risk ? "en_riesgo" : "a_tiempo",
    due,
    target,
    label: target === "primera_respuesta" ? "Primera respuesta" : "Solución",
  };
}

/** Minutos hábiles que quedan (para contadores en horas hábiles). */
export function businessMinutesLeft(
  due: Date,
  now: Date,
  policy: SlaPolicy,
  extraHolidays: readonly string[] = [],
) {
  return businessMinutesBetween(now, due, calendarFor(policy, now, extraHolidays));
}
