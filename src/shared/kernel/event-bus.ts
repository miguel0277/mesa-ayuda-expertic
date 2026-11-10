/**
 * Bus de eventos de dominio en proceso (patrón Observer).
 *
 * - Suscriptores "críticos" (p. ej. auditoría) corren dentro de la misma transacción:
 *   si fallan, la operación completa se revierte.
 * - Suscriptores "no críticos" (p. ej. correo) nunca rompen la operación principal:
 *   sus errores se reportan al `onError` (que los registra para reintento).
 *
 * Es síncrono por petición y no guarda estado entre peticiones (servidor stateless).
 */

export interface DomainEvent<TType extends string = string, TPayload = unknown> {
  readonly type: TType;
  readonly occurredAt: Date;
  readonly payload: TPayload;
}

export type EventContext<TTx = unknown> = {
  /** Transacción activa, para que los suscriptores críticos escriban en ella. */
  readonly tx: TTx;
};

export type EventHandler<TEvent extends DomainEvent, TTx = unknown> = (
  event: TEvent,
  ctx: EventContext<TTx>,
) => Promise<void> | void;

type Registration<TTx> = {
  readonly pattern: string;
  readonly handler: EventHandler<DomainEvent, TTx>;
  readonly critical: boolean;
  readonly name: string;
};

export type SubscriberError = { subscriber: string; event: DomainEvent; error: unknown };

/** `ticket.*` coincide con `ticket.created`; `*` coincide con todo. */
export function matchesPattern(pattern: string, type: string): boolean {
  if (pattern === "*" || pattern === type) return true;
  if (pattern.endsWith(".*")) return type.startsWith(pattern.slice(0, -1));
  return false;
}

export class EventBus<TTx = unknown> {
  private readonly registrations: Registration<TTx>[] = [];

  constructor(private readonly onError: (e: SubscriberError) => void = () => {}) {}

  subscribe<TEvent extends DomainEvent>(
    pattern: string,
    handler: EventHandler<TEvent, TTx>,
    options: { critical?: boolean; name?: string } = {},
  ): () => void {
    const registration: Registration<TTx> = {
      pattern,
      handler: handler as EventHandler<DomainEvent, TTx>,
      critical: options.critical ?? false,
      name: options.name ?? (handler.name || "anónimo"),
    };
    this.registrations.push(registration);
    return () => {
      const i = this.registrations.indexOf(registration);
      if (i >= 0) this.registrations.splice(i, 1);
    };
  }

  /**
   * Publica eventos. Primero corren los críticos (en orden de registro; un fallo se propaga),
   * luego los no críticos (un fallo se reporta y se continúa).
   */
  async publish(
    events: DomainEvent | readonly DomainEvent[],
    ctx: EventContext<TTx>,
  ): Promise<void> {
    const list = Array.isArray(events) ? events : [events as DomainEvent];
    for (const event of list) {
      const matching = this.registrations.filter((r) => matchesPattern(r.pattern, event.type));
      for (const r of matching.filter((m) => m.critical)) {
        await r.handler(event, ctx);
      }
      for (const r of matching.filter((m) => !m.critical)) {
        try {
          await r.handler(event, ctx);
        } catch (error) {
          this.onError({ subscriber: r.name, event, error });
        }
      }
    }
  }
}

export function createEvent<TType extends string, TPayload>(
  type: TType,
  payload: TPayload,
  occurredAt: Date,
): DomainEvent<TType, TPayload> {
  return { type, payload, occurredAt };
}
