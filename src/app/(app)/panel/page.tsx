import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { activeTeams, getDashboard, type Period } from "@/modules/reports/infrastructure/dashboard";
import { TicketsByTypeChart, TicketsByWeekChart } from "@/modules/reports/ui/charts";
import { DashboardFilters } from "@/modules/reports/ui/dashboard-filters";
import { assignableForTasks } from "@/modules/tasks/infrastructure/task-queries";
import { CreateTaskDialog } from "@/modules/tasks/ui/create-task-dialog";
import { CategoryTile, StatusBadge } from "@/modules/tickets/ui/badges";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { formatDate, formatRelative } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { AnimatedNumber } from "@/shared/ui/animated-number";
import { Avatar, AvatarFallback } from "@/shared/ui/components/avatar";
import { Skeleton } from "@/shared/ui/components/skeleton";
import { initials } from "@/shared/ui/shell/user-menu";
import { ListSkeleton, PageHeader } from "@/shared/ui/states";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";

export const metadata: Metadata = { title: "Panel de control" };

function Kpi({
  label,
  value,
  hint,
  tone,
  suffix,
  decimals,
}: {
  label: string;
  value: number | null;
  hint: string;
  tone?: "late" | "risk" | "ok";
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div className="flex flex-col gap-1 bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "tabular text-[1.75rem] leading-none font-semibold tracking-tight",
          tone === "late" && "text-late",
          tone === "risk" && "text-risk",
          tone === "ok" && "text-ok",
        )}
      >
        {value === null ? (
          "—"
        ) : (
          <AnimatedNumber value={value} suffix={suffix} decimals={decimals} />
        )}
      </p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

async function DashboardContent({ period, teamId }: { period: Period; teamId: string | null }) {
  const d = await getDashboard(period, teamId);
  const now = new Date(d.generatedAt);
  const k = d.kpis;
  return (
    <div className="flex flex-col gap-6">
      <section
        aria-label="Indicadores"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-6"
      >
        <Kpi label="Tareas activas" value={k.activeTasks} hint={`${k.overdue} atrasada(s)`} />
        <Kpi
          label="Cumplimiento"
          value={k.compliancePct}
          suffix=" %"
          decimals={k.compliancePct && k.compliancePct % 1 ? 1 : 0}
          hint={k.dueElapsed ? `${k.onTime} de ${k.dueElapsed} a tiempo` : "aún no vencen tareas"}
          tone={
            k.compliancePct === null
              ? undefined
              : k.compliancePct >= 85
                ? "ok"
                : k.compliancePct >= 60
                  ? "risk"
                  : "late"
          }
        />
        <Kpi
          label="Tareas atrasadas"
          value={k.overdue}
          hint="abiertas y vencidas"
          tone={k.overdue ? "late" : undefined}
        />
        <Kpi label="Tickets abiertos" value={k.openTickets} hint="sin cerrar" />
        <Kpi
          label="Sin asignar"
          value={k.unassigned}
          hint={
            k.oldestUnassigned
              ? `el más antiguo, ${formatRelative(k.oldestUnassigned, now)}`
              : "todo tiene responsable"
          }
          tone={k.unassigned ? "risk" : undefined}
        />
        <Kpi
          label="SLA cumplido"
          value={k.slaPct}
          suffix=" %"
          decimals={k.slaPct && k.slaPct % 1 ? 1 : 0}
          hint={k.slaTotal ? `${k.slaMet} de ${k.slaTotal} en el periodo` : "sin datos del periodo"}
          tone={
            k.slaPct === null ? undefined : k.slaPct >= 85 ? "ok" : k.slaPct >= 60 ? "risk" : "late"
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <section className="flex min-w-0 flex-col rounded-xl border bg-card">
          <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
            <h2 className="text-base font-semibold">Cumplimiento por auxiliar</h2>
            <Link href="/panel/tareas" className="text-sm font-medium text-primary hover:underline">
              Ver tareas
            </Link>
          </header>
          {d.people.length ? (
            <ul className="divide-y">
              {d.people.map((p) => (
                <li
                  key={p.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center"
                >
                  <Avatar className="size-9">
                    <AvatarFallback className="bg-muted text-xs font-semibold">
                      {initials(p.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      {p.signal ? (
                        <StatusSignal signal={p.signal} />
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin pendientes</span>
                      )}
                    </div>
                    <p className="tabular text-xs text-muted-foreground">
                      {p.team ?? p.role}
                      {p.dueElapsed
                        ? `, ${p.onTime} de ${p.dueElapsed} a tiempo (${p.pct} %)`
                        : ", sin tareas vencidas en el periodo"}
                      {p.overdue ? `, ${p.overdue} atrasada(s)` : ""}
                    </p>
                  </div>
                  <div className="col-start-2 flex min-w-0 flex-col gap-1 sm:col-start-3">
                    {p.next ? (
                      <>
                        <Link
                          href={`/tareas/${p.next.code}`}
                          className="truncate text-xs text-muted-foreground hover:underline"
                          title={p.next.title}
                        >
                          Próxima: <span className="text-foreground">{p.next.title}</span>
                        </Link>
                        {p.next.dueAt && p.next.signal && (
                          <TimeRail
                            start={new Date(p.next.start)}
                            due={new Date(p.next.dueAt)}
                            now={now}
                            signal={p.next.signal}
                          />
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Nada pendiente.</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">
              No hay auxiliares activos en este equipo.
            </p>
          )}
        </section>

        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Solicitudes por categoría</h2>
            <p className="text-xs text-muted-foreground">Desde el {formatDate(d.since)}</p>
            <TicketsByTypeChart data={d.byType} />
          </section>
          <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
            <h2 className="text-base font-semibold">Solicitudes por semana</h2>
            <TicketsByWeekChart data={d.weeks} />
          </section>
        </div>
      </div>

      <section className="flex flex-col rounded-xl border bg-card">
        <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
          <h2 className="text-base font-semibold">Solicitudes recientes</h2>
          <Link
            href="/panel/tickets"
            className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
          >
            Abrir bandeja <ArrowRight aria-hidden="true" className="size-3.5" />
          </Link>
        </header>
        <ul className="divide-y">
          {d.recent.map((t) => (
            <li
              key={t.code}
              className="relative flex items-center gap-3 px-4 py-3 hover:bg-accent/60"
            >
              <CategoryTile icon={t.icon} color={t.color} name={t.typeName} />
              <div className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/solicitudes/${t.code}`}
                  className="truncate text-sm font-medium after:absolute after:inset-0"
                >
                  {t.title}
                </Link>
                <span className="text-xs text-muted-foreground">
                  <span className="code-id">{t.code}</span> · {t.requester} ·{" "}
                  {formatRelative(t.createdAt, now)}
                </span>
              </div>
              <StatusBadge status={t.status} className="hidden sm:inline-flex" />
            </li>
          ))}
        </ul>
      </section>
      <p className="text-xs text-muted-foreground">
        Datos actualizados {formatRelative(d.generatedAt, new Date())}. Se refrescan solos cuando
        hay cambios.
      </p>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="flex flex-col gap-2 bg-card p-4">
            <Skeleton className="h-3.5 w-24" />
            <Skeleton className="h-7 w-14" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <ListSkeleton rows={6} />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}

/** Panel del docente ExperTIC (HU-40): quién va a tiempo y quién va atrasado. */
export default async function PanelPage({ searchParams }: PageProps<"/panel">) {
  const viewer = await requireRoute("/panel");
  const sp = await searchParams;
  const period: Period = sp.periodo === "30d" || sp.periodo === "semestre" ? sp.periodo : "mes";
  const teamId = typeof sp.equipo === "string" ? sp.equipo : null;
  const [teams, assignable] = await Promise.all([
    activeTeams(),
    assignableForTasks(getDb(), viewer),
  ]);
  const firstName = viewer.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title="Panel de control"
        description={`Hola, ${firstName}. Así van tus equipos.`}
        actions={
          <>
            <DashboardFilters teams={teams} />
            <CreateTaskDialog people={assignable.people} teams={assignable.teams} />
          </>
        }
      />
      <Suspense key={`${period}-${teamId}`} fallback={<DashboardSkeleton />}>
        <DashboardContent period={period} teamId={teamId} />
      </Suspense>
    </>
  );
}
