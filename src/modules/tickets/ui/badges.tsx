import {
  ArrowDown,
  ArrowUp,
  CircleCheckBig,
  CircleDot,
  CirclePlay,
  Equal,
  MessageCircleReply,
  RotateCcw,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/badge";
import { CategoryIcon } from "@/shared/ui/category-icon";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";
import { TICKET_STATUS_LABEL } from "../domain/ticket-state";

const STATUS: Record<TicketStatus, { icon: LucideIcon; cls: string }> = {
  abierto: { icon: CircleDot, cls: "border-primary/30 bg-secondary text-secondary-foreground" },
  asignado: { icon: UserCheck, cls: "border-border bg-card text-foreground" },
  en_progreso: { icon: CirclePlay, cls: "border-transparent bg-progress-soft text-progress" },
  respondido: { icon: MessageCircleReply, cls: "border-transparent bg-ok-soft text-ok" },
  cerrado: { icon: CircleCheckBig, cls: "border-transparent bg-muted text-muted-foreground" },
  reabierto: { icon: RotateCcw, cls: "border-transparent bg-risk-soft text-risk" },
};

export function StatusBadge({ status, className }: { status: TicketStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 px-2", s.cls, className)}>
      <s.icon aria-hidden="true" data-icon="inline-start" />
      {TICKET_STATUS_LABEL[status]}
    </Badge>
  );
}

const PRIORITY: Record<Priority, { icon: LucideIcon; label: string; cls: string }> = {
  alta: { icon: ArrowUp, label: "Alta", cls: "bg-late-soft text-late" },
  media: { icon: Equal, label: "Media", cls: "bg-risk-soft text-risk" },
  baja: { icon: ArrowDown, label: "Baja", cls: "bg-muted text-muted-foreground" },
};

export const PRIORITY_LABEL: Record<Priority, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  const p = PRIORITY[priority];
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2", p.cls, className)}>
      <p.icon aria-hidden="true" data-icon="inline-start" />
      <span className="sr-only">Prioridad </span>
      {p.label}
    </Badge>
  );
}

/** Mosaico de categoría: ícono sobre el color de la categoría (con texto para lectores de pantalla). */
export function CategoryTile({
  icon,
  color,
  name,
  size = "md",
}: {
  icon: string;
  color: string;
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg",
        size === "sm" && "size-7 [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-4",
        size === "lg" && "size-11 rounded-xl [&_svg]:size-5",
      )}
      style={{
        backgroundColor: `color-mix(in oklab, ${color} 14%, transparent)`,
        color: `color-mix(in oklab, ${color} 85%, var(--foreground))`,
      }}
      title={name}
    >
      <CategoryIcon name={icon} aria-hidden="true" />
      <span className="sr-only">{name}</span>
    </span>
  );
}
