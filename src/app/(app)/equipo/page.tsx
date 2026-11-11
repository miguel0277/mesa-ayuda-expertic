import { Activity, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  assignableForTasks,
  listTasks,
  teamOverview,
} from "@/modules/tasks/infrastructure/task-queries";
import { CreateTaskDialog } from "@/modules/tasks/ui/create-task-dialog";
import { TaskList } from "@/modules/tasks/ui/task-list";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { formatDateTime } from "@/shared/lib/dates";
import { Avatar, AvatarFallback } from "@/shared/ui/components/avatar";
import { EmptyState, PageHeader } from "@/shared/ui/states";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";
import { initials } from "@/shared/ui/shell/user-menu";

export const metadata: Metadata = { title: "Mi equipo" };

const FEED: Record<string, string> = {
  "task.created": "recibió",
  "task.status_changed": "movió",
  "task.evidence_added": "agregó evidencia a",
  "task.completed": "completó",
  "task.cancelled": "canceló",
  "task.reassigned": "reasignó",
};

/** Panel del auxiliar líder (HU-30, HU-31): avance de cada integrante y delegación. */
export default async function EquipoPage() {
  const viewer = await requireRoute("/equipo");
  const db = getDb();
  const now = new Date();
  const [overview, assignable, teamTasks] = await Promise.all([
    teamOverview(db, viewer.leadTeamIds, now),
    assignableForTasks(db, viewer),
    listTasks(db, viewer, { status: ["pendiente", "en_progreso"] }, now),
  ]);

  if (!viewer.leadTeamIds.length) {
    return (
      <>
        <PageHeader
          title="Mi equipo"
          description="Aquí verás el avance de los auxiliares a tu cargo."
        />
        <EmptyState
          icon={Users}
          title="Aún no lideras un equipo"
          description="El docente ExperTIC arma los equipos de cada semestre. Cuando te asigne uno, verás aquí a sus integrantes."
        />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mi equipo"
        description={`${overview.teams.map((t) => `${t.name} (${t.semester})`).join(", ")}. Así va cada integrante hoy.`}
        actions={<CreateTaskDialog people={assignable.people} teams={assignable.teams} />}
      />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.members.map((m) => (
              <li key={m.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-center gap-3">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-secondary text-sm font-semibold text-secondary-foreground">
                      {initials(m.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{m.name}</span>
                    <span className="text-xs text-muted-foreground">{m.role}</span>
                  </div>
                  {m.signal ? (
                    <StatusSignal signal={m.signal} />
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin pendientes</span>
                  )}
                </div>
                <dl className="grid grid-cols-3 gap-2 text-center">
                  {[
                    {
                      label: "Cumplimiento",
                      value: m.compliance.pct === null ? "—" : `${m.compliance.pct} %`,
                    },
                    { label: "Abiertas", value: m.compliance.open },
                    {
                      label: "Vencidas",
                      value: m.compliance.overdue,
                      late: m.compliance.overdue > 0,
                    },
                  ].map((k) => (
                    <div key={k.label} className="rounded-lg bg-muted/50 px-2 py-2">
                      <dt className="text-xs text-muted-foreground">{k.label}</dt>
                      <dd className={`tabular text-lg font-semibold ${k.late ? "text-late" : ""}`}>
                        {k.value}
                      </dd>
                    </div>
                  ))}
                </dl>
                {m.next ? (
                  <Link
                    href={`/tareas/${m.next.code}`}
                    className="flex flex-col gap-1.5 rounded-lg border p-2.5 hover:bg-accent"
                  >
                    <span className="truncate text-xs">
                      <span className="text-muted-foreground">Próxima: </span>
                      {m.next.title}
                    </span>
                    {m.next.dueAt && m.next.signal && (
                      <TimeRail
                        start={new Date(m.next.createdAt)}
                        due={new Date(m.next.dueAt)}
                        now={now}
                        signal={m.next.signal}
                      />
                    )}
                  </Link>
                ) : (
                  <p className="text-xs text-muted-foreground">No tiene tareas abiertas.</p>
                )}
              </li>
            ))}
          </ul>
          <section className="flex flex-col gap-3">
            <h2 className="text-base font-semibold">Tareas abiertas del equipo</h2>
            <TaskList tasks={teamTasks} now={now.toISOString()} showAssignee />
          </section>
        </div>
        <aside className="flex flex-col gap-3 rounded-xl border bg-card p-4 xl:sticky xl:top-20 xl:self-start">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Activity aria-hidden="true" className="size-4 text-muted-foreground" />
            Actividad reciente
          </h2>
          {overview.feed.length ? (
            <ol className="flex flex-col gap-3">
              {overview.feed.map((f) => (
                <li key={f.id} className="text-sm">
                  <span className="font-medium">{f.actorName ?? "El sistema"}</span>{" "}
                  <span className="text-muted-foreground">{FEED[f.action] ?? f.action}</span>{" "}
                  <Link href={`/tareas/${f.code}`} className="code-id text-primary hover:underline">
                    {f.code}
                  </Link>
                  <time dateTime={f.at} className="tabular block text-xs text-muted-foreground">
                    {formatDateTime(f.at)}
                  </time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-muted-foreground">Sin movimientos todavía.</p>
          )}
        </aside>
      </div>
    </>
  );
}
