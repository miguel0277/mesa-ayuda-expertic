import { and, desc, eq, gte, like, sql } from "drizzle-orm";
import { CircleAlert, CircleCheck, Database, Mail } from "lucide-react";
import type { Metadata } from "next";
import { getEnv } from "@/env";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { checkDatabase } from "@/shared/db/health";
import { auditLog, emailOutbox } from "@/shared/db/schema";
import { outboxStats } from "@/shared/email/outbox";
import { formatDateTime, formatRelative } from "@/shared/lib/dates";
import { APP_VERSION } from "@/shared/lib/version";
import { cn } from "@/shared/lib/utils";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Salud del sistema" };

const TABLES = [
  "user",
  "tickets",
  "ticket_messages",
  "tasks",
  "task_evidence",
  "attachments",
  "notifications",
  "audit_log",
  "email_outbox",
  "teams",
] as const;

/** Salud del sistema (HU-53): BD, conteos, últimos errores, correo y versión. */
export default async function SistemaPage() {
  await requireRoute("/admin/sistema");
  const db = getDb();
  const env = getEnv();
  const now = new Date();
  const [health, counts, outbox, failedLogins, failedMails, lastCron] = await Promise.all([
    checkDatabase(db),
    db.execute<{ t: string; n: number }>(
      sql.raw(
        TABLES.map((t) => `select '${t}' as t, count(*)::int as n from "${t}"`).join(" union all "),
      ),
    ),
    outboxStats(db),
    db
      .select({
        at: auditLog.occurredAt,
        action: auditLog.action,
        entityId: auditLog.entityId,
        after: auditLog.after,
        ip: auditLog.ip,
      })
      .from(auditLog)
      .where(
        and(
          like(auditLog.action, "%_failed"),
          gte(auditLog.occurredAt, new Date(now.getTime() - 7 * 86_400_000)),
        ),
      )
      .orderBy(desc(auditLog.occurredAt))
      .limit(8),
    db
      .select({
        at: emailOutbox.createdAt,
        subject: emailOutbox.subject,
        error: emailOutbox.lastError,
        attempts: emailOutbox.attempts,
      })
      .from(emailOutbox)
      .where(eq(emailOutbox.status, "fallido"))
      .orderBy(desc(emailOutbox.createdAt))
      .limit(5),
    db
      .select({ at: auditLog.occurredAt, after: auditLog.after })
      .from(auditLog)
      .where(eq(auditLog.action, "system.cron_ran"))
      .orderBy(desc(auditLog.occurredAt))
      .limit(1),
  ]);
  const countRows = ((counts as unknown as { rows?: unknown[] }).rows ??
    (counts as unknown as unknown[])) as { t: string; n: number }[];

  const cards = [
    {
      label: "Base de datos",
      ok: health.ok,
      value: health.ok ? `Conectada (${health.latencyMs} ms)` : `Sin conexión: ${health.error}`,
      icon: Database,
    },
    {
      label: "Correo",
      ok: (outbox.fallido ?? 0) === 0,
      value: `${env.EMAIL_DRIVER === "resend" ? "Resend" : "Consola (desarrollo)"} · ${outbox.pendiente ?? 0} en cola · ${outbox.fallido ?? 0} fallidos`,
      icon: Mail,
    },
    {
      label: "Tareas programadas",
      ok: !!lastCron[0] && now.getTime() - lastCron[0].at.getTime() < 26 * 3_600_000,
      value: lastCron[0]
        ? `Última ejecución ${formatRelative(lastCron[0].at, now)}`
        : "Aún no se ha ejecutado",
      icon: CircleCheck,
    },
  ];

  return (
    <>
      <PageHeader
        title="Salud del sistema"
        description={`Versión ${APP_VERSION} · ${env.NODE_ENV === "production" ? "producción" : "desarrollo"} · archivos en ${env.STORAGE_DRIVER === "vercel-blob" ? "Vercel Blob" : "disco local"}`}
      />
      <div className="flex flex-col gap-6">
        <section className="grid gap-3 md:grid-cols-3" aria-label="Estado de los servicios">
          {cards.map((c) => (
            <div key={c.label} className="flex items-start gap-3 rounded-xl border bg-card p-4">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  c.ok ? "bg-ok-soft text-ok" : "bg-late-soft text-late",
                )}
              >
                {c.ok ? (
                  <CircleCheck aria-hidden="true" className="size-5" />
                ) : (
                  <CircleAlert aria-hidden="true" className="size-5" />
                )}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-medium">
                  {c.label} <span className="sr-only">{c.ok ? "funciona" : "con problemas"}</span>
                </span>
                <span className="text-sm text-muted-foreground">{c.value}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="overflow-hidden rounded-xl border bg-card">
          <h2 className="border-b px-4 py-3 text-base font-semibold">Registros por tabla</h2>
          <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-5">
            {countRows.map((r) => (
              <div key={r.t} className="flex flex-col gap-0.5 bg-card p-3">
                <dt className="font-mono text-xs text-muted-foreground">{r.t}</dt>
                <dd className="tabular text-lg font-semibold">{r.n.toLocaleString("es-CO")}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 text-base font-semibold">
              Intentos fallidos (7 días)
            </h2>
            {failedLogins.length ? (
              <ul className="divide-y text-sm">
                {failedLogins.map((f, i) => (
                  <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5">
                    <span>
                      <code className="text-xs">{f.action}</code> · {f.entityId}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(f.at)} · IP {f.ip ?? "—"} ·{" "}
                      {String((f.after as { reason?: string } | null)?.reason ?? "")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Sin intentos fallidos esta semana.
              </p>
            )}
          </section>
          <section className="flex flex-col rounded-xl border bg-card">
            <h2 className="border-b px-4 py-3 text-base font-semibold">
              Correos que no se pudieron enviar
            </h2>
            {failedMails.length ? (
              <ul className="divide-y text-sm">
                {failedMails.map((m, i) => (
                  <li key={i} className="flex flex-col gap-0.5 px-4 py-2.5">
                    <span className="truncate">{m.subject}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(m.at)} · {m.attempts} intentos · {m.error}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                Todos los correos se han enviado.
              </p>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
