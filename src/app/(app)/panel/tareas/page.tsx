import type { Metadata } from "next";
import Link from "next/link";
import type { Signal } from "@/modules/tasks/domain/compliance";
import { assignableForTasks, listTasks } from "@/modules/tasks/infrastructure/task-queries";
import { CreateTaskDialog } from "@/modules/tasks/ui/create-task-dialog";
import { TaskList } from "@/modules/tasks/ui/task-list";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import type { TaskStatus } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Tareas del equipo" };

const TABS: { key: string; label: string; status?: TaskStatus[]; signal?: Signal }[] = [
  { key: "abiertas", label: "Abiertas", status: ["pendiente", "en_progreso"] },
  {
    key: "atrasadas",
    label: "Atrasadas",
    status: ["pendiente", "en_progreso"],
    signal: "atrasada",
  },
  { key: "riesgo", label: "En riesgo", status: ["pendiente", "en_progreso"], signal: "en_riesgo" },
  { key: "completadas", label: "Completadas", status: ["completada"] },
  { key: "canceladas", label: "Canceladas", status: ["cancelada"] },
];

/** Tareas de todos los auxiliares (HU-42): crear, asignar y seguir. */
export default async function PanelTareasPage({ searchParams }: PageProps<"/panel/tareas">) {
  const viewer = await requireRoute("/panel/tareas");
  const sp = await searchParams;
  const tab = TABS.find((t) => t.key === sp.ver) ?? TABS[0]!;
  const q = typeof sp.q === "string" ? sp.q : undefined;
  const db = getDb();
  const now = new Date();
  const [tasks, assignable] = await Promise.all([
    listTasks(db, viewer, { status: tab.status, signal: tab.signal, q }, now),
    assignableForTasks(db, viewer),
  ]);

  return (
    <>
      <PageHeader
        title="Tareas del equipo"
        description="Asigna tareas a una persona o a un equipo y sigue su cumplimiento."
        actions={<CreateTaskDialog people={assignable.people} teams={assignable.teams} />}
      />
      <div className="flex flex-col gap-4">
        <nav aria-label="Filtro de tareas" className="flex gap-1 overflow-x-auto border-b">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "abiertas" ? "/panel/tareas" : `/panel/tareas?ver=${t.key}`}
              aria-current={t.key === tab.key ? "page" : undefined}
              className={cn(
                "-mb-px shrink-0 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground hover:text-foreground",
                t.key === tab.key && "border-primary font-medium text-foreground",
              )}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <TaskList tasks={tasks} now={now.toISOString()} showAssignee />
        <p className="tabular text-sm text-muted-foreground">{tasks.length} tarea(s)</p>
      </div>
    </>
  );
}
