import {
  CircleCheckBig,
  CircleDashed,
  CirclePlay,
  CircleSlash,
  type LucideIcon,
} from "lucide-react";
import type { TaskStatus } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/badge";
import { TASK_STATUS_LABEL } from "../domain/task-state";

const STATUS: Record<TaskStatus, { icon: LucideIcon; cls: string }> = {
  pendiente: { icon: CircleDashed, cls: "bg-muted text-foreground" },
  en_progreso: { icon: CirclePlay, cls: "bg-progress-soft text-progress" },
  completada: { icon: CircleCheckBig, cls: "bg-ok-soft text-ok" },
  cancelada: { icon: CircleSlash, cls: "bg-muted text-muted-foreground line-through" },
};

export function TaskStatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  const s = STATUS[status];
  return (
    <Badge variant="outline" className={cn("h-6 gap-1 border-transparent px-2", s.cls, className)}>
      <s.icon aria-hidden="true" data-icon="inline-start" />
      {TASK_STATUS_LABEL[status]}
    </Badge>
  );
}

export const TASK_STATUS_ICON = Object.fromEntries(
  Object.entries(STATUS).map(([k, v]) => [k, v.icon]),
) as Record<TaskStatus, LucideIcon>;
