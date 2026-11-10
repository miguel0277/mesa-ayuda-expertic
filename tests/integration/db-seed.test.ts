import { and, eq, isNull, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as s from "@/shared/db/schema";
import { seedDatabase } from "@/shared/db/seed";
import { TICKET_TYPES } from "@/shared/db/seed/catalog";
import { DEMO_USERS } from "@/shared/db/seed/demo-data";
import type { Database } from "@/shared/db/types";
import { templateFieldsSchema } from "@/modules/templates/domain/template-field";
import { createTestDatabase, fakeHash } from "../helpers/test-db";

const NOW = new Date("2026-11-10T15:00:00.000Z"); // martes 10:00 a. m. en Bogotá

describe("migraciones + semilla (PGlite)", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDatabase());
    await seedDatabase(db, {
      admin: { email: "Admin@Ejemplo.com", password: "clave-segura-123" },
      demo: true,
      now: NOW,
      hashPassword: fakeHash,
    });
  });

  afterAll(async () => close());

  it("crea el admin (correo normalizado) con cuenta de credenciales", async () => {
    const [admin] = await db.select().from(s.user).where(eq(s.user.email, "admin@ejemplo.com"));
    expect(admin?.role).toBe("admin");
    expect(admin?.status).toBe("activo");
    const accounts = await db.select().from(s.account).where(eq(s.account.userId, admin!.id));
    expect(accounts).toHaveLength(1);
    expect(accounts[0]?.providerId).toBe("credential");
  });

  it("crea los usuarios por rol que pide la especificación", async () => {
    const rows = await db
      .select({ role: s.user.role, n: sql<number>`count(*)::int` })
      .from(s.user)
      .groupBy(s.user.role);
    const byRole = Object.fromEntries(rows.map((r) => [r.role, r.n]));
    expect(byRole).toEqual({
      admin: 1,
      docente: 1,
      lider: 2,
      auxiliar: 6,
      profesor: 5,
      estudiante: 10,
    });
    expect(DEMO_USERS.filter((u) => u.status === "pendiente").length).toBeGreaterThan(0);
  });

  it("siembra las 6 categorías con plantillas válidas y sin edificio/salón", async () => {
    const types = await db.select().from(s.ticketTypes);
    expect(types.map((t) => t.slug).sort()).toEqual(TICKET_TYPES.map((t) => t.slug).sort());
    for (const t of types) {
      expect(templateFieldsSchema.safeParse(t.fields).success).toBe(true);
      expect(t.fields.some((f) => ["edificio", "salon"].includes(f.key))).toBe(false);
    }
  });

  it("crea 2 equipos activos de 2026-2 (líder + 3 auxiliares) y uno histórico", async () => {
    const active = await db.select().from(s.teams).where(eq(s.teams.active, true));
    expect(active).toHaveLength(2);
    for (const team of active) {
      const members = await db
        .select()
        .from(s.teamMembers)
        .where(and(eq(s.teamMembers.teamId, team.id), isNull(s.teamMembers.until)));
      expect(members).toHaveLength(4);
    }
    const history = await db.select().from(s.teams).where(eq(s.teams.active, false));
    expect(history).toHaveLength(1);
  });

  it("crea 40 tickets con códigos legibles, autor, fecha y SLA calculado", async () => {
    const rows = await db.select().from(s.tickets);
    expect(rows).toHaveLength(40);
    for (const t of rows) {
      expect(t.code).toMatch(/^EXP-\d{4}-\d{5}$/);
      expect(t.requesterId).toBeTruthy();
      expect(t.createdBy).toBe(t.requesterId);
      expect(t.slaFirstResponseDue.getTime()).toBeGreaterThan(t.createdAt.getTime());
      expect(t.slaResolutionDue.getTime()).toBeGreaterThanOrEqual(t.slaFirstResponseDue.getTime());
    }
    expect(new Set(rows.map((t) => t.status)).size).toBe(6);
  });

  it("cada ticket tiene su evento de creación en la auditoría", async () => {
    const [{ n } = { n: 0 }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(s.auditLog)
      .where(eq(s.auditLog.action, "ticket.created"));
    expect(n).toBe(40);
  });

  it("crea 60 tareas que producen los tres colores del semáforo", async () => {
    const rows = await db.select().from(s.tasks);
    expect(rows).toHaveLength(60);
    const now = NOW.getTime();
    const open = rows.filter((t) => t.status === "pendiente" || t.status === "en_progreso");
    const red = open.filter((t) => t.dueAt && t.dueAt.getTime() < now);
    const amber = open.filter(
      (t) => t.dueAt && t.dueAt.getTime() >= now && t.dueAt.getTime() - now <= 24 * 3600e3,
    );
    const green = open.filter((t) => t.dueAt && t.dueAt.getTime() - now > 24 * 3600e3);
    const late = rows.filter((t) => t.status === "completada" && t.completedAt! > t.dueAt!);
    expect(red.length).toBeGreaterThan(0);
    expect(amber.length).toBeGreaterThan(0);
    expect(green.length).toBeGreaterThan(0);
    expect(late.length).toBeGreaterThan(0);
  });

  it("las tareas completadas tienen evidencia", async () => {
    const rows = await db
      .select({ id: s.tasks.id, ev: sql<number>`count(${s.taskEvidence.id})::int` })
      .from(s.tasks)
      .leftJoin(s.taskEvidence, eq(s.taskEvidence.taskId, s.tasks.id))
      .where(eq(s.tasks.status, "completada"))
      .groupBy(s.tasks.id);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.ev >= 1)).toBe(true);
  });

  it("las vistas de paneles responden", async () => {
    const compliance = await db.select().from(s.vTaskCompliance);
    expect(compliance.length).toBeGreaterThan(0);
    const sla = await db.select().from(s.vTicketSla);
    expect(sla).toHaveLength(40);
    expect(
      sla.every((x) => ["cumplido", "incumplido", "en_curso", "vencido"].includes(x.slaState)),
    ).toBe(true);
  });

  it("audit_log es solo de inserción (UPDATE y DELETE fallan)", async () => {
    const [row] = await db.select().from(s.auditLog).limit(1);
    await expect(
      db.update(s.auditLog).set({ action: "x" }).where(eq(s.auditLog.id, row!.id)),
    ).rejects.toThrow();
    await expect(db.delete(s.auditLog).where(eq(s.auditLog.id, row!.id))).rejects.toThrow();
  });

  it("no permite sembrar la demostración dos veces sin --reset", async () => {
    await expect(
      seedDatabase(db, {
        admin: { email: "admin@ejemplo.com", password: "x".repeat(12) },
        demo: true,
        now: NOW,
        hashPassword: fakeHash,
      }),
    ).rejects.toThrow(/--reset/);
  });

  it("--solo-catalogo es idempotente y --reset deja todo de nuevo", async () => {
    await seedDatabase(db, {
      admin: { email: "admin@ejemplo.com", password: "x".repeat(12) },
      demo: false,
      hashPassword: fakeHash,
    });
    const types = await db.select().from(s.ticketTypes);
    expect(types).toHaveLength(6);

    await seedDatabase(db, {
      admin: { email: "admin@ejemplo.com", password: "x".repeat(12) },
      demo: true,
      reset: true,
      now: NOW,
      hashPassword: fakeHash,
    });
    const [first] = await db
      .select({ code: s.tickets.code })
      .from(s.tickets)
      .orderBy(s.tickets.code)
      .limit(1);
    expect(first?.code).toMatch(/-00001$/);
  });
});
