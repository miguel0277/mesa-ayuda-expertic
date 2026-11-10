"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useQueryStates } from "nuqs";
import { useEffect, useState, useTransition } from "react";
import type { Priority, TicketStatus } from "@/shared/db/schema/enums";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/ui/components/input-group";
import { Spinner } from "@/shared/ui/components/spinner";
import { cn } from "@/shared/lib/utils";
import { TICKET_STATUS_LABEL } from "../domain/ticket-state";
import { PRIORITY_LABEL } from "./badges";
import { ticketSearchParams } from "./search-params";

/** Pestañas rápidas: grupos de estados con nombre humano. */
const TABS: { key: string; label: string; statuses: TicketStatus[] }[] = [
  {
    key: "activas",
    label: "Activas",
    statuses: ["abierto", "asignado", "en_progreso", "reabierto"],
  },
  { key: "respondidas", label: "Respondidas", statuses: ["respondido"] },
  { key: "cerradas", label: "Cerradas", statuses: ["cerrado"] },
  { key: "todas", label: "Todas", statuses: [] },
];

const same = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((x) => b.includes(x));

export function TicketFilters({
  counts,
  types,
  assignees,
  showAssignee,
}: {
  counts: Partial<Record<TicketStatus, number>>;
  types: { id: string; name: string }[];
  assignees?: { id: string; name: string }[];
  showAssignee?: boolean;
}) {
  const [pending, start] = useTransition();
  const [params, setParams] = useQueryStates(ticketSearchParams, {
    shallow: false,
    startTransition: start,
  });
  const [q, setQ] = useState(params.q);

  // Búsqueda con espera corta (no consulta en cada tecla).
  useEffect(() => {
    if (q === params.q) return;
    const id = setTimeout(() => void setParams({ q, cursor: null }), 300);
    return () => clearTimeout(id);
  }, [q, params.q, setParams]);

  const countOf = (statuses: TicketStatus[]) =>
    (statuses.length ? statuses : (Object.keys(counts) as TicketStatus[])).reduce(
      (n, s) => n + (counts[s] ?? 0),
      0,
    );
  const activeFilters =
    params.prioridad.length + (params.categoria ? 1 : 0) + (params.asignado ? 1 : 0);

  return (
    <div className="flex flex-col gap-3">
      <div role="tablist" aria-label="Estado" className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => {
          const active = same(params.estado, tab.statuses);
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={active}
              onClick={() => void setParams({ estado: tab.statuses, cursor: null })}
              className={cn(
                "-mb-px flex shrink-0 items-center gap-2 border-b-2 border-transparent px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground",
                active && "border-primary font-medium text-foreground",
              )}
            >
              {tab.label}
              <span
                className={cn(
                  "tabular rounded-full bg-muted px-1.5 text-xs",
                  active && "bg-secondary text-secondary-foreground",
                )}
              >
                {countOf(tab.statuses)}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="min-w-0 flex-1 sm:max-w-sm">
          <InputGroupAddon>{pending ? <Spinner /> : <Search aria-hidden="true" />}</InputGroupAddon>
          <InputGroupInput
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Código, título o solicitante"
            aria-label="Buscar solicitudes"
          />
          {q && (
            <InputGroupAddon align="inline-end">
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setQ("")}
                className="rounded p-0.5 hover:bg-muted"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </InputGroupAddon>
          )}
        </InputGroup>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline">
              <ListFilter data-icon="inline-start" aria-hidden="true" />
              Filtros
              {activeFilters > 0 && (
                <span className="tabular rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                  {activeFilters}
                </span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-60">
            <DropdownMenuLabel>Prioridad</DropdownMenuLabel>
            <DropdownMenuGroup>
              {(["alta", "media", "baja"] as Priority[]).map((p) => (
                <DropdownMenuCheckboxItem
                  key={p}
                  checked={params.prioridad.includes(p)}
                  onSelect={(e) => e.preventDefault()}
                  onCheckedChange={(on) =>
                    void setParams({
                      prioridad: on
                        ? [...params.prioridad, p]
                        : params.prioridad.filter((x) => x !== p),
                      cursor: null,
                    })
                  }
                >
                  {PRIORITY_LABEL[p]}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Categoría</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={params.categoria ?? ""}
              onValueChange={(v) => void setParams({ categoria: v || null, cursor: null })}
            >
              <DropdownMenuRadioItem value="">Todas</DropdownMenuRadioItem>
              {types.map((t) => (
                <DropdownMenuRadioItem key={t.id} value={t.id}>
                  {t.name}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
            {showAssignee && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Responsable</DropdownMenuLabel>
                <DropdownMenuRadioGroup
                  value={params.asignado ?? ""}
                  onValueChange={(v) => void setParams({ asignado: v || null, cursor: null })}
                >
                  <DropdownMenuRadioItem value="">Cualquiera</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="none">Sin asignar</DropdownMenuRadioItem>
                  {assignees?.map((a) => (
                    <DropdownMenuRadioItem key={a.id} value={a.id}>
                      {a.name}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost">
              Orden:{" "}
              {params.orden === "recientes"
                ? "más recientes"
                : params.orden === "antiguos"
                  ? "más antiguas"
                  : "vencimiento"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuRadioGroup
              value={params.orden}
              onValueChange={(v) =>
                void setParams({ orden: v as typeof params.orden, cursor: null })
              }
            >
              <DropdownMenuRadioItem value="recientes">Más recientes primero</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="antiguos">Más antiguas primero</DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="vencimiento">Próximas a vencer</DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        {(activeFilters > 0 || params.q) && (
          <Button
            variant="ghost"
            className="text-muted-foreground"
            onClick={() => {
              setQ("");
              void setParams({
                prioridad: [],
                categoria: null,
                asignado: null,
                q: "",
                cursor: null,
              });
            }}
          >
            Limpiar filtros
          </Button>
        )}
      </div>
      {params.estado.length > 0 && !TABS.some((t) => same(t.statuses, params.estado)) && (
        <p className="text-xs text-muted-foreground">
          Estados: {params.estado.map((s) => TICKET_STATUS_LABEL[s]).join(", ")}
        </p>
      )}
    </div>
  );
}
