import { ArrowLeft, CalendarClock, Link2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { assignableForTasks, taskDetail } from "@/modules/tasks/infrastructure/task-queries";
import { TaskActions } from "@/modules/tasks/ui/task-actions";
import { TaskStatusBadge } from "@/modules/tasks/ui/task-bits";
import { AttachmentList } from "@/modules/tickets/ui/attachment-list";
import { PriorityBadge } from "@/modules/tickets/ui/badges";
import { requireViewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { formatDateTime } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/components/button";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";

// Metadata estática: con Cache Components, leer `params` aquí bloquearía el prerenderizado.
export const metadata: Metadata = { title: "Detalle de la tarea" };

const ACTIONS: Record<string, string> = {
  "task.created": "creó y asignó la tarea",
  "task.status_changed": "cambió el estado",
  "task.evidence_added": "agregó evidencia",
  "task.completed": "completó la tarea",
  "task.cancelled": "canceló la tarea",
  "task.reassigned": "reasignó la tarea",
};

export default async function TaskDetailPage({ params }: PageProps<"/tareas/[code]">) {
  const viewer = await requireViewer();
  const { code } = await params;
  if (!/^TAR-\d{4}-\d{5}$/i.test(code)) notFound();
  const db = getDb();
  const now = new Date();
  const t = await taskDetail(db, viewer, code, now);
  if (!t) notFound();
  const { people } = t.viewer.canReassign ? await assignableForTasks(db, viewer) : { people: [] };
  const back = t.viewer.isAssignee
    ? "/tareas"
    : viewer.role === "lider"
      ? "/equipo"
      : "/panel/tareas";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
          <Link href={back}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Volver
          </Link>
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          <span className="code-id text-muted-foreground">{t.code}</span>
          <TaskStatusBadge status={t.status} />
          <PriorityBadge priority={t.priority} />
        </div>
        <h1 className="text-2xl font-semibold text-pretty">{t.title}</h1>
        <p className="text-sm text-muted-foreground">
          Asignada por <span className="font-medium text-foreground">{t.assignedBy.name}</span> a{" "}
          <span className="font-medium text-foreground">{t.assignee?.name ?? "nadie"}</span> el{" "}
          <span className="tabular">{formatDateTime(t.createdAt)}</span>
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {t.description && (
            <section className="rounded-xl border bg-card p-4">
              <p className="text-[0.9375rem] leading-relaxed whitespace-pre-wrap">
                {t.description}
              </p>
            </section>
          )}
          {t.ticket && (
            <Link
              href={`/solicitudes/${t.ticket.code}`}
              className="flex items-center gap-2 rounded-xl border bg-card p-3 text-sm hover:bg-accent"
            >
              <Link2 aria-hidden="true" className="size-4 text-muted-foreground" />
              Vinculada a <span className="code-id">{t.ticket.code}</span>
              <span className="truncate text-muted-foreground">{t.ticket.title}</span>
            </Link>
          )}
          <section aria-labelledby="evidencia" className="flex flex-col gap-3">
            <h2 id="evidencia" className="text-base font-semibold">
              Evidencia{" "}
              {t.requiresEvidence && (
                <span className="text-sm font-normal text-muted-foreground">
                  (obligatoria para completar)
                </span>
              )}
            </h2>
            {t.evidenceItems.length ? (
              <ol className="flex flex-col gap-3">
                {t.evidenceItems.map((e) => (
                  <li key={e.id} className="flex flex-col gap-2 rounded-xl border bg-card p-3.5">
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{e.authorName}</span> ·{" "}
                      <span className="tabular">{formatDateTime(e.createdAt)}</span>
                    </p>
                    {e.note && <p className="text-sm whitespace-pre-wrap">{e.note}</p>}
                    <AttachmentList files={e.files} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="rounded-xl border border-dashed bg-card px-4 py-6 text-center text-sm text-muted-foreground">
                Aún no hay evidencia.{" "}
                {t.viewer.isAssignee ? "Agrega una nota o un archivo cuando avances." : ""}
              </p>
            )}
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Fecha límite</h2>
            {t.dueAt && t.signal && (t.status === "pendiente" || t.status === "en_progreso") ? (
              <TimeRail
                start={new Date(t.startedAt ?? t.createdAt)}
                due={new Date(t.dueAt)}
                now={now}
                signal={t.signal}
              />
            ) : t.status === "completada" && t.signal ? (
              <StatusSignal
                signal={t.signal}
                label={t.signal === "a_tiempo" ? "Cumplida a tiempo" : "Cumplida tarde"}
              />
            ) : null}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarClock aria-hidden="true" className="size-3.5" />
              {t.dueAt ? (
                <span className="tabular">{formatDateTime(t.dueAt)}</span>
              ) : (
                "Sin fecha límite"
              )}
            </p>
          </section>
          {(t.viewer.transitions.length > 0 || t.viewer.canReassign || t.viewer.isAssignee) && (
            <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Acciones</h2>
              <TaskActions task={t} people={people} />
            </section>
          )}
          <section className="flex flex-col gap-3 rounded-xl border bg-card p-4">
            <h2 className="text-sm font-semibold">Historial</h2>
            <ol className="flex flex-col gap-3">
              {t.history.map((h) => (
                <li key={h.id} className="text-sm">
                  <span className="font-medium">{h.actorName ?? "El sistema"}</span>{" "}
                  <span className="text-muted-foreground">{ACTIONS[h.action] ?? h.action}</span>
                  <time dateTime={h.at} className="tabular block text-xs text-muted-foreground">
                    {formatDateTime(h.at)}
                  </time>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  );
}
