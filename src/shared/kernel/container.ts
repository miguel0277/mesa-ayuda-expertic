import "server-only";
import type { Logger } from "pino";
import { getDb } from "@/shared/db/client";
import type { Database, DbExecutor } from "@/shared/db/types";
import { getEmailProvider } from "@/shared/email";
import type { EmailProvider } from "@/shared/email/provider";
import { logger } from "@/shared/lib/logger";
import { getStorage } from "@/shared/storage";
import type { StorageProvider } from "@/shared/storage/provider";
import { systemClock, type Clock } from "./clock";
import { EventBus } from "./event-bus";
import { uuidV7Generator, type IdGenerator } from "./id";
import { registerSubscribers } from "./subscribers";

/**
 * Composition Root: el único lugar donde se instancian las dependencias concretas.
 * Sin librerías de inyección. Los casos de uso reciben un `Container`, así las pruebas
 * pueden pasar uno con PGlite, reloj fijo, correo y almacenamiento en memoria.
 */
export type Container = {
  db: Database;
  clock: Clock;
  ids: IdGenerator;
  events: EventBus<DbExecutor>;
  storage: StorageProvider;
  email: EmailProvider;
  logger: Logger;
};

let container: Container | undefined;

export function getContainer(): Container {
  if (container) return container;
  const events = new EventBus<DbExecutor>(({ subscriber, event, error }) =>
    logger.error({ subscriber, eventType: event.type, err: error }, "suscriptor no crítico falló"),
  );
  container = {
    db: getDb(),
    clock: systemClock,
    ids: uuidV7Generator,
    events,
    storage: getStorage(),
    email: getEmailProvider(),
    logger,
  };
  registerSubscribers(container);
  return container;
}
