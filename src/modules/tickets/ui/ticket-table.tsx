"use client";

import { MessageSquare, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { RelativeTime } from "@/shared/ui/relative-time";
import { TimeRail } from "@/shared/ui/time-rail";
import { slaView } from "../domain/sla";
import type { TicketListItem } from "../infrastructure/ticket-queries";
import { bulkTicketAction } from "./actions";
import { CategoryTile, PriorityBadge, StatusBadge } from "./badges";

type Staff = { id: string; name: string; role: string };

/**
 * Lista de tickets: filas en escritorio, tarjetas apiladas en móvil (misma estructura).
 * Con `selectable`, permite acciones en lote (asignar, cerrar, prioridad).
 */
export function TicketTable({
  items,
  now,
  selectable,
  staff = [],
  showRequester = true,
  emptyState,
}: {
  items: TicketListItem[];
  now: string;
  selectable?: boolean;
  staff?: Staff[];
  showRequester?: boolean;
  emptyState: React.ReactNode;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const router = useRouter();
  const nowDate = new Date(now);

  if (!items.length) return <>{emptyState}</>;

  const toggle = (id: string, on: boolean) =>
    setSelected((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });
  const allOn = selected.size === items.length;

  const runBulk = (op: Parameters<typeof bulkTicketAction>[0]["op"], label: string) =>
    start(async () => {
      const r = await bulkTicketAction({ ids: [...selected], op });
      if (!r.ok) {
        toast.error(r.error.message);
        return;
      }
      const { done, failed, reasons } = r.data;
      if (done) toast.success(`${label}: ${done} solicitud(es).`);
      if (failed) toast.warning(`${failed} no se pudieron cambiar. ${reasons[0] ?? ""}`);
      setSelected(new Set());
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {selectable && selected.size > 0 && (
        <div className="sticky top-16 z-10 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-overlay">
          <span className="tabular text-sm font-medium">{selected.size} seleccionada(s)</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={pending}>
                  Asignar a…
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                {staff.map((p) => (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={() =>
                      runBulk({ kind: "assign", assigneeId: p.id }, `Asignadas a ${p.name}`)
                    }
                  >
                    {p.name}
                    <span className="ml-auto text-xs text-muted-foreground">{p.role}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={pending}>
                  Más acciones
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger>Cambiar prioridad</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {(["alta", "media", "baja"] as const).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onSelect={() =>
                          runBulk({ kind: "priority", priority: p }, "Prioridad cambiada")
                        }
                      >
                        {p[0]!.toUpperCase() + p.slice(1)}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => runBulk({ kind: "status", to: "cerrado" }, "Cerradas")}
                >
                  Cerrar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              Quitar selección
            </Button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border bg-card">
        <div
          className={cn(
            "hidden items-center gap-4 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground lg:grid",
            selectable
              ? "lg:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_10rem_12rem]"
              : "lg:grid-cols-[minmax(0,1fr)_8.5rem_10rem_12rem]",
          )}
        >
          {selectable && (
            <Checkbox
              aria-label="Seleccionar todas"
              checked={allOn ? true : selected.size ? "indeterminate" : false}
              onCheckedChange={(v) =>
                setSelected(v === true ? new Set(items.map((i) => i.id)) : new Set())
              }
            />
          )}
          <span>Solicitud</span>
          <span>Estado</span>
          <span>Responsable</span>
          <span>Plazo</span>
        </div>
        <ul className="divide-y">
          {items.map((t) => {
            const sla = slaView(
              {
                status: t.status,
                createdAt: new Date(t.createdAt),
                firstResponseAt: t.firstResponseAt ? new Date(t.firstResponseAt) : null,
                resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null,
                slaFirstResponseDue: new Date(t.slaFirstResponseDue),
                slaResolutionDue: new Date(t.slaResolutionDue),
              },
              nowDate,
            );
            // Cerrada o respondida (reloj en pausa): el plazo ya no corre, mostramos el resultado.
            const settled = ["cumplido", "incumplido", "pausado"].includes(sla.state);
            return (
              <li
                key={t.id}
                className={cn(
                  "group relative grid gap-x-4 gap-y-2 px-4 py-3 transition-colors hover:bg-accent/60",
                  selectable
                    ? "grid-cols-[1.5rem_minmax(0,1fr)] lg:grid-cols-[1.5rem_minmax(0,1fr)_8.5rem_10rem_12rem]"
                    : "lg:grid-cols-[minmax(0,1fr)_8.5rem_10rem_12rem]",
                  selected.has(t.id) && "bg-secondary/50",
                )}
              >
                {selectable && (
                  <Checkbox
                    className="relative z-10 mt-1 lg:mt-2.5"
                    aria-label={`Seleccionar ${t.code}`}
                    checked={selected.has(t.id)}
                    onCheckedChange={(v) => toggle(t.id, v === true)}
                  />
                )}
                <div className="flex min-w-0 gap-3">
                  <CategoryTile icon={t.type.icon} color={t.type.color} name={t.type.name} />
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span className="code-id text-muted-foreground">{t.code}</span>
                      {t.priority !== "media" && (
                        <PriorityBadge priority={t.priority} className="h-5" />
                      )}
                      <span className="lg:hidden">
                        <StatusBadge status={t.status} className="h-5" />
                      </span>
                    </div>
                    <Link
                      href={`/solicitudes/${t.code}`}
                      className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-md focus-visible:after:ring-2 focus-visible:after:ring-ring"
                    >
                      {t.title}
                    </Link>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
                      {showRequester && (
                        <span>
                          {t.requester.name} ({t.requester.role.toLowerCase()}),
                        </span>
                      )}
                      <RelativeTime date={t.createdAt} now={now} className="relative z-10" />
                      {t.messages > 0 && (
                        <span
                          className="inline-flex items-center gap-0.5"
                          title={`${t.messages} mensaje(s)`}
                        >
                          · <MessageSquare aria-hidden="true" className="size-3" />
                          <span className="tabular">{t.messages}</span>
                          <span className="sr-only">mensajes</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="hidden items-center lg:flex">
                  <StatusBadge status={t.status} />
                </div>
                <div
                  className={cn(
                    "flex items-center gap-1.5 text-sm",
                    selectable && "col-start-2 lg:col-start-auto",
                  )}
                >
                  <UserRound
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground lg:hidden"
                  />
                  {t.assignee ? (
                    <span className="truncate">{t.assignee.name}</span>
                  ) : (
                    <span className="text-muted-foreground">Sin asignar</span>
                  )}
                </div>
                <div
                  className={cn("flex items-center", selectable && "col-start-2 lg:col-start-auto")}
                >
                  {settled ? (
                    <span
                      className={cn(
                        "text-xs",
                        sla.signal === "atrasada" ? "text-late" : "text-muted-foreground",
                      )}
                    >
                      {sla.label}
                    </span>
                  ) : (
                    <TimeRail
                      start={new Date(t.createdAt)}
                      due={sla.due}
                      now={nowDate}
                      signal={sla.signal}
                      className="w-full max-w-56"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
