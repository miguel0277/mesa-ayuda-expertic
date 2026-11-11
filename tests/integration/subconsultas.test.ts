import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listAudit } from "@/modules/audit/infrastructure/audit-queries";
import { tasksSheet, ticketsSheet } from "@/modules/reports/infrastructure/exports";
import { listUsers, teamsWithMembers } from "@/modules/users/infrastructure/user-queries";
import * as s from "@/shared/db/schema";
import { seedDatabase } from "@/shared/db/seed";
import type { Database } from "@/shared/db/types";
import { createTestDatabase, fakeHash } from "../helpers/test-db";

/**
 * Subconsultas correlacionadas contra Postgres real: la columna externa debe ir calificada
 * (`outer()`); si no, Postgres falla por ambigüedad o compara la tabla interna consigo misma.
 */
const NOW = new Date("2026-11-10T15:00:00Z");

describe("subconsultas correlacionadas (PGlite)", () => {
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    ({ db, close } = await createTestDatabase());
    await seedDatabase(db, {
      admin: { email: "admin@test.co", password: "x".repeat(10) },
      demo: true,
      now: NOW,
      hashPassword: fakeHash,
    });
  });
  afterAll(async () => close());

  it("la lista de personas trae el equipo de cada auxiliar", async () => {
    const r = await listUsers(db, { roles: ["auxiliar", "lider"], limit: 200 });
    expect(r.items.length).toBeGreaterThan(0);
    const aux1 = r.items.find((u) => u.email === "aux1@expertic.test");
    expect(aux1?.team).toMatch(/Equipo/);
  });

  it("cada equipo muestra el nombre de su líder real", async () => {
    const list = await teamsWithMembers(db);
    for (const t of list.filter((x) => x.liderId)) {
      const [lider] = await db.select().from(s.user).where(eq(s.user.id, t.liderId!));
      expect(t.liderName).toBe(lider?.name);
    }
  });

  it("la exportación cuenta las evidencias de cada tarea", async () => {
    const sheet = await tasksSheet(db, new Date("2026-01-01"), NOW, NOW, 24);
    const col = sheet.headers.indexOf("Evidencias");
    const total = sheet.rows.reduce((n, r) => n + Number(r[col] ?? 0), 0);
    const [{ n } = { n: 0 }] = await db.$count(s.taskEvidence).then((n) => [{ n }]);
    expect(total).toBe(n);
    expect(total).toBeGreaterThan(0);
  });

  it("la exportación de solicitudes resuelve responsable y equipo", async () => {
    const sheet = await ticketsSheet(db, new Date("2026-01-01"), NOW, NOW);
    expect(sheet.rows.length).toBeGreaterThan(0);
  });

  it("la auditoría resuelve el nombre del actor", async () => {
    const r = await listAudit(db, { limit: 20 });
    expect(r.items.some((i) => i.actorName)).toBe(true);
  });
});
