import { createLoader, parseAsArrayOf, parseAsString, parseAsStringLiteral } from "nuqs/server";
import { PRIORITIES, TICKET_STATUSES } from "@/shared/db/schema/enums";

/** Filtros de bandejas de tickets en la URL (compartibles y con historial del navegador). */
export const ticketSearchParams = {
  estado: parseAsArrayOf(parseAsStringLiteral(TICKET_STATUSES)).withDefault([]),
  prioridad: parseAsArrayOf(parseAsStringLiteral(PRIORITIES)).withDefault([]),
  categoria: parseAsString,
  asignado: parseAsString,
  q: parseAsString.withDefault(""),
  orden: parseAsStringLiteral(["recientes", "antiguos", "vencimiento"] as const).withDefault(
    "recientes",
  ),
  cursor: parseAsString,
};

export const loadTicketSearchParams = createLoader(ticketSearchParams);
