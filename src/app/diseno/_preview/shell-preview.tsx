import {
  Bell,
  ChartColumn,
  ChevronsUpDown,
  ClipboardList,
  FileSliders,
  Inbox,
  LayoutDashboard,
  Search,
  Menu,
  Plus,
  Users,
} from "lucide-react";
import { formatDateTime, formatRelative } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { BrandLogo } from "@/shared/ui/brand-logo";
import { categoryIcon } from "@/shared/ui/category-icon";
import { Avatar, AvatarFallback } from "@/shared/ui/components/avatar";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Kbd } from "@/shared/ui/components/kbd";
import { StatusSignal } from "@/shared/ui/status-signal";
import { TimeRail } from "@/shared/ui/time-rail";
import { COMPLIANCE, KPIS, NOW, TICKETS } from "./data";

/**
 * Maqueta estática del armazón con la pantalla del Docente ExperTIC.
 * Sirve para aprobar la dirección visual; el shell real (interactivo) se construye después.
 */

const NAV = [
  {
    group: "Seguimiento",
    items: [
      { label: "Panel de control", icon: LayoutDashboard, active: true },
      { label: "Bandeja de tickets", icon: Inbox, count: 8 },
      { label: "Tareas", icon: ClipboardList },
    ],
  },
  {
    group: "Gestión",
    items: [
      { label: "Auxiliares y equipos", icon: Users },
      { label: "Plantillas y SLA", icon: FileSliders },
      { label: "Reportes", icon: ChartColumn },
    ],
  },
];

const PRIORITY_LABEL = { alta: "Alta", media: "Media", baja: "Baja" } as const;

function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar lg:flex">
      <div className="flex h-14 items-center border-b px-4">
        <BrandLogo className="h-8" />
      </div>
      <nav aria-label="Principal" className="flex flex-1 flex-col gap-5 px-2.5 py-4">
        {NAV.map((section) => (
          <div key={section.group} className="flex flex-col gap-0.5">
            <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{section.group}</p>
            {section.items.map((item) => (
              <a
                key={item.label}
                href="#"
                aria-current={item.active ? "page" : undefined}
                className={cn(
                  "relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-sm text-sidebar-foreground/85 transition-colors hover:bg-accent hover:text-sidebar-foreground",
                  "aria-[current=page]:bg-sidebar-accent aria-[current=page]:font-medium aria-[current=page]:text-sidebar-accent-foreground",
                )}
              >
                {item.active && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2 -left-2.5 w-[3px] rounded-r-full bg-sidebar-primary"
                  />
                )}
                <item.icon aria-hidden="true" className="size-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.count ? (
                  <span className="tabular rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
                    {item.count}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t p-2.5">
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-md p-2 text-left hover:bg-accent"
        >
          <Avatar className="size-8">
            <AvatarFallback className="bg-secondary text-xs font-semibold text-secondary-foreground">
              CM
            </AvatarFallback>
          </Avatar>
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-sm font-medium">Carolina Méndez</span>
            <span className="truncate text-xs text-muted-foreground">Docente ExperTIC</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="size-4 text-muted-foreground" />
        </button>
      </div>
    </aside>
  );
}

function Topbar() {
  return (
    <header className="flex h-14 items-center gap-2 border-b bg-card/70 px-2 backdrop-blur sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" aria-label="Abrir menú" className="lg:hidden">
        <Menu aria-hidden="true" />
      </Button>
      <nav aria-label="Migas de pan" className="min-w-0 truncate text-sm text-muted-foreground">
        <ol className="flex items-center gap-1.5">
          <li>Inicio</li>
          <li aria-hidden="true">/</li>
          <li aria-current="page" className="font-medium text-foreground">
            Panel de control
          </li>
        </ol>
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          className="hidden h-9 w-72 items-center gap-2 rounded-lg border bg-background px-3 text-sm text-muted-foreground hover:border-input md:flex"
        >
          <Search aria-hidden="true" className="size-4" />
          <span className="flex-1 text-left">Buscar tickets o tareas</span>
          <Kbd>Ctrl K</Kbd>
        </button>
        <Button variant="ghost" size="icon" aria-label="Buscar" className="md:hidden">
          <Search aria-hidden="true" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificaciones: 3 sin leer"
          className="relative"
        >
          <Bell aria-hidden="true" />
          <span className="tabular absolute top-1 right-1 flex size-4 items-center justify-center rounded-full bg-late-fill text-[10px] font-semibold text-white">
            3
          </span>
        </Button>
      </div>
    </header>
  );
}

function KpiBand() {
  return (
    // Una sola banda dividida (no cinco tarjetas sueltas): el gap de 1 px deja ver el borde.
    <section
      aria-label="Indicadores"
      className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-5"
    >
      {KPIS.map((k, i) => (
        <div
          key={k.label}
          className={cn(
            "flex flex-col gap-1 bg-card p-4",
            // El último ocupa la fila completa en 2 columnas para no dejar un hueco.
            i === KPIS.length - 1 && "col-span-2 sm:col-span-1",
          )}
        >
          <p className="text-sm text-muted-foreground">{k.label}</p>
          <p
            className={cn(
              "tabular text-[1.75rem] leading-none font-semibold tracking-tight",
              k.tone === "late" && "text-late",
              k.tone === "risk" && "text-risk",
            )}
          >
            {k.value}
          </p>
          <p className="text-xs text-muted-foreground">{k.hint}</p>
        </div>
      ))}
    </section>
  );
}

function ComplianceTable() {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Cumplimiento por auxiliar</h2>
        <a href="#" className="text-sm font-medium text-primary hover:underline">
          Ver los 8
        </a>
      </header>
      <ul className="divide-y">
        {COMPLIANCE.map((row) => (
          <li
            key={row.name}
            className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[auto_minmax(0,1.1fr)_minmax(0,1fr)] sm:items-center"
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-muted text-xs font-semibold">
                {row.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex min-w-0 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium">{row.name}</span>
                <StatusSignal signal={row.signal} />
              </div>
              <p className="tabular text-xs text-muted-foreground">
                {row.team}, {row.done} de {row.total} a tiempo ({row.pct} %)
              </p>
            </div>
            <div className="col-start-2 flex min-w-0 flex-col gap-1 sm:col-start-3">
              <p className="truncate text-xs text-muted-foreground" title={row.next.title}>
                Próxima: <span className="text-foreground">{row.next.title}</span>
              </p>
              <TimeRail start={row.next.start} due={row.next.due} now={NOW} signal={row.signal} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

function RecentTickets() {
  return (
    <section className="flex min-w-0 flex-col rounded-xl border bg-card">
      <header className="flex items-baseline justify-between gap-3 border-b px-4 py-3">
        <h2 className="text-base font-semibold">Tickets recientes</h2>
        <a href="#" className="text-sm font-medium text-primary hover:underline">
          Abrir bandeja
        </a>
      </header>
      <ul className="divide-y">
        {TICKETS.map((t) => {
          const Icon = categoryIcon(t.category.icon);
          return (
            <li key={t.code} className="flex gap-3 px-4 py-3">
              <span
                className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${t.category.color}1f`, color: t.category.color }}
                title={t.category.name}
              >
                <Icon aria-hidden="true" className="size-4" />
                <span className="sr-only">{t.category.name}</span>
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="code-id text-muted-foreground">{t.code}</span>
                  <Badge variant="outline" className="h-5">
                    {t.status}
                  </Badge>
                  {t.priority === "alta" && (
                    <Badge variant="late" className="h-5">
                      Prioridad {PRIORITY_LABEL[t.priority].toLowerCase()}
                    </Badge>
                  )}
                </div>
                <p className="truncate text-sm font-medium">{t.title}</p>
                <p className="text-xs text-muted-foreground">
                  {t.requester} ({t.role.toLowerCase()}),{" "}
                  <time dateTime={t.createdAt.toISOString()} title={formatDateTime(t.createdAt)}>
                    {formatRelative(t.createdAt, NOW)}
                  </time>
                </p>
                <TimeRail
                  start={t.createdAt}
                  due={t.slaDue}
                  now={NOW}
                  signal={t.signal}
                  className="max-w-xs"
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function ShellPreview() {
  return (
    <div className="flex min-h-[760px] overflow-hidden rounded-2xl border bg-background shadow-overlay">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar />
        <main className="flex flex-col gap-5 p-4 lg:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">Panel de control</h1>
              <p className="text-sm text-muted-foreground">
                Martes 10 de noviembre, semestre 2026-2. Así van tus equipos hoy.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline">Este mes</Button>
              <Button variant="outline">Todos los equipos</Button>
              <Button>
                <Plus data-icon="inline-start" aria-hidden="true" />
                Asignar tarea
              </Button>
            </div>
          </div>
          <KpiBand />
          <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <ComplianceTable />
            <RecentTickets />
          </div>
        </main>
      </div>
    </div>
  );
}
