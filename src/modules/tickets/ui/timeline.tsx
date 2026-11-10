import {
  ArrowUpDown,
  CircleDot,
  FilePlus2,
  Lock,
  MessageSquare,
  RefreshCw,
  Star,
  Timer,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { formatDateTime } from "@/shared/lib/dates";
import type { TicketStatus } from "@/shared/db/schema/enums";
import { TICKET_STATUS_LABEL } from "../domain/ticket-state";
import type { TimelineEntry } from "../infrastructure/ticket-queries";

/**
 * Línea de tiempo del ticket construida desde la auditoría (sección 9):
 * quién hizo qué y cuándo, en lenguaje humano.
 */
type Describe = { icon: LucideIcon; text: string };

function describe(e: TimelineEntry, names: Record<string, string>): Describe {
  const after = (e.after ?? {}) as Record<string, unknown>;
  const before = (e.before ?? {}) as Record<string, unknown>;
  switch (e.action) {
    case "ticket.created":
      return { icon: FilePlus2, text: "creó la solicitud" };
    case "ticket.assigned": {
      const id = after.assigneeId as string | null;
      return {
        icon: UserCheck,
        text: id ? `la asignó a ${names[id] ?? "alguien del equipo"}` : "quitó el responsable",
      };
    }
    case "ticket.status_changed":
      return {
        icon: RefreshCw,
        text: `cambió el estado de "${TICKET_STATUS_LABEL[before.status as TicketStatus] ?? "—"}" a "${TICKET_STATUS_LABEL[after.status as TicketStatus] ?? "—"}"`,
      };
    case "ticket.priority_changed":
      return {
        icon: ArrowUpDown,
        text: `cambió la prioridad de ${String(before.priority ?? "—")} a ${String(after.priority ?? "—")}`,
      };
    case "ticket.replied":
      return {
        icon: MessageSquare,
        text: after.status ? "respondió y la solicitud volvió a estar en progreso" : "respondió",
      };
    case "ticket.internal_note_added":
      return { icon: Lock, text: "dejó una nota interna" };
    case "ticket.rated":
      return { icon: Star, text: `calificó la atención con ${String(after.rating)} de 5` };
    case "ticket.auto_closed":
      return { icon: Timer, text: "se cerró automáticamente por inactividad" };
    default:
      return { icon: CircleDot, text: e.action };
  }
}

export function Timeline({
  entries,
  names,
}: {
  entries: TimelineEntry[];
  names: Record<string, string>;
}) {
  return (
    <ol className="relative flex flex-col gap-4 before:absolute before:top-2 before:bottom-2 before:left-[11px] before:w-px before:bg-border">
      {entries.map((e) => {
        const d = describe(e, names);
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
              <d.icon aria-hidden="true" className="size-3" />
            </span>
            <div className="flex min-w-0 flex-col pt-0.5">
              <p className="text-sm leading-snug">
                <span className="font-medium">{e.actorName ?? "El sistema"}</span>{" "}
                <span className="text-muted-foreground">{d.text}</span>
              </p>
              <time dateTime={e.at} className="tabular text-xs text-muted-foreground">
                {formatDateTime(e.at)}
              </time>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
