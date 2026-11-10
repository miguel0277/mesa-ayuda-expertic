import type { attachments, ticketMessages, tickets } from "@/shared/db/schema";

/** Agregado Ticket tal como lo guarda la BD. */
export type TicketRecord = typeof tickets.$inferSelect;
export type NewTicket = typeof tickets.$inferInsert;
export type NewMessage = typeof ticketMessages.$inferInsert;
export type NewAttachment = typeof attachments.$inferInsert;

/** Repositorio del agregado Ticket (los casos de uso dependen de esta interfaz, no de Drizzle). */
export interface TicketRepository {
  byId(id: string): Promise<TicketRecord | null>;
  /** Lee el ticket bloqueándolo para actualizar dentro de la transacción. */
  byIdForUpdate(id: string): Promise<TicketRecord | null>;
  byCode(code: string): Promise<TicketRecord | null>;
  nextCode(at: Date): Promise<string>;
  insert(ticket: NewTicket): Promise<void>;
  update(id: string, patch: Partial<NewTicket>): Promise<void>;
  addMessage(message: NewMessage): Promise<void>;
  addAttachments(rows: NewAttachment[]): Promise<void>;
}
