"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { ClipboardList, Link2, Paperclip } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { PriorityBadge } from "@/modules/tickets/ui/badges";
import type { TaskStatus } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { spring } from "@/shared/ui/motion";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";
import { TASK_STATUS_LABEL } from "../domain/task-state";
import type { TaskCard } from "../infrastructure/task-queries";
import { changeTaskStatusAction } from "./actions";
import { EvidenceDialog } from "./complete-dialog";
import { TASK_STATUS_ICON } from "./task-bits";

const COLUMNS: TaskStatus[] = ["pendiente", "en_progreso", "completada"];

function Card({ task, now, dragging }: { task: TaskCard; now: string; dragging?: boolean }) {
  const due = task.dueAt ? new Date(task.dueAt) : null;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-card p-3 shadow-xs",
        dragging && "rotate-1 shadow-overlay ring-2 ring-primary/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="code-id text-muted-foreground">{task.code}</span>
        {task.priority !== "media" && <PriorityBadge priority={task.priority} className="h-5" />}
      </div>
      <Link
        href={`/tareas/${task.code}`}
        className="text-sm leading-snug font-medium hover:underline focus-visible:underline"
        draggable={false}
      >
        {task.title}
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        {task.ticket && (
          <span className="inline-flex items-center gap-1" title={task.ticket.title}>
            <Link2 aria-hidden="true" className="size-3" />
            {task.ticket.code}
          </span>
        )}
        {task.evidence > 0 && (
          <span className="inline-flex items-center gap-1">
            <Paperclip aria-hidden="true" className="size-3" />
            <span className="tabular">{task.evidence}</span> evidencia(s)
          </span>
        )}
        <span>Asignó: {task.assignedBy.name.split(" ").slice(0, 2).join(" ")}</span>
      </div>
      {due && task.status !== "completada" && task.signal && (
        <TimeRail
          start={new Date(task.startedAt ?? task.createdAt)}
          due={due}
          now={new Date(now)}
          signal={task.signal}
        />
      )}
      {!due && (task.status === "pendiente" || task.status === "en_progreso") && (
        <span className="text-xs text-muted-foreground">Sin fecha límite</span>
      )}
      {task.status === "completada" && task.signal && (
        <StatusSignal
          signal={task.signal}
          label={task.signal === "a_tiempo" ? "Cumplida a tiempo" : "Cumplida tarde"}
        />
      )}
    </div>
  );
}

function DraggableCard({ task, now }: { task: TaskCard; now: string }) {
  // La tarjeta original no se mueve (lo hace el DragOverlay); así no compite con la animación de layout.
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    data: { task },
  });
  return (
    <motion.li
      layout
      transition={spring.layout}
      ref={setNodeRef}
      className={cn("touch-none", isDragging && "opacity-40")}
      {...attributes}
      {...listeners}
      aria-roledescription="tarea arrastrable"
      aria-label={`${task.code}: ${task.title}. ${TASK_STATUS_LABEL[task.status]}. Usa espacio para tomarla y las flechas para moverla.`}
    >
      <Card task={task} now={now} />
    </motion.li>
  );
}

function Column({ status, tasks, now }: { status: TaskStatus; tasks: TaskCard[]; now: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const Icon = TASK_STATUS_ICON[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${TASK_STATUS_LABEL[status]}: ${tasks.length} tareas`}
      className={cn(
        "flex min-h-64 flex-col gap-3 rounded-xl border bg-muted/40 p-3 transition-colors",
        isOver && "border-primary bg-secondary/60",
      )}
    >
      <header className="flex items-center gap-2 px-1">
        <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h2>
        <span className="tabular ml-auto rounded-full bg-card px-2 text-xs text-muted-foreground">
          {tasks.length}
        </span>
      </header>
      {tasks.length ? (
        <ul className="flex flex-col gap-2">
          {tasks.map((t) => (
            <DraggableCard key={t.id} task={t} now={now} />
          ))}
        </ul>
      ) : (
        <p className="flex flex-1 items-center justify-center rounded-lg border border-dashed px-3 py-8 text-center text-xs text-muted-foreground">
          {status === "completada"
            ? "Arrastra aquí lo que termines."
            : status === "en_progreso"
              ? "Arrastra aquí lo que estés haciendo."
              : "No tienes tareas pendientes."}
        </p>
      )}
    </section>
  );
}

/**
 * Kanban del auxiliar (HU-20). Movimientos optimistas con reversión y aviso si fallan;
 * soltar en "Completada" abre el diálogo de evidencia cuando la tarea la exige.
 */
export function KanbanBoard({ tasks, now }: { tasks: TaskCard[]; now: string }) {
  const router = useRouter();
  const [, start] = useTransition();
  const [optimistic, move] = useOptimistic(
    tasks,
    (state, { id, to }: { id: string; to: TaskStatus }) =>
      state.map((t) => (t.id === id ? { ...t, status: to } : t)),
  );
  const [active, setActive] = useState<TaskCard | null>(null);
  const [completing, setCompleting] = useState<TaskCard | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const task = e.active.data.current?.task as TaskCard | undefined;
    const to = e.over?.id as TaskStatus | undefined;
    if (!task || !to || to === task.status) return;
    if (to === "completada" && task.requiresEvidence) {
      setCompleting(task);
      return;
    }
    start(async () => {
      move({ id: task.id, to });
      const r = await changeTaskStatusAction({ taskId: task.id, code: task.code, to });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success(`${task.code}: ${TASK_STATUS_LABEL[to].toLowerCase()}.`);
      router.refresh();
    });
  };

  if (!tasks.length) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border bg-card px-6 py-14 text-center">
        <ClipboardList aria-hidden="true" className="size-8 text-muted-foreground" />
        <p className="font-medium">No tienes tareas asignadas</p>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cuando el docente o tu líder te asignen algo, aparecerá aquí con su fecha límite.
        </p>
      </div>
    );
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        onDragStart={(e) => setActive((e.active.data.current?.task as TaskCard) ?? null)}
        onDragCancel={() => setActive(null)}
        onDragEnd={onDragEnd}
        accessibility={{
          screenReaderInstructions: {
            draggable:
              "Presiona espacio para tomar la tarea, usa las flechas para moverla y espacio de nuevo para soltarla.",
          },
          announcements: {
            onDragStart: ({ active: a }) =>
              `Tomaste ${(a.data.current?.task as TaskCard | undefined)?.code ?? "la tarea"}.`,
            onDragOver: ({ over }) =>
              over
                ? `Sobre la columna ${TASK_STATUS_LABEL[over.id as TaskStatus]}.`
                : "Fuera de las columnas.",
            onDragEnd: ({ over }) =>
              over
                ? `Soltaste en ${TASK_STATUS_LABEL[over.id as TaskStatus]}.`
                : "Se canceló el movimiento.",
            onDragCancel: () => "Se canceló el movimiento.",
          },
        }}
      >
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((s) => (
            <Column key={s} status={s} tasks={optimistic.filter((t) => t.status === s)} now={now} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 220, easing: "cubic-bezier(0.22, 1, 0.36, 1)" }}>
          {active ? <Card task={active} now={now} dragging /> : null}
        </DragOverlay>
      </DndContext>
      {completing && (
        <EvidenceDialog
          task={completing}
          open
          onOpenChange={(o) => !o && setCompleting(null)}
          onDone={() => setCompleting(null)}
        />
      )}
    </>
  );
}
