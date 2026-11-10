"use client";

import { CircleCheckBig, RotateCcw, Star } from "lucide-react";
import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogClose,
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
import { Spinner } from "@/shared/ui/components/spinner";
import { Textarea } from "@/shared/ui/components/textarea";
import type { TicketDetail } from "../infrastructure/ticket-queries";
import {
  assignTicketAction,
  changePriorityAction,
  changeStatusAction,
  rateTicketAction,
} from "./actions";
import { PRIORITY_LABEL, StatusBadge } from "./badges";

/** Estado con actualización optimista y reversión si falla (sección 8). */
export function StatusControl({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(ticket.status);
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<TicketStatus | null>(null);

  const apply = (to: TicketStatus) =>
    start(async () => {
      setOptimistic(to);
      const r = await changeStatusAction({ ticketId: ticket.id, code: ticket.code, to });
      if (!r.ok) {
        toast.error(r.error.message);
        return; // useOptimistic vuelve solo al estado real
      }
      toast.success(
        to === "cerrado"
          ? "Solicitud cerrada."
          : to === "reabierto"
            ? "Solicitud reabierta."
            : "Estado actualizado.",
      );
      router.refresh();
    });

  const isRequester = ticket.viewer.kind === "requester";
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Estado</span>
        <StatusBadge status={optimistic} />
      </div>
      {ticket.viewer.transitions.length > 0 && (
        <div className="flex flex-col gap-2">
          {ticket.viewer.transitions.map((t) => {
            const primary =
              (isRequester && t.to === "cerrado") || (!isRequester && t.to === "respondido");
            const label =
              isRequester && t.to === "cerrado"
                ? "Marcar como resuelta"
                : isRequester && t.to === "en_progreso"
                  ? "Aún no está resuelta"
                  : t.label;
            return (
              <Button
                key={t.to}
                variant={primary ? "default" : "outline"}
                className="w-full justify-center"
                disabled={pending}
                onClick={() =>
                  t.to === "cerrado" || t.to === "reabierto" ? setConfirm(t.to) : apply(t.to)
                }
              >
                {t.to === "cerrado" && (
                  <CircleCheckBig data-icon="inline-start" aria-hidden="true" />
                )}
                {t.to === "reabierto" && <RotateCcw data-icon="inline-start" aria-hidden="true" />}
                {label}
              </Button>
            );
          })}
        </div>
      )}
      <Dialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "cerrado" ? "¿Cerrar la solicitud?" : "¿Reabrir la solicitud?"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "cerrado"
                ? isRequester
                  ? "Confirmas que el problema quedó resuelto. Podrás reabrirla durante los próximos días si vuelve a pasar."
                  : "La solicitud se cerrará y se le avisará al solicitante."
                : "Volverá a la bandeja del equipo para que la revisen de nuevo."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancelar</Button>
            </DialogClose>
            <Button
              onClick={() => {
                const to = confirm;
                setConfirm(null);
                if (to) apply(to);
              }}
            >
              {confirm === "cerrado" ? "Sí, cerrar" : "Sí, reabrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AssignControl({
  ticket,
  staff,
}: {
  ticket: TicketDetail;
  staff: { id: string; name: string; role: string }[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic(ticket.assignee?.id ?? "none");
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="responsable" className="text-sm text-muted-foreground">
        Responsable
      </label>
      <Select
        value={value}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            setValue(v);
            const r = await assignTicketAction({
              ticketId: ticket.id,
              code: ticket.code,
              assigneeId: v === "none" ? null : v,
            });
            if (!r.ok) {
              toast.error(r.error.message);
              return;
            }
            toast.success(v === "none" ? "Se quitó el responsable." : "Solicitud asignada.");
            router.refresh();
          })
        }
      >
        <SelectTrigger id="responsable" className="w-full">
          <SelectValue placeholder="Sin asignar" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="none">Sin asignar</SelectItem>
            {staff.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name} <span className="text-muted-foreground">· {p.role}</span>
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

export function PriorityControl({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [value, setValue] = useOptimistic<Priority>(ticket.priority);
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor="prioridad" className="text-sm text-muted-foreground">
        Prioridad
      </label>
      <Select
        value={value}
        disabled={pending}
        onValueChange={(v) =>
          start(async () => {
            setValue(v as Priority);
            const r = await changePriorityAction({
              ticketId: ticket.id,
              code: ticket.code,
              priority: v as Priority,
            });
            if (!r.ok) {
              toast.error(r.error.message);
              return;
            }
            toast.success("Prioridad actualizada. Recalculamos los plazos.");
            router.refresh();
          })
        }
      >
        <SelectTrigger id="prioridad" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {(["alta", "media", "baja"] as const).map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

/** Calificación de la atención (HU-12). */
export function RatingControl({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [rating, setRating] = useState(ticket.rating ?? 0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState(ticket.ratingComment ?? "");
  const [pending, start] = useTransition();
  const readOnly = !ticket.viewer.canRate;
  if (readOnly && !ticket.rating) return null;

  const save = () =>
    start(async () => {
      const r = await rateTicketAction({
        ticketId: ticket.id,
        code: ticket.code,
        rating,
        comment: comment || undefined,
      });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      toast.success("¡Gracias por calificar la atención!");
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        {readOnly ? "Calificación del solicitante" : "¿Cómo te atendimos?"}
      </p>
      <div role="radiogroup" aria-label="Calificación de 1 a 5" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} de 5`}
            disabled={readOnly || pending}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(n)}
            className="rounded p-0.5 transition-transform enabled:hover:scale-110 disabled:cursor-default"
          >
            <Star
              aria-hidden="true"
              className={cn(
                "size-6 transition-colors",
                n <= (hover || rating)
                  ? "fill-risk-fill text-risk-fill"
                  : "text-muted-foreground/50",
              )}
            />
          </button>
        ))}
      </div>
      {readOnly ? (
        ticket.ratingComment && (
          <p className="text-sm text-muted-foreground italic">“{ticket.ratingComment}”</p>
        )
      ) : (
        <>
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Comentario (opcional)"
            aria-label="Comentario de la calificación"
          />
          <Button size="sm" onClick={save} disabled={!rating || pending}>
            {pending && <Spinner data-icon="inline-start" />}
            {ticket.rating ? "Actualizar calificación" : "Enviar calificación"}
          </Button>
        </>
      )}
    </div>
  );
}
