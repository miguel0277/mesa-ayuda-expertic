import { ClipboardList } from "lucide-react";
import Link from "next/link";
import { PriorityBadge } from "@/modules/tickets/ui/badges";
import { formatDateTime } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { EmptyState } from "@/shared/ui/states";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";
import type { TaskCard } from "../infrastructure/task-queries";
import { TaskStatusBadge } from "./task-bits";

/** Vista de lista de tareas (filas en escritorio, tarjetas en móvil). */
export function TaskList({
  tasks,
  now,
  showAssignee = false,
  empty,
}: {
  tasks: TaskCard[];
  now: string;
  showAssignee?: boolean;
  empty?: React.ReactNode;
}) {
  if (!tasks.length)
    return (
      <>
        {empty ?? (
          <EmptyState
            icon={ClipboardList}
            title="No hay tareas"
            description="Cuando haya tareas que cumplan los filtros, aparecerán aquí."
          />
        )}
      </>
    );
  const nowDate = new Date(now);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div
        className={cn(
          "hidden gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid",
          showAssignee
            ? "lg:grid-cols-[minmax(0,1fr)_10rem_9rem_14rem]"
            : "lg:grid-cols-[minmax(0,1fr)_9rem_14rem]",
        )}
      >
        <span>Tarea</span>
        {showAssignee && <span>Responsable</span>}
        <span>Estado</span>
        <span>Fecha límite</span>
      </div>
      <ul className="divide-y">
        {tasks.map((t) => (
          <li
            key={t.id}
            className={cn(
              "relative grid gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/60",
              showAssignee
                ? "lg:grid-cols-[minmax(0,1fr)_10rem_9rem_14rem]"
                : "lg:grid-cols-[minmax(0,1fr)_9rem_14rem]",
            )}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="code-id text-muted-foreground">{t.code}</span>
                {t.priority !== "media" && <PriorityBadge priority={t.priority} className="h-5" />}
              </div>
              <Link
                href={`/tareas/${t.code}`}
                className="truncate font-medium after:absolute after:inset-0"
              >
                {t.title}
              </Link>
              <p className="text-xs text-muted-foreground">
                Asignó {t.assignedBy.name}
                {t.ticket ? ` · ${t.ticket.code}` : ""}
              </p>
            </div>
            {showAssignee && (
              <div className="flex items-center text-sm">
                {t.assignee?.name ?? <span className="text-muted-foreground">Sin asignar</span>}
              </div>
            )}
            <div className="flex items-center">
              <TaskStatusBadge status={t.status} />
            </div>
            <div className="flex items-center">
              {t.dueAt && t.signal && (t.status === "pendiente" || t.status === "en_progreso") ? (
                <TimeRail
                  start={new Date(t.startedAt ?? t.createdAt)}
                  due={new Date(t.dueAt)}
                  now={nowDate}
                  signal={t.signal}
                  className="w-full"
                />
              ) : t.status === "completada" && t.signal ? (
                <StatusSignal
                  signal={t.signal}
                  label={t.signal === "a_tiempo" ? "Cumplida a tiempo" : "Cumplida tarde"}
                />
              ) : (
                <span className="text-xs text-muted-foreground">
                  {t.dueAt ? formatDateTime(t.dueAt) : "Sin fecha"}
                </span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
