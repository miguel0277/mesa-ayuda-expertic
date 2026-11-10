import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  addEvidence,
  changeTaskStatus,
  createTask,
  reassignTask,
} from "@/modules/tasks/application/task-commands";
import { myProgress, teamOverview } from "@/modules/tasks/infrastructure/task-queries";
import type { Actor } from "@/shared/auth/permissions";
import * as s from "@/shared/db/schema";
import { seedDatabase } from "@/shared/db/seed";
import type { Database } from "@/shared/db/types";
import type { UseCaseContext } from "@/shared/kernel/app-event";
import { createTestContainer } from "../helpers/test-container";
import { createTestDatabase, fakeHash } from "../helpers/test-db";

const NOW = new Date("2026-11-10T15:00:00Z");
const meta = { ip: "127.0.0.1", userAgent: "vitest", requestId: "t-tareas" };
const PDF = new TextEncoder().encode("%PDF-1.7 acta");

describe("casos de uso de tareas (PGlite)", () => {
  let db: Database;
  let close: () => Promise<void>;
  let env: ReturnType<typeof createTestContainer>;
  const A: Record<string, Actor> = {};
  let moodleTeam = "";
  let contenidosTeam = "";
  let taskId = "";
  const ctx = (k: string): UseCaseContext => ({ actor: A[k]!, meta, now: env.clock.now() });

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
    moodleTeam = teams.find((t) => t.name.includes("Moodle"))!.id;
    contenidosTeam = teams.find((t) => t.name.includes("Contenidos"))!.id;
    const mk = (k: string, email: string, lead: string[] = []) => {
      const u = users.find((x) => x.email === email)!;
      A[k] = { id: u.id, role: u.role, teamIds: [], leadTeamIds: lead };
    };
    mk("docente", "docente@expertic.test");
    mk("lider", "lider1@expertic.test", [moodleTeam]);
    mk("aux", "aux1@expertic.test");
    mk("aux2", "aux2@expertic.test");
    mk("aux4", "aux4@expertic.test");
  });
  afterAll(async () => close());

  it("el docente asigna una tarea: código, aviso y auditoría", async () => {
    const r = await createTask(env.c, ctx("docente"), {
      title: "Revisar enlaces del curso de Física I",
      description: "",
      assigneeId: A.aux!.id,
      teamId: null,
      dueAt: new Date(NOW.getTime() + 2 * 86_400_000),
      priority: "alta",
      ticketId: null,
      requiresEvidence: true,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.codes[0]).toMatch(/^TAR-2026-\d{5}$/);
    const [t] = await db.select().from(s.tasks).where(eq(s.tasks.code, r.value.codes[0]!));
    taskId = t!.id;
    expect(t?.teamId).toBe(moodleTeam);
    const n = await db
      .select()
      .from(s.notifications)
      .where(and(eq(s.notifications.userId, A.aux!.id), eq(s.notifications.type, "task.assigned")));
    expect(n.some((x) => x.title.includes(r.value.codes[0]!))).toBe(true);
  });

  it("asignar a un equipo crea una tarea por integrante", async () => {
    const before = (await db.select().from(s.tasks)).length;
    const r = await createTask(env.c, ctx("docente"), {
      title: "Actualizar banner del semestre",
      description: "",
      assigneeId: null,
      teamId: contenidosTeam,
      dueAt: new Date(NOW.getTime() + 86_400_000 * 3),
      priority: "media",
      ticketId: null,
      requiresEvidence: false,
    });
    expect(r.ok && r.value.codes.length).toBe(4); // líder + 3 auxiliares
    expect((await db.select().from(s.tasks)).length).toBe(before + 4);
  });

  it("el líder no puede asignar fuera de su equipo", async () => {
    const r = await createTask(env.c, ctx("lider"), {
      title: "Tarea ajena",
      description: "",
      assigneeId: A.aux4!.id,
      teamId: null,
      dueAt: new Date(NOW.getTime() + 86_400_000),
      priority: "media",
      ticketId: null,
      requiresEvidence: true,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("FORBIDDEN");
  });

  it("otro auxiliar no puede mover la tarea ajena", async () => {
    expect((await changeTaskStatus(env.c, ctx("aux2"), { taskId, to: "en_progreso" })).ok).toBe(
      false,
    );
  });

  it("completar exige evidencia (5.4)", async () => {
    expect((await changeTaskStatus(env.c, ctx("aux"), { taskId, to: "en_progreso" })).ok).toBe(
      true,
    );
    const r = await changeTaskStatus(env.c, ctx("aux"), { taskId, to: "completada" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.message).toMatch(/evidencia/);
  });

  it("evidencia con archivo y nota completa la tarea en una sola operación", async () => {
    const r = await addEvidence(
      env.c,
      ctx("aux"),
      { taskId, note: "Corregí 4 enlaces rotos.", complete: true },
      [{ name: "acta.pdf", type: "application/pdf", size: PDF.length, bytes: PDF }],
    );
    expect(r.ok && r.value.status).toBe("completada");
    const [t] = await db.select().from(s.tasks).where(eq(s.tasks.id, taskId));
    expect(t?.completedAt).not.toBeNull();
    const files = await db
      .select()
      .from(s.attachments)
      .where(eq(s.attachments.ownerType, "evidence"));
    expect(files.length).toBeGreaterThan(0);
    const audit = await db.select().from(s.auditLog).where(eq(s.auditLog.entityId, taskId));
    expect(audit.map((a) => a.action)).toEqual(
      expect.arrayContaining([
        "task.created",
        "task.status_changed",
        "task.evidence_added",
        "task.completed",
      ]),
    );
  });

  it("solo quien asignó puede cancelar", async () => {
    const r = await createTask(env.c, ctx("lider"), {
      title: "Respaldo semanal",
      description: "",
      assigneeId: A.aux2!.id,
      teamId: null,
      dueAt: new Date(NOW.getTime() + 86_400_000),
      priority: "baja",
      ticketId: null,
      requiresEvidence: false,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const [t] = await db.select().from(s.tasks).where(eq(s.tasks.code, r.value.codes[0]!));
    expect(
      (await changeTaskStatus(env.c, ctx("aux2"), { taskId: t!.id, to: "cancelada" })).ok,
    ).toBe(false);
    expect(
      (await changeTaskStatus(env.c, ctx("docente"), { taskId: t!.id, to: "cancelada" })).ok,
    ).toBe(false);
    expect(
      (
        await changeTaskStatus(env.c, ctx("lider"), {
          taskId: t!.id,
          to: "cancelada",
          reason: "Ya no aplica",
        })
      ).ok,
    ).toBe(true);
  });

  it("el líder reasigna dentro de su equipo", async () => {
    const r = await createTask(env.c, ctx("docente"), {
      title: "Cargar videos semana 7",
      description: "",
      assigneeId: A.aux!.id,
      teamId: null,
      dueAt: new Date(NOW.getTime() + 86_400_000 * 5),
      priority: "media",
      ticketId: null,
      requiresEvidence: true,
    });
    if (!r.ok) throw new Error("no creó");
    const [t] = await db.select().from(s.tasks).where(eq(s.tasks.code, r.value.codes[0]!));
    expect(
      (await reassignTask(env.c, ctx("lider"), { taskId: t!.id, assigneeId: A.aux2!.id })).ok,
    ).toBe(true);
    expect(
      (await reassignTask(env.c, ctx("lider"), { taskId: t!.id, assigneeId: A.aux4!.id })).ok,
    ).toBe(false);
  });

  it("progreso y panel del equipo coinciden con el semáforo", async () => {
    const p = await myProgress(db, A.aux!.id, NOW);
    expect(p.overall.completed).toBeGreaterThan(0);
    expect(p.streak).toBeGreaterThanOrEqual(0);
    const team = await teamOverview(db, [moodleTeam], NOW);
    expect(team.members.length).toBe(4);
    expect(
      team.members.every(
        (m) => m.signal === null || ["a_tiempo", "en_riesgo", "atrasada"].includes(m.signal),
      ),
    ).toBe(true);
    expect(team.feed.length).toBeGreaterThan(0);
  });
});
