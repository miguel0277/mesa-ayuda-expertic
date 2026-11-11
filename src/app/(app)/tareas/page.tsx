import { Columns3, List } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { myBoard, myProgress } from "@/modules/tasks/infrastructure/task-queries";
import { KanbanBoard } from "@/modules/tasks/ui/kanban-board";
import { ProgressSummary } from "@/modules/tasks/ui/progress-summary";
import { TaskList } from "@/modules/tasks/ui/task-list";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { cn } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Mis tareas" };

export default async function MisTareasPage({ searchParams }: PageProps<"/tareas">) {
  const viewer = await requireRoute("/tareas");
  const vista = (await searchParams).vista === "lista" ? "lista" : "tablero";
  const db = getDb();
  const now = new Date();
  const [{ items }, progress] = await Promise.all([
    myBoard(db, viewer, now),
    myProgress(db, viewer.id, now),
  ]);

  return (
    <>
      <PageHeader
        title="Mis tareas"
        description="Lo que te asignaron, con su fecha límite. Arrastra las tarjetas para cambiar su estado."
        actions={
          <div
            role="tablist"
            aria-label="Vista"
            className="inline-flex rounded-lg border bg-card p-0.5"
          >
            {[
              { key: "tablero", label: "Tablero", icon: Columns3 },
              { key: "lista", label: "Lista", icon: List },
            ].map((v) => (
              <Link
                key={v.key}
                role="tab"
                aria-selected={vista === v.key}
                href={v.key === "tablero" ? "/tareas" : "/tareas?vista=lista"}
                className={cn(
                  "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:text-foreground",
                  vista === v.key && "bg-secondary font-medium text-secondary-foreground",
                )}
              >
                <v.icon aria-hidden="true" className="size-4" />
                {v.label}
              </Link>
            ))}
          </div>
        }
      />
      <div className="flex flex-col gap-6">
        <ProgressSummary month={progress.month} streak={progress.streak} signal={progress.signal} />
        {vista === "tablero" ? (
          <KanbanBoard tasks={items} now={now.toISOString()} />
        ) : (
          <TaskList tasks={items} now={now.toISOString()} />
        )}
      </div>
    </>
  );
}
