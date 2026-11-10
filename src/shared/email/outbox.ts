import { and, asc, eq, inArray, lte, sql } from "drizzle-orm";
import { emailOutbox } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import type { EmailMessage, EmailProvider } from "./provider";

/**
 * Bandeja de salida (D-013). Un correo que falla no rompe la operación principal:
 * queda en `email_outbox` y el cron lo reintenta con espera creciente.
 */

const MAX_ATTEMPTS = 6;
/** Espera antes del siguiente intento: 1, 5, 15, 60, 240 minutos. */
const BACKOFF_MIN = [1, 5, 15, 60, 240];

export async function enqueueEmail(db: DbExecutor, message: EmailMessage, now = new Date()) {
  const [row] = await db
    .insert(emailOutbox)
    .values({ ...message, status: "pendiente", nextAttemptAt: now })
    .returning({ id: emailOutbox.id });
  return row?.id;
}

/** Intenta enviar un correo ya encolado y registra el resultado. */
export async function deliver(
  db: DbExecutor,
  provider: EmailProvider,
  id: string,
  now = new Date(),
) {
  const [row] = await db.select().from(emailOutbox).where(eq(emailOutbox.id, id)).limit(1);
  if (!row || row.status === "enviado") return;
  try {
    await provider.send({ to: row.to, subject: row.subject, html: row.html, text: row.text });
    await db
      .update(emailOutbox)
      .set({ status: "enviado", sentAt: now, attempts: row.attempts + 1, lastError: null })
      .where(eq(emailOutbox.id, id));
  } catch (error) {
    const attempts = row.attempts + 1;
    const wait = BACKOFF_MIN[Math.min(attempts - 1, BACKOFF_MIN.length - 1)] ?? 240;
    await db
      .update(emailOutbox)
      .set({
        status: attempts >= MAX_ATTEMPTS ? "fallido" : "pendiente",
        attempts,
        lastError: error instanceof Error ? error.message.slice(0, 500) : "error desconocido",
        nextAttemptAt: new Date(now.getTime() + wait * 60_000),
      })
      .where(eq(emailOutbox.id, id));
  }
}

/** Procesa los correos pendientes cuyo turno ya llegó (lo llama el cron). */
export async function processOutbox(
  db: DbExecutor,
  provider: EmailProvider,
  now = new Date(),
  limit = 25,
) {
  const due = await db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pendiente"), lte(emailOutbox.nextAttemptAt, now)))
    .orderBy(asc(emailOutbox.nextAttemptAt))
    .limit(limit);
  for (const { id } of due) await deliver(db, provider, id, now);
  return due.length;
}

export async function outboxStats(db: DbExecutor) {
  const rows = await db
    .select({ status: emailOutbox.status, n: sql<number>`count(*)::int` })
    .from(emailOutbox)
    .where(inArray(emailOutbox.status, ["pendiente", "fallido", "enviado"]))
    .groupBy(emailOutbox.status);
  return Object.fromEntries(rows.map((r) => [r.status, r.n])) as Partial<
    Record<"pendiente" | "fallido" | "enviado", number>
  >;
}
