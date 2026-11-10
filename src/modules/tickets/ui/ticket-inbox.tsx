import { ChevronRight, Inbox, Plus, SearchX } from "lucide-react";
import Link from "next/link";
import type { SearchParams } from "nuqs/server";
import type { Viewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { Button } from "@/shared/ui/components/button";
import { EmptyState, PageHeader } from "@/shared/ui/states";
import {
  activeTicketTypes,
  assignableStaff,
  countByStatus,
  listTickets,
  type TicketScope,
} from "../infrastructure/ticket-queries";
import { loadTicketSearchParams } from "./search-params";
import { TicketFilters } from "./ticket-filters";
import { TicketTable } from "./ticket-table";

/**
 * Bandeja de tickets reutilizable: "mis solicitudes", "asignados a mí", "mi equipo" y la global.
 * Filtros y paginación por cursor en la URL.
 */
export async function TicketInbox({
  viewer,
  scope,
  title,
  description,
  searchParams,
  basePath,
  selectable = false,
  showRequester = true,
}: {
  viewer: Viewer;
  scope: TicketScope;
  title: string;
  description: string;
  searchParams: Promise<SearchParams>;
  basePath: string;
  selectable?: boolean;
  showRequester?: boolean;
}) {
  const p = await loadTicketSearchParams(searchParams);
  const db = getDb();
  const [list, counts, types, staff] = await Promise.all([
    listTickets(db, viewer, {
      scope,
      status: p.estado,
      priority: p.prioridad,
      typeId: p.categoria ?? undefined,
      assigneeId: p.asignado ?? undefined,
      q: p.q,
      sort: p.orden,
      cursor: p.cursor,
      limit: 20,
    }),
    countByStatus(db, viewer, scope),
    activeTicketTypes(db),
    selectable ? assignableStaff(db, viewer) : Promise.resolve([]),
  ]);
  const now = new Date().toISOString();
  const filtered = p.q || p.prioridad.length || p.categoria || p.asignado || p.estado.length;

  const nextHref = (() => {
    if (!list.nextCursor) return null;
    const sp = new URLSearchParams();
    if (p.estado.length) sp.set("estado", p.estado.join(","));
    if (p.prioridad.length) sp.set("prioridad", p.prioridad.join(","));
    if (p.categoria) sp.set("categoria", p.categoria);
    if (p.asignado) sp.set("asignado", p.asignado);
    if (p.q) sp.set("q", p.q);
    if (p.orden !== "recientes") sp.set("orden", p.orden);
    sp.set("cursor", list.nextCursor);
    return `${basePath}?${sp.toString()}`;
  })();

  return (
    <>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button asChild>
            <Link href="/solicitudes/nueva">
              <Plus data-icon="inline-start" aria-hidden="true" />
              Nueva solicitud
            </Link>
          </Button>
        }
      />
      <div className="flex flex-col gap-4">
        <TicketFilters
          counts={counts}
          types={types.map((t) => ({ id: t.id, name: t.name }))}
          assignees={staff.map((s) => ({ id: s.id, name: s.name }))}
          showAssignee={scope === "all" || scope === "team"}
        />
        <TicketTable
          items={list.items}
          now={now}
          selectable={selectable}
          staff={staff}
          showRequester={showRequester}
          emptyState={
            filtered ? (
              <EmptyState
                icon={SearchX}
                title="Ninguna solicitud coincide"
                description="Prueba con otra búsqueda o quita algunos filtros."
              />
            ) : scope === "mine" ? (
              <EmptyState
                icon={Inbox}
                title="Aún no tienes solicitudes"
                description="Cuando algo falle en un curso o necesites apoyo del equipo, crea una solicitud y síguela desde aquí."
                action={
                  <Button asChild>
                    <Link href="/solicitudes/nueva">
                      <Plus data-icon="inline-start" aria-hidden="true" />
                      Nueva solicitud
                    </Link>
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={Inbox}
                title="No hay solicitudes por ahora"
                description="Cuando te asignen una, aparecerá aquí."
              />
            )
          }
        />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular">
            {list.total} solicitud{list.total === 1 ? "" : "es"}
            {p.cursor ? " · página siguiente" : ""}
          </span>
          <div className="flex gap-2">
            {p.cursor && (
              <Button asChild variant="ghost" size="sm">
                <Link href={basePath}>Volver al inicio</Link>
              </Button>
            )}
            {nextHref && (
              <Button asChild variant="outline" size="sm">
                <Link href={nextHref}>
                  Ver más
                  <ChevronRight data-icon="inline-end" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
