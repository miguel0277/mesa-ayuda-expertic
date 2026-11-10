import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  assignTicket,
  changeTicketPriority,
  changeTicketStatus,
  createTicket,
  rateTicket,
  replyTicket,
} from "@/modules/tickets/application/ticket-commands";
import type { Actor } from "@/shared/auth/permissions";
import * as s from "@/shared/db/schema";
import { seedDatabase } from "@/shared/db/seed";
import type { Database } from "@/shared/db/types";
import type { UseCaseContext } from "@/shared/kernel/app-event";
import { createTestContainer } from "../helpers/test-container";
import { createTestDatabase, fakeHash } from "../helpers/test-db";

const NOW = new Date("2026-11-10T15:00:00Z");
const meta = { ip: "127.0.0.1", userAgent: "vitest", requestId: "test-req-1" };
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 1]);

describe("casos de uso de tickets (PGlite)", () => {
  let db: Database;
  let close: () => Promise<void>;
  let env: ReturnType<typeof createTestContainer>;
  const actors: Record<string, Actor> = {};
  let typeId = "";
  let ticketId = "";
  let ticketCode = "";

  const ctx = (key: string): UseCaseContext => ({
    actor: actors[key]!,
    meta,
    now: env.clock.now(),
  });

  beforeAll(async () => {
    ({ db, close } = await createTestDatabase());
    await seedDatabase(db, {
      admin: { email: "admin@test.co", password: "x".repeat(10) },
      demo: true,
      now: NOW,
      hashPassword: fakeHash,
    });
    env = createTestContainer(db, NOW);
    const users = await db.select().from(s.user);
    const teams = await db.select().from(s.teams).where(eq(s.teams.active, true));
    const byEmail = (e: string) => users.find((u) => u.email === e)!;
    const mk = (key: string, email: string, lead: string[] = [], member: string[] = []) => {
      const u = byEmail(email);
      actors[key] = { id: u.id, role: u.role, teamIds: member, leadTeamIds: lead };
    };
    const moodle = teams.find((t) => t.name.includes("Moodle"))!;
    mk("estudiante", "estudiante1@expertic.test");
    mk("estudiante2", "estudiante2@expertic.test");
    mk("docente", "docente@expertic.test");
    mk("aux", "aux1@expertic.test", [], [moodle.id]);
    mk("aux4", "aux4@expertic.test");
    mk("lider", "lider1@expertic.test", [moodle.id], [moodle.id]);
    const [type] = await db
      .select()
      .from(s.ticketTypes)
      .where(eq(s.ticketTypes.slug, "errores-moodle"));
    typeId = type!.id;
  });

  afterAll(async () => close());

  it("rechaza valores que no cumplen la plantilla", async () => {
    const r = await createTicket(env.c, ctx("estudiante"), {
      typeId,
      title: "El quiz falla",
      description: "Al enviar el quiz aparece un error.",
      values: { curso: "", navegador: "Netscape" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok)
      expect(Object.keys(r.error.details?.fieldErrors ?? {})).toEqual(
        expect.arrayContaining(["values.curso", "values.navegador"]),
      );
  });

  it("rechaza un adjunto falso (ejecutable con extensión .png)", async () => {
    const r = await createTicket(
      env.c,
      ctx("estudiante"),
      {
        typeId,
        title: "El quiz falla",
        description: "Al enviar el quiz aparece un error.",
        values: { curso: "Física I", navegador: "Chrome", pasos: "Envié el quiz" },
      },
      {
        captura: [
          {
            name: "captura.png",
            type: "image/png",
            size: 4,
            bytes: new Uint8Array([0x4d, 0x5a, 0, 0]),
          },
        ],
      },
    );
    expect(r.ok).toBe(false);
    expect(env.storage.files.size).toBe(0);
  });

  it("el estudiante crea una solicitud con adjunto: código, SLA, auditoría y aviso al docente", async () => {
    const r = await createTicket(
      env.c,
      ctx("estudiante"),
      {
        typeId,
        title: "El quiz de la semana 6 falla",
        description: "Al dar clic en terminar intento aparece un error.",
        values: {
          curso: "Física I",
          navegador: "Chrome",
          pasos: "Abrí el quiz y lo envié.",
          enlace: "",
        },
      },
      {
        captura: [
          { name: "../captura final.png", type: "image/png", size: PNG.length, bytes: PNG },
        ],
      },
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    ticketId = r.value.id;
    ticketCode = r.value.code;
    expect(ticketCode).toMatch(/^EXP-2026-\d{5}$/);

    const [t] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    expect(t?.status).toBe("abierto");
    expect(t?.priority).toBe("alta");
    expect(t?.values).toEqual({
      curso: "Física I",
      navegador: "Chrome",
      pasos: "Abrí el quiz y lo envié.",
    });
    expect(t!.slaFirstResponseDue.getTime()).toBeGreaterThan(NOW.getTime());

    const files = await db.select().from(s.attachments).where(eq(s.attachments.ownerId, ticketId));
    expect(files).toHaveLength(1);
    expect(files[0]?.fileName).toBe("captura final.png");
    expect(env.storage.files.has(files[0]!.storageKey)).toBe(true);

    const audit = await db
      .select()
      .from(s.auditLog)
      .where(and(eq(s.auditLog.entityId, ticketId), eq(s.auditLog.action, "ticket.created")));
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe(actors.estudiante!.id);
    expect(audit[0]?.requestId).toBe("test-req-1");

    const notes = await db
      .select()
      .from(s.notifications)
      .where(
        and(
          eq(s.notifications.userId, actors.docente!.id),
          eq(s.notifications.type, "ticket.created"),
        ),
      );
    expect(notes.some((n) => n.title.includes(ticketCode))).toBe(true);
    const queued = await db.select().from(s.emailOutbox);
    expect(queued.some((e) => e.subject.includes(ticketCode))).toBe(true);
  });

  it("otro estudiante no puede ver ni responder la solicitud", async () => {
    const r = await replyTicket(env.c, ctx("estudiante2"), {
      ticketId,
      body: "hola",
      internal: false,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("NOT_FOUND");
  });

  it("un auxiliar sin asignación no puede asignarse ni responder", async () => {
    expect(
      (await assignTicket(env.c, ctx("aux"), { ticketId, assigneeId: actors.aux!.id })).ok,
    ).toBe(false);
    expect(
      (await replyTicket(env.c, ctx("aux"), { ticketId, body: "x", internal: false })).ok,
    ).toBe(false);
  });

  it("el docente asigna al auxiliar: estado asignado, equipo y aviso", async () => {
    const r = await assignTicket(env.c, ctx("docente"), { ticketId, assigneeId: actors.aux!.id });
    expect(r).toEqual({ ok: true, value: { assigneeId: actors.aux!.id, status: "asignado" } });
    const [t] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    expect(t?.teamId).toBe(actors.aux!.teamIds[0]);
    const notes = await db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, actors.aux!.id));
    expect(notes.some((n) => n.type === "ticket.assigned")).toBe(true);
  });

  it("el estudiante no puede cambiar la prioridad; el líder del equipo sí, y se recalcula el SLA", async () => {
    expect(
      (await changeTicketPriority(env.c, ctx("estudiante"), { ticketId, priority: "baja" })).ok,
    ).toBe(false);
    const [before] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    const r = await changeTicketPriority(env.c, ctx("lider"), { ticketId, priority: "baja" });
    expect(r.ok).toBe(true);
    const [after] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    expect(after!.slaResolutionDue.getTime()).toBeGreaterThan(before!.slaResolutionDue.getTime());
  });

  it("transición inválida: no se puede pasar de asignado a reabierto", async () => {
    const r = await changeTicketStatus(env.c, ctx("aux"), { ticketId, to: "reabierto" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_TRANSITION");
  });

  it("el auxiliar trabaja, deja nota interna y responde", async () => {
    expect((await changeTicketStatus(env.c, ctx("aux"), { ticketId, to: "en_progreso" })).ok).toBe(
      true,
    );
    expect(
      (
        await replyTicket(env.c, ctx("aux"), {
          ticketId,
          body: "Revisé permisos del rol",
          internal: true,
        })
      ).ok,
    ).toBe(true);
    // El solicitante no puede dejar notas internas.
    expect(
      (await replyTicket(env.c, ctx("estudiante"), { ticketId, body: "x", internal: true })).ok,
    ).toBe(false);
    expect(
      (
        await replyTicket(env.c, ctx("aux"), {
          ticketId,
          body: "Ya quedó corregido.",
          internal: false,
        })
      ).ok,
    ).toBe(true);
    expect((await changeTicketStatus(env.c, ctx("aux"), { ticketId, to: "respondido" })).ok).toBe(
      true,
    );

    const [t] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    expect(t?.firstResponseAt).not.toBeNull();
    const studentNotes = await db
      .select()
      .from(s.notifications)
      .where(eq(s.notifications.userId, actors.estudiante!.id));
    expect(studentNotes.some((n) => n.type === "ticket.replied")).toBe(true);
    expect(studentNotes.some((n) => n.type === "ticket.internal_note")).toBe(false);
  });

  it("el estudiante responde (vuelve a en progreso) y luego lo marca resuelto", async () => {
    const r = await replyTicket(env.c, ctx("estudiante"), {
      ticketId,
      body: "Sigue fallando en el celular",
      internal: false,
    });
    expect(r.ok && r.value.status).toBe("en_progreso");
    // El solicitante no puede marcar "respondido".
    expect(
      (await changeTicketStatus(env.c, ctx("estudiante"), { ticketId, to: "respondido" })).ok,
    ).toBe(false);
    expect((await changeTicketStatus(env.c, ctx("aux"), { ticketId, to: "respondido" })).ok).toBe(
      true,
    );
    expect(
      (await changeTicketStatus(env.c, ctx("estudiante"), { ticketId, to: "cerrado" })).ok,
    ).toBe(true);
    const [t] = await db.select().from(s.tickets).where(eq(s.tickets.id, ticketId));
    expect(t?.status).toBe("cerrado");
    expect(t?.closedAt).not.toBeNull();
  });

  it("solo el solicitante califica, y solo con el ticket cerrado", async () => {
    expect((await rateTicket(env.c, ctx("aux"), { ticketId, rating: 5 })).ok).toBe(false);
    expect(
      (await rateTicket(env.c, ctx("estudiante"), { ticketId, rating: 5, comment: "Rápido" })).ok,
    ).toBe(true);
  });

  it("toda la historia quedó en la auditoría, en orden", async () => {
    const rows = await db
      .select()
      .from(s.auditLog)
      .where(eq(s.auditLog.entityId, ticketId))
      .orderBy(s.auditLog.occurredAt, s.auditLog.id);
    expect(rows.map((r) => r.action)).toEqual([
      "ticket.created",
      "ticket.assigned",
      "ticket.priority_changed",
      "ticket.status_changed",
      "ticket.internal_note_added",
      "ticket.replied",
      "ticket.status_changed",
      "ticket.replied",
      "ticket.status_changed",
      "ticket.status_changed",
      "ticket.rated",
    ]);
  });
});
