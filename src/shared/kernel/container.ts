import "server-only";
import type { Logger } from "pino";
import { getDb } from "@/shared/db/client";
import type { Database, DbExecutor } from "@/shared/db/types";
import { logger } from "@/shared/lib/logger";
import { systemClock, type Clock } from "./clock";
import { EventBus } from "./event-bus";
import { uuidV7Generator, type IdGenerator } from "./id";

/**
 * Composition Root: el único lugar donde se instancian dependencias concretas.
 * Sin librerías de inyección. Los casos de uso reciben un `Container` (o partes de él),
 * lo que permite reemplazar piezas en pruebas.
 *
 * Fases siguientes añaden: storage (StorageProvider), email (EmailProvider),
 * repositorios por módulo y suscriptores (auditoría, notificaciones).
 */
export type Container = {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  events: EventBus<DbExecutor>;
  logger: Logger;
};

let container: Container | undefined;

export function getContainer(): Container {
  if (container) return container;
  const events = new EventBus<DbExecutor>(({ subscriber, event, error }) =>
    logger.error({ subscriber, eventType: event.type, err: error }, "suscriptor no crítico falló"),
  );
  container = { db: getDb(), clock: systemClock, ids: uuidV7Generator, events, logger };
  return container;
}
