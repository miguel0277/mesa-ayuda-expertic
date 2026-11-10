import { and, eq, isNull, sql } from "drizzle-orm";
import { attachments, ticketMessages, tickets } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";
import type {
  NewAttachment,
  NewMessage,
  NewTicket,
  TicketRecord,
  TicketRepository,
} from "../domain/ticket-repository";

const bogotaYear = (d: Date) =>
  Number(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Bogota", year: "numeric" }).format(d),
  );

export class DrizzleTicketRepository implements TicketRepository {
  constructor(private readonly db: DbExecutor) {}

  async byId(id: string): Promise<TicketRecord | null> {
    const [row] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async byIdForUpdate(id: string): Promise<TicketRecord | null> {
    const [row] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, id), isNull(tickets.deletedAt)))
      .limit(1)
      .for("update");
    return row ?? null;
  }

  async byCode(code: string): Promise<TicketRecord | null> {
    const [row] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.code, code.toUpperCase()), isNull(tickets.deletedAt)))
      .limit(1);
    return row ?? null;
  }

  async nextCode(at: Date): Promise<string> {
    const res = await this.db.execute<{ n: string }>(sql`select nextval('ticket_code_seq') as n`);
    const rows =
      (res as unknown as { rows?: { n: string }[] }).rows ?? (res as unknown as { n: string }[]);
    const n = Number(rows[0]?.n);
    return `EXP-${bogotaYear(at)}-${String(n).padStart(5, "0")}`;
  }

  async insert(ticket: NewTicket): Promise<void> {
    await this.db.insert(tickets).values(ticket);
  }

  async update(id: string, patch: Partial<NewTicket>): Promise<void> {
    await this.db.update(tickets).set(patch).where(eq(tickets.id, id));
  }

  async addMessage(message: NewMessage): Promise<void> {
    await this.db.insert(ticketMessages).values(message);
  }

  async addAttachments(rows: NewAttachment[]): Promise<void> {
    if (rows.length) await this.db.insert(attachments).values(rows);
  }
}
