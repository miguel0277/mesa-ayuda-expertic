import { inArray } from "drizzle-orm";
import { ArrowLeft, CalendarClock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { displayValue } from "@/modules/templates/domain/ticket-form-factory";
import { slaView } from "@/modules/tickets/domain/sla";
import { assignableStaff, getTicketDetail } from "@/modules/tickets/infrastructure/ticket-queries";
import { AttachmentList } from "@/modules/tickets/ui/attachment-list";
import { CategoryTile, PriorityBadge, StatusBadge } from "@/modules/tickets/ui/badges";
import { Thread } from "@/modules/tickets/ui/thread";
import {
  AssignControl,
  PriorityControl,
  RatingControl,
  StatusControl,
} from "@/modules/tickets/ui/ticket-controls";
import { Timeline } from "@/modules/tickets/ui/timeline";
import { requireViewer } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { user } from "@/shared/db/schema";
import { formatDateTime } from "@/shared/lib/dates";
import { Button } from "@/shared/ui/components/button";
import { Separator } from "@/shared/ui/components/separator";
import { TimeRail } from "@/shared/ui/time-rail";

// Metadata estática: con Cache Components, leer `params` aquí bloquearía el prerenderizado.
export const metadata: Metadata = { title: "Detalle de la solicitud" };

const CODE = /^EXP-\d{4}-\d{5}$/i;

function Card({
  title,
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`flex flex-col gap-3 rounded-xl border bg-card p-4 ${className ?? ""}`}>
      {title && <h2 className="text-sm font-semibold">{title}</h2>}
      {children}
    </section>
  );
}

export default async function TicketDetailPage({ params }: PageProps<"/solicitudes/[code]">) {
  const viewer = await requireViewer();
  const { code } = await params;
  if (!CODE.test(code)) notFound();
  const db = getDb();
  const t = await getTicketDetail(db, viewer, code);
  // 404 (no 403) para no revelar que la solicitud existe.
  if (!t) notFound();

  const now = new Date();
  const staff = t.viewer.canAssign ? await assignableStaff(db, viewer) : [];
  const ids = new Set<string>();
  for (const e of t.timeline) {
    const a = (e.after ?? {}) as { assigneeId?: string | null };
    if (a.assigneeId) ids.add(a.assigneeId);
  }
  const names = ids.size
    ? Object.fromEntries(
        (
          await db
            .select({ id: user.id, name: user.name })
            .from(user)
            .where(inArray(user.id, [...ids]))
        ).map((u) => [u.id, u.name]),
      )
    : {};
  const sla = slaView(
    {
      status: t.status,
      createdAt: new Date(t.createdAt),
      firstResponseAt: t.firstResponseAt ? new Date(t.firstResponseAt) : null,
      resolvedAt: t.resolvedAt ? new Date(t.resolvedAt) : null,
      slaFirstResponseDue: new Date(t.slaFirstResponseDue),
      slaResolutionDue: new Date(t.slaResolutionDue),
    },
    now,
  );
  const backHref =
    t.viewer.kind === "requester"
      ? "/solicitudes"
      : viewer.role === "docente" || viewer.role === "admin"
        ? "/panel/tickets"
        : "/tickets-asignados";
  const filledValues = t.type.fields.filter(
    (f) => f.type !== "file" && t.values[f.key] !== undefined && t.values[f.key] !== "",
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
          <Link href={backHref}>
            <ArrowLeft data-icon="inline-start" aria-hidden="true" />
            Volver
          </Link>
        </Button>
        <div className="flex items-start gap-3">
          <CategoryTile icon={t.type.icon} color={t.type.color} name={t.type.name} size="lg" />
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="code-id text-muted-foreground">{t.code}</span>
              <StatusBadge status={t.status} />
              <PriorityBadge priority={t.priority} />
            </div>
            <h1 className="text-2xl font-semibold text-pretty">{t.title}</h1>
            {/* D-007: quién la creó y cuándo, siempre visible */}
            <p className="text-sm text-muted-foreground">
              Creada por <span className="font-medium text-foreground">{t.requester.name}</span> (
              {t.requester.role.toLowerCase()}) el{" "}
              <time dateTime={t.createdAt} className="tabular">
                {formatDateTime(t.createdAt)}
              </time>{" "}
              · {t.type.name}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card>
            <p className="text-[0.9375rem] leading-relaxed break-words whitespace-pre-wrap">
              {t.description}
            </p>
            {filledValues.length > 0 && (
              <>
                <Separator />
                <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                  {filledValues.map((f) => (
                    <div key={f.key} className="flex min-w-0 flex-col gap-0.5">
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="text-sm break-words">
                        {f.type === "text" && f.format === "url" ? (
                          <a
                            href={String(t.values[f.key])}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary underline-offset-4 hover:underline"
                          >
                            {String(t.values[f.key])}
                          </a>
                        ) : (
                          displayValue(f, t.values[f.key], formatDateTime)
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            )}
            <AttachmentList files={t.attachments} />
          </Card>
          <Thread ticket={t} now={now.toISOString()} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <StatusControl ticket={t} />
          </Card>

          <Card
            title={
              t.status === "cerrado"
                ? "Tiempo de atención"
                : sla.target === "primera_respuesta"
                  ? "Plazo de primera respuesta"
                  : "Plazo de solución"
            }
          >
            {t.status === "cerrado" ? (
              <p className="text-sm text-muted-foreground">{sla.label}.</p>
            ) : (
              <>
                <TimeRail
                  start={new Date(t.createdAt)}
                  due={sla.due}
                  now={now}
                  signal={sla.signal}
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CalendarClock aria-hidden="true" className="size-3.5" />
                  Vence el <span className="tabular">{formatDateTime(sla.due)}</span> (horas
                  hábiles)
                </p>
                {t.status === "respondido" && (
                  <p className="text-xs text-muted-foreground">
                    El plazo está en pausa mientras esperamos tu confirmación.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card title="Personas">
            <dl className="flex flex-col gap-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-muted-foreground">Solicitante</dt>
                <dd>
                  <span className="font-medium">{t.requester.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {t.requester.role}
                    {t.requester.programa ? ` · ${t.requester.programa}` : ""}
                    {t.viewer.kind === "staff" && ` · ${t.requester.email}`}
                  </span>
                </dd>
              </div>
              {!t.viewer.canAssign && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Responsable</dt>
                  <dd>
                    {t.assignee ? (
                      <span className="font-medium">{t.assignee.name}</span>
                    ) : (
                      <span className="text-muted-foreground">Aún sin asignar</span>
                    )}
                  </dd>
                </div>
              )}
              {t.team && (
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground">Equipo</dt>
                  <dd>{t.team.name}</dd>
                </div>
              )}
            </dl>
            {t.viewer.canAssign && <AssignControl ticket={t} staff={staff} />}
            {t.viewer.canChangePriority && <PriorityControl ticket={t} />}
          </Card>

          {(t.viewer.canRate || t.rating) && (
            <Card>
              <RatingControl ticket={t} />
            </Card>
          )}

          <Card title="Historial">
            <Timeline entries={t.timeline} names={names} />
          </Card>
        </aside>
      </div>
    </div>
  );
}
