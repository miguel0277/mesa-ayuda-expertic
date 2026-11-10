import type { Logger } from "pino";
import { FixedClock } from "@/shared/kernel/clock";
import type { Container } from "@/shared/kernel/container";
import { EventBus } from "@/shared/kernel/event-bus";
import { uuidV7Generator } from "@/shared/kernel/id";
import { registerSubscribers } from "@/shared/kernel/subscribers";
import type { Database, DbExecutor } from "@/shared/db/types";
import { MemoryEmail } from "@/shared/email/provider";
import { MemoryStorage } from "@/shared/storage/provider";
import { createLogger } from "@/shared/lib/logger";

/** Contenedor de pruebas: BD real (PGlite), reloj fijo, correo y almacenamiento en memoria. */
export function createTestContainer(db: Database, now = new Date("2026-11-10T15:00:00Z")) {
  const events = new EventBus<DbExecutor>((e) => {
    throw e.error;
  });
  const email = new MemoryEmail();
  const storage = new MemoryStorage();
  const clock = new FixedClock(now);
  const c: Container = {
    db,
    clock,
    ids: uuidV7Generator,
    events,
    storage,
    email,
    logger: createLogger("silent") as Logger,
  };
  registerSubscribers({ events, appUrl: "http://localhost:3000" });
  return { c, email, storage, clock };
}
