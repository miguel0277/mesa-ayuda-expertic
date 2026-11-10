import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { emailOutbox } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import { deliver } from "@/shared/email/outbox";
import type { AppEvent } from "./app-event";
import type { Container } from "./container";

/**
 * Unidad de trabajo de un caso de uso:
 * 1. Ejecuta el trabajo en una transacción.
 * 2. Publica los eventos acumulados dentro de la misma transacción (auditoría y avisos atómicos).
 * 3. Después de confirmar, intenta enviar los correos encolados sin bloquear ni romper la operación.
 */
export async function unitOfWork<T>(
  c: Pick<Container, "db" | "events" | "email" | "logger" | "clock">,
  work: (tx: DbExecutor, emit: (e: AppEvent) => void) => Promise<T>,
): Promise<T> {
  const emitted: AppEvent[] = [];
  const result = await c.db.transaction(async (tx) => {
    const value = await work(tx, (e) => emitted.push(e));
    if (emitted.length) await c.events.publish(emitted, { tx });
    return value;
  });
  if (emitted.some((e) => e.payload.notify?.some((n) => n.email))) {
    runAfterResponse(() =>
      flushPendingEmails(c).catch((err: unknown) =>
        c.logger.warn({ err }, "envío diferido de correos falló"),
      ),
    );
  }
  return result;
}

/**
 * Ejecuta trabajo después de responder: `after()` de Next mantiene viva la función en Vercel.
 * Fuera de una petición (pruebas, scripts) se ejecuta sin esperar.
 */
function runAfterResponse(task: () => Promise<unknown>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

/** Envía los correos pendientes recientes (el cron reintenta los que fallen). */
export async function flushPendingEmails(c: Pick<Container, "db" | "email" | "clock">, limit = 10) {
  const pending = await c.db
    .select({ id: emailOutbox.id })
    .from(emailOutbox)
    .where(and(eq(emailOutbox.status, "pendiente"), eq(emailOutbox.attempts, 0)))
    .limit(limit);
  for (const { id } of pending) await deliver(c.db, c.email, id, c.clock.now());
}
