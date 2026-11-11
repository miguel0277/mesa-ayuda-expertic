import { ChevronRight, History } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { auditActions, listAudit } from "@/modules/audit/infrastructure/audit-queries";
import { AuditDiff } from "@/modules/audit/ui/audit-diff";
import { ROLE_LABEL, isRole } from "@/shared/auth/roles";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { formatDateTime } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/components/button";
import { EmptyState, PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Auditoría" };

const ENTITY: Record<string, string> = {
  ticket: "Ticket",
  task: "Tarea",
  user: "Usuario",
  team: "Equipo",
  ticket_type: "Plantilla",
  sla_policy: "SLA",
  setting: "Ajuste",
};
const entityHref = (type: string, label: string | null) =>
  type === "ticket" && label
    ? `/solicitudes/${label}`
    : type === "task" && label
      ? `/tareas/${label}`
      : null;

/** Visor de auditoría (HU-51): quién hizo qué, cuándo, desde dónde y qué cambió. */
export default async function AuditoriaPage({ searchParams }: PageProps<"/admin/auditoria">) {
  await requireRoute("/admin/auditoria");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" && sp[k] ? (sp[k] as string) : undefined);
  const day = /^\d{4}-\d{2}-\d{2}$/;
  const desde = str("desde");
  const hasta = str("hasta");
  const db = getDb();
  const [list, actions] = await Promise.all([
    listAudit(db, {
      entityType: str("entidad"),
      actor: str("persona"),
      action: str("accion"),
      from: desde && day.test(desde) ? new Date(`${desde}T00:00:00-05:00`) : undefined,
      to: hasta && day.test(hasta) ? new Date(`${hasta}T23:59:59-05:00`) : undefined,
      cursor: str("cursor"),
    }),
    auditActions(db),
  ]);
  const field = "h-9 rounded-lg border bg-card px-3 text-sm";
  const next = new URLSearchParams(
    Object.entries(sp).filter(([k, v]) => k !== "cursor" && typeof v === "string") as [
      string,
      string,
    ][],
  );
  if (list.nextCursor) next.set("cursor", list.nextCursor);

  return (
    <>
      <PageHeader
        title="Auditoría"
        description="Registro de solo lectura de todo lo que cambia en la plataforma. No se puede editar ni borrar."
      />
      <form
        method="get"
        action="/admin/auditoria"
        className="mb-4 flex flex-wrap items-end gap-2"
        role="search"
      >
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Entidad
          <select name="entidad" defaultValue={str("entidad") ?? ""} className={field}>
            <option value="">Todas</option>
            {Object.entries(ENTITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Acción
          <select name="accion" defaultValue={str("accion") ?? ""} className={field}>
            <option value="">Todas</option>
            {actions.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Persona
          <input
            name="persona"
            defaultValue={str("persona")}
            placeholder="Nombre o correo"
            className={field}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Desde
          <input type="date" name="desde" defaultValue={desde} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} className={field} />
        </label>
        <Button type="submit" variant="outline">
          Filtrar
        </Button>
        {Object.keys(sp).length > 0 && (
          <Button asChild variant="ghost">
            <Link href="/admin/auditoria">Limpiar</Link>
          </Button>
        )}
      </form>

      {list.items.length === 0 ? (
        <EmptyState
          icon={History}
          title="Sin registros con esos filtros"
          description="Prueba con un rango de fechas más amplio."
        />
      ) : (
        <ol className="flex flex-col gap-2">
          {list.items.map((e) => {
            const href = entityHref(e.entityType, e.label);
            return (
              <li key={e.id}>
                <details className="group rounded-xl border bg-card [&_summary::-webkit-details-marker]:hidden">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-sm">
                    <ChevronRight
                      aria-hidden="true"
                      className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-90"
                    />
                    <time
                      dateTime={e.at}
                      className="tabular w-36 shrink-0 text-xs text-muted-foreground"
                    >
                      {formatDateTime(e.at)}
                    </time>
                    <span className="font-medium">
                      {e.actorName ?? (e.actorId ? "Persona eliminada" : "El sistema")}
                    </span>
                    {e.actorRole && (
                      <span className="text-xs text-muted-foreground">
                        {isRole(e.actorRole) ? ROLE_LABEL[e.actorRole] : e.actorRole}
                      </span>
                    )}
                    <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{e.action}</code>
                    <span className="text-xs text-muted-foreground">
                      {ENTITY[e.entityType] ?? e.entityType}
                    </span>
                    {href ? (
                      <Link href={href} className="code-id text-primary hover:underline">
                        {e.label}
                      </Link>
                    ) : (
                      <span className="truncate text-xs text-muted-foreground">
                        {e.label ?? e.entityId}
                      </span>
                    )}
                  </summary>
                  <div className="flex flex-col gap-3 border-t px-4 py-3">
                    <AuditDiff before={e.before} after={e.after} />
                    <dl className="grid gap-x-4 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
                      <div>
                        <dt className="inline">IP: </dt>
                        <dd className="tabular inline">{e.ip ?? "—"}</dd>
                      </div>
                      <div>
                        <dt className="inline">Solicitud: </dt>
                        <dd className="inline font-mono">{e.requestId ?? "—"}</dd>
                      </div>
                      <div className="truncate" title={e.userAgent ?? undefined}>
                        <dt className="inline">Navegador: </dt>
                        <dd className="inline">{e.userAgent ?? "—"}</dd>
                      </div>
                    </dl>
                  </div>
                </details>
              </li>
            );
          })}
        </ol>
      )}
      {list.nextCursor && (
        <div className="mt-4 flex justify-end">
          <Button asChild variant="outline" size="sm">
            <Link href={`/admin/auditoria?${next}`}>Ver más antiguos</Link>
          </Button>
        </div>
      )}
    </>
  );
}
