"use client";

import { CircleCheckBig, CirclePlay, CircleSlash, Paperclip, RotateCcw, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { TaskStatus } from "@/shared/db/schema/enums";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/components/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Textarea } from "@/shared/ui/components/textarea";
import type { TaskDetailDTO } from "../infrastructure/task-queries";
import { changeTaskStatusAction, reassignTaskAction } from "./actions";
import { EvidenceDialog } from "./complete-dialog";

const ACTION: Record<TaskStatus, { label: string; icon: typeof CirclePlay }> = {
  en_progreso: { label: "Empezar", icon: CirclePlay },
  completada: { label: "Completar", icon: CircleCheckBig },
  pendiente: { label: "Volver a pendiente", icon: Undo2 },
  cancelada: { label: "Cancelar tarea", icon: CircleSlash },
};

export function TaskActions({
  task,
  people,
}: {
  task: TaskDetailDTO;
  people: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [evidence, setEvidence] = useState<null | "add" | "complete">(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");

  const go = (to: TaskStatus, why?: string) =>
    start(async () => {
      const r = await changeTaskStatusAction({ taskId: task.id, code: task.code, to, reason: why });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success(
        to === "cancelada"
          ? "Tarea cancelada."
          : to === "en_progreso" && task.status === "completada"
            ? "Tarea reabierta."
            : "Estado actualizado.",
      );
      router.refresh();
    });

  const open = task.status === "pendiente" || task.status === "en_progreso";
  return (
    <div className="flex flex-col gap-2">
      {task.viewer.transitions.map((to) => {
        const a = ACTION[to];
        const reopen = to === "en_progreso" && task.status === "completada";
        if (to === "completada")
          return (
            <Button
              key={to}
              onClick={() => (task.requiresEvidence ? setEvidence("complete") : go(to))}
              disabled={pending}
            >
              <a.icon data-icon="inline-start" aria-hidden="true" />
              {a.label}
            </Button>
          );
        if (to === "cancelada")
          return (
            <Button
              key={to}
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => setCancelOpen(true)}
              disabled={pending}
            >
              <a.icon data-icon="inline-start" aria-hidden="true" />
              {a.label}
            </Button>
          );
        return (
          <Button key={to} variant="outline" onClick={() => go(to)} disabled={pending}>
            {reopen ? (
              <RotateCcw data-icon="inline-start" aria-hidden="true" />
            ) : (
              <a.icon data-icon="inline-start" aria-hidden="true" />
            )}
            {reopen ? "Reabrir (falta algo)" : a.label}
          </Button>
        );
      })}
      {task.viewer.isAssignee && open && (
        <Button variant="outline" onClick={() => setEvidence("add")} disabled={pending}>
          <Paperclip data-icon="inline-start" aria-hidden="true" />
          Agregar evidencia
        </Button>
      )}

      {task.viewer.canReassign && people.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5">
          <label htmlFor="reasignar" className="text-sm text-muted-foreground">
            Responsable
          </label>
          <Select
            value={task.assignee?.id}
            onValueChange={(assigneeId) =>
              start(async () => {
                const r = await reassignTaskAction({
                  taskId: task.id,
                  code: task.code,
                  assigneeId,
                });
                if (!r.ok) {
                  toast.error(r.error.message);
                  return;
                }
                toast.success("Tarea reasignada.");
                router.refresh();
              })
            }
          >
            <SelectTrigger id="reasignar" className="w-full">
              <SelectValue placeholder="Elige a alguien" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                {people.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {evidence && (
        <EvidenceDialog
          task={task}
          open
          complete={evidence === "complete"}
          onOpenChange={(o) => !o && setEvidence(null)}
        />
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>¿Cancelar esta tarea?</DialogTitle>
            <DialogDescription>
              La persona asignada recibirá un aviso. Podrás reactivarla después.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Motivo (opcional)"
            aria-label="Motivo de la cancelación"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setCancelOpen(false);
                go("cancelada", reason || undefined);
              }}
            >
              Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
