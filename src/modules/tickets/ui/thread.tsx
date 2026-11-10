"use client";

import { Lock, Paperclip, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Avatar, AvatarFallback } from "@/shared/ui/components/avatar";
import { Button } from "@/shared/ui/components/button";
import { Label } from "@/shared/ui/components/label";
import { Spinner } from "@/shared/ui/components/spinner";
import { Switch } from "@/shared/ui/components/switch";
import { Textarea } from "@/shared/ui/components/textarea";
import { FileDropzone } from "@/shared/ui/file-dropzone";
import { RelativeTime } from "@/shared/ui/relative-time";
import { initials } from "@/shared/ui/shell/user-menu";
import type { TicketDetail } from "../infrastructure/ticket-queries";
import { replyTicketAction } from "./actions";
import { AttachmentList } from "./attachment-list";

type Message = TicketDetail["messages"][number];

function Bubble({ m, now, requesterId }: { m: Message; now: string; requesterId: string }) {
  const mine = m.author.id === requesterId;
  return (
    <li className="flex gap-3">
      <Avatar className="size-8">
        <AvatarFallback
          className={cn(
            "text-xs font-semibold",
            mine ? "bg-muted" : "bg-secondary text-secondary-foreground",
          )}
        >
          {initials(m.author.name)}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-3.5",
          m.internal && "border-risk-fill/50 bg-risk-soft/60",
        )}
      >
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-medium">{m.author.name}</span>
          <span className="text-xs text-muted-foreground">{m.author.role}</span>
          {m.internal && (
            <span className="inline-flex items-center gap-1 text-xs font-medium text-risk">
              <Lock aria-hidden="true" className="size-3" />
              Nota interna (el solicitante no la ve)
            </span>
          )}
          <RelativeTime
            date={m.createdAt}
            now={now}
            className="ml-auto text-xs text-muted-foreground"
          />
        </div>
        <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">{m.body}</p>
        <AttachmentList files={m.attachments} />
      </div>
    </li>
  );
}

export function Thread({ ticket, now }: { ticket: TicketDetail; now: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [internal, setInternal] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [showFiles, setShowFiles] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const send = () => {
    if (!body.trim()) {
      setError("Escribe un mensaje.");
      return;
    }
    const fd = new FormData();
    fd.set("payload", JSON.stringify({ ticketId: ticket.id, code: ticket.code, body, internal }));
    for (const f of files) fd.append("archivos", f);
    start(async () => {
      setError(null);
      const r = await replyTicketAction(fd);
      if (!r.ok) {
        setError(r.error.message);
        return;
      }
      setBody("");
      setFiles([]);
      setShowFiles(false);
      toast.success(internal ? "Nota interna guardada." : "Mensaje enviado.");
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="hilo" className="flex flex-col gap-4">
      <h2 id="hilo" className="text-base font-semibold">
        Conversación
      </h2>
      {ticket.messages.length === 0 ? (
        <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          Aún no hay mensajes.{" "}
          {ticket.viewer.kind === "requester"
            ? "Te avisaremos cuando el equipo responda."
            : "Sé el primero en responder."}
        </p>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Mensajes">
          {ticket.messages.map((m) => (
            <Bubble key={m.id} m={m} now={now} requesterId={ticket.requester.id} />
          ))}
        </ol>
      )}

      {ticket.viewer.canReply ? (
        <div
          className={cn(
            "flex flex-col gap-3 rounded-xl border bg-card p-3",
            internal && "border-risk-fill/60 bg-risk-soft/40",
          )}
        >
          <Label htmlFor="respuesta" className="sr-only">
            {internal ? "Nota interna" : "Tu respuesta"}
          </Label>
          <Textarea
            id="respuesta"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) send();
            }}
            rows={3}
            maxLength={5000}
            placeholder={
              internal
                ? "Escribe una nota para el equipo (el solicitante no la verá)…"
                : "Escribe tu respuesta…"
            }
            aria-invalid={!!error}
            className="min-h-20 resize-y border-0 bg-transparent p-1 shadow-none focus-visible:ring-0"
          />
          {showFiles && (
            <FileDropzone
              files={files}
              onChange={setFiles}
              maxFiles={5}
              compact
              label="Adjuntos del mensaje"
            />
          )}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowFiles((v) => !v)}
              aria-expanded={showFiles}
            >
              <Paperclip data-icon="inline-start" aria-hidden="true" />
              Adjuntar{files.length ? ` (${files.length})` : ""}
            </Button>
            {ticket.viewer.canInternalNote && (
              <div className="flex items-center gap-2">
                <Switch id="interna" checked={internal} onCheckedChange={setInternal} />
                <Label htmlFor="interna" className="text-sm font-normal">
                  Nota interna
                </Label>
              </div>
            )}
            <span className="ml-auto hidden text-xs text-muted-foreground sm:inline">
              Ctrl + Enter para enviar
            </span>
            <Button type="button" onClick={send} disabled={pending}>
              {pending ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <Send data-icon="inline-start" aria-hidden="true" />
              )}
              {internal ? "Guardar nota" : "Enviar"}
            </Button>
          </div>
        </div>
      ) : (
        ticket.status === "cerrado" && (
          <p className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Esta solicitud está cerrada.{" "}
            {ticket.viewer.transitions.some((t) => t.to === "reabierto") &&
              "Si el problema volvió, puedes reabrirla."}
          </p>
        )
      )}
    </section>
  );
}
