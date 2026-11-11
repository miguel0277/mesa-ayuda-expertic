import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { can } from "@/shared/auth/permissions";
import { ROLE_LABEL, ROLES, type Role } from "@/shared/auth/roles";
import { session, teamMembers, teams, user } from "@/shared/db/schema";
import { USER_STATUSES } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";
import {
  type DomainError,
  conflict,
  forbidden,
  notFound,
  validationError,
} from "@/shared/domain/errors";
import { err, ok, type Result } from "@/shared/domain/result";
import { enqueueEmail } from "@/shared/email/outbox";
import { emails } from "@/shared/email/templates";
import { appEvent, type UseCaseContext } from "@/shared/kernel/app-event";
import type { Container } from "@/shared/kernel/container";
import { unitOfWork } from "@/shared/kernel/use-case";

type Deps = Pick<Container, "db" | "events" | "email" | "logger" | "clock" | "ids">;
type UserRow = typeof user.$inferSelect;

const STAFF: readonly Role[] = ["auxiliar", "lider"];

async function loadUser(db: DbExecutor, id: string): Promise<UserRow | null> {
  const [u] = await db.select().from(user).where(eq(user.id, id)).limit(1);
  return u ?? null;
}

/** Cierra las sesiones de alguien para que su nuevo rol o estado aplique de inmediato. */
async function revokeSessions(db: DbExecutor, userId: string) {
  await db.delete(session).where(eq(session.userId, userId));
}

/**
 * ¿Puede el actor gestionar a esta persona y (si aplica) darle este rol?
 * - Nadie se cambia a sí mismo.
 * - El admin gestiona a cualquiera (incluido otorgar o quitar el rol de admin).
 * - El docente solo otorga los roles de auxiliar o líder, y solo gestiona el estado de auxiliares y líderes.
 */
function mayManage(ctx: UseCaseContext, target: UserRow, newRole?: Role): DomainError | null {
  if (target.id === ctx.actor.id) return forbidden("No puedes cambiar tu propio rol o estado.");
  if (can(ctx.actor, "roles.grant.admin")) return null;
  if (!can(ctx.actor, "users.manage")) return forbidden();
  if (target.role === "admin" || target.role === "docente")
    return forbidden("Solo un administrador puede gestionar a esta persona.");
  if (newRole !== undefined) {
    return STAFF.includes(newRole)
      ? null
      : forbidden("Solo puedes otorgar los roles de auxiliar o auxiliar líder.");
  }
  return STAFF.includes(target.role)
    ? null
    : forbidden("Solo puedes gestionar auxiliares y líderes.");
}

// ─────────────────────────────── Aprobar (D-002) ───────────────────────────────

export async function approveUser(
  c: Deps,
  ctx: UseCaseContext,
  input: { userId: string },
  appUrl: string,
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "users.approve"))
    return err(forbidden("Solo el administrador aprueba cuentas del equipo."));
  const u = await loadUser(c.db, input.userId);
  if (!u) return err(notFound("esa cuenta"));
  if (u.status !== "pendiente") return err(conflict("Esa cuenta ya no está pendiente."));
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(user)
      .set({ status: "activo", approvedAt: ctx.now, approvedBy: ctx.actor.id, updatedAt: ctx.now })
      .where(eq(user.id, u.id));
    if (u.emailVerified)
      await enqueueEmail(
        tx,
        emails.accountApproved(u.email, u.name, ROLE_LABEL[u.role], `${appUrl}/login`),
        ctx.now,
      );
    emit(
      appEvent(
        "user.approved",
        ctx,
        { type: "user", id: u.id },
        { before: { status: "pendiente" }, after: { status: "activo", role: u.role } },
      ),
    );
  });
  return ok(true);
}

export async function rejectUser(
  c: Deps,
  ctx: UseCaseContext,
  input: { userId: string },
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "users.approve")) return err(forbidden());
  const u = await loadUser(c.db, input.userId);
  if (!u || u.status !== "pendiente") return err(conflict("Esa cuenta ya no está pendiente."));
  await unitOfWork(c, async (tx, emit) => {
    await tx.update(user).set({ status: "inactivo", updatedAt: ctx.now }).where(eq(user.id, u.id));
    emit(
      appEvent(
        "user.rejected",
        ctx,
        { type: "user", id: u.id },
        { before: { status: "pendiente" }, after: { status: "inactivo" } },
      ),
    );
  });
  return ok(true);
}

// ─────────────────────────────── Rol y estado ───────────────────────────────

export const setRoleInput = z.object({ userId: z.uuid(), role: z.enum(ROLES) });

export async function setUserRole(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof setRoleInput>,
): Promise<Result<true, DomainError>> {
  const u = await loadUser(c.db, input.userId);
  if (!u) return err(notFound("esa persona"));
  const denied = mayManage(ctx, u, input.role);
  if (denied) return err(denied);
  if (u.role === input.role) return ok(true);
  await unitOfWork(c, async (tx, emit) => {
    await tx.update(user).set({ role: input.role, updatedAt: ctx.now }).where(eq(user.id, u.id));
    await revokeSessions(tx, u.id);
    emit(
      appEvent(
        "user.role_changed",
        ctx,
        { type: "user", id: u.id },
        {
          before: { role: u.role },
          after: { role: input.role },
          notify: [
            {
              userId: u.id,
              type: "user.role_changed",
              title: "Tu rol cambió",
              body: `Ahora eres ${ROLE_LABEL[input.role].toLowerCase()} en la Mesa de Ayuda.`,
              href: "/inicio",
              email: true,
            },
          ],
        },
      ),
    );
  });
  return ok(true);
}

export const setStatusInput = z.object({
  userId: z.uuid(),
  status: z.enum(USER_STATUSES),
  reason: z.string().max(300).optional(),
});

export async function setUserStatus(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof setStatusInput>,
): Promise<Result<true, DomainError>> {
  const u = await loadUser(c.db, input.userId);
  if (!u) return err(notFound("esa persona"));
  const denied = mayManage(ctx, u);
  if (denied) return err(denied);
  if (input.status === "bloqueado" && ctx.actor.role !== "admin")
    return err(forbidden("Solo el administrador bloquea cuentas."));
  if (u.status === input.status) return ok(true);
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(user)
      .set({
        status: input.status,
        banned: input.status === "bloqueado",
        banReason:
          input.status === "bloqueado" ? (input.reason ?? "Bloqueado por el administrador") : null,
        updatedAt: ctx.now,
      })
      .where(eq(user.id, u.id));
    if (input.status !== "activo") {
      await revokeSessions(tx, u.id);
      await tx
        .update(teamMembers)
        .set({ until: ctx.now })
        .where(and(eq(teamMembers.userId, u.id), isNull(teamMembers.until)));
    }
    emit(
      appEvent(
        "user.status_changed",
        ctx,
        { type: "user", id: u.id },
        { before: { status: u.status }, after: { status: input.status, reason: input.reason } },
      ),
    );
  });
  return ok(true);
}

/** Cierre de semestre (5.2): desactiva en bloque a los auxiliares y líderes elegidos. Conserva su historial. */
export async function bulkDeactivate(
  c: Deps,
  ctx: UseCaseContext,
  input: { userIds: string[] },
): Promise<Result<{ done: number }, DomainError>> {
  if (!can(ctx.actor, "users.manage")) return err(forbidden());
  const targets = await c.db
    .select()
    .from(user)
    .where(
      and(
        inArray(user.id, input.userIds),
        inArray(user.role, ["auxiliar", "lider"]),
        eq(user.status, "activo"),
      ),
    );
  if (!targets.length) return err(validationError("Elige auxiliares o líderes activos."));
  await unitOfWork(c, async (tx, emit) => {
    for (const u of targets) {
      await tx
        .update(user)
        .set({ status: "inactivo", updatedAt: ctx.now })
        .where(eq(user.id, u.id));
      await revokeSessions(tx, u.id);
      await tx
        .update(teamMembers)
        .set({ until: ctx.now })
        .where(and(eq(teamMembers.userId, u.id), isNull(teamMembers.until)));
      emit(
        appEvent(
          "user.status_changed",
          ctx,
          { type: "user", id: u.id },
          {
            before: { status: "activo" },
            after: { status: "inactivo", reason: "Cierre de semestre" },
          },
        ),
      );
    }
  });
  return ok({ done: targets.length });
}

// ─────────────────────────────── Equipos ───────────────────────────────

export const createTeamInput = z.object({
  name: z.string().trim().min(3, "Escribe un nombre.").max(80),
  semester: z.string().regex(/^\d{4}-[12]$/, "Usa el formato 2026-2."),
  liderId: z.uuid().nullable(),
});

export async function createTeam(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof createTeamInput>,
): Promise<Result<{ id: string }, DomainError>> {
  if (!can(ctx.actor, "users.manage")) return err(forbidden());
  if (input.liderId) {
    const l = await loadUser(c.db, input.liderId);
    if (!l || l.status !== "activo" || l.role !== "lider")
      return err(validationError("El líder debe tener el rol de auxiliar líder."));
  }
  const id = c.ids.next();
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .insert(teams)
      .values({
        id,
        name: input.name,
        semester: input.semester,
        liderId: input.liderId,
        active: true,
        createdBy: ctx.actor.id,
        updatedBy: ctx.actor.id,
        createdAt: ctx.now,
        updatedAt: ctx.now,
      });
    if (input.liderId)
      await tx.insert(teamMembers).values({ teamId: id, userId: input.liderId, since: ctx.now });
    emit(appEvent("team.created", ctx, { type: "team", id }, { after: input }));
  });
  return ok({ id });
}

export const memberInput = z.object({ teamId: z.uuid(), userId: z.uuid() });

export async function addTeamMember(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof memberInput>,
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "users.manage")) return err(forbidden());
  const u = await loadUser(c.db, input.userId);
  if (!u || u.status !== "activo" || !STAFF.includes(u.role))
    return err(validationError("Solo auxiliares y líderes activos pueden estar en un equipo."));
  const [existing] = await c.db
    .select()
    .from(teamMembers)
    .where(
      and(
        eq(teamMembers.teamId, input.teamId),
        eq(teamMembers.userId, input.userId),
        isNull(teamMembers.until),
      ),
    )
    .limit(1);
  if (existing) return err(conflict("Esa persona ya está en el equipo."));
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .insert(teamMembers)
      .values({ teamId: input.teamId, userId: input.userId, since: ctx.now });
    if (u.role === "auxiliar") {
      const [t] = await tx
        .select({ liderId: teams.liderId })
        .from(teams)
        .where(eq(teams.id, input.teamId))
        .limit(1);
      await tx
        .update(user)
        .set({ liderId: t?.liderId ?? null })
        .where(eq(user.id, u.id));
    }
    emit(
      appEvent(
        "team.member_added",
        ctx,
        { type: "team", id: input.teamId },
        { after: { userId: u.id } },
      ),
    );
  });
  return ok(true);
}

export async function removeTeamMember(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof memberInput>,
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "users.manage")) return err(forbidden());
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(teamMembers)
      .set({ until: ctx.now })
      .where(
        and(
          eq(teamMembers.teamId, input.teamId),
          eq(teamMembers.userId, input.userId),
          isNull(teamMembers.until),
        ),
      );
    emit(
      appEvent(
        "team.member_removed",
        ctx,
        { type: "team", id: input.teamId },
        { before: { userId: input.userId } },
      ),
    );
  });
  return ok(true);
}

export async function setTeamActive(
  c: Deps,
  ctx: UseCaseContext,
  input: { teamId: string; active: boolean },
): Promise<Result<true, DomainError>> {
  if (!can(ctx.actor, "users.manage")) return err(forbidden());
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(teams)
      .set({ active: input.active, updatedAt: ctx.now, updatedBy: ctx.actor.id })
      .where(eq(teams.id, input.teamId));
    if (!input.active)
      await tx
        .update(teamMembers)
        .set({ until: ctx.now })
        .where(and(eq(teamMembers.teamId, input.teamId), isNull(teamMembers.until)));
    emit(
      appEvent(
        input.active ? "team.activated" : "team.closed",
        ctx,
        { type: "team", id: input.teamId },
        { after: { active: input.active } },
      ),
    );
  });
  return ok(true);
}

// ─────────────────────────────── Perfil propio (HU-03) ───────────────────────────────

export const updateProfileInput = z.object({
  name: z.string().trim().min(3, "Escribe tu nombre completo.").max(120),
  telefono: z
    .string()
    .trim()
    .max(20)
    .regex(/^[\d\s+()-]*$/, "Escribe solo números.")
    .optional(),
  programa: z.string().trim().max(120).optional(),
  codigoUis: z
    .string()
    .trim()
    .max(20)
    .regex(/^\d*$/, "El código UIS solo lleva números.")
    .optional(),
});

export async function updateMyProfile(
  c: Deps,
  ctx: UseCaseContext,
  input: z.infer<typeof updateProfileInput>,
): Promise<Result<true, DomainError>> {
  const u = await loadUser(c.db, ctx.actor.id);
  if (!u) return err(notFound("tu cuenta"));
  const after = {
    name: input.name,
    telefono: input.telefono || null,
    programa: input.programa || null,
    codigoUis: input.codigoUis || null,
  };
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(user)
      .set({ ...after, updatedAt: ctx.now })
      .where(eq(user.id, u.id));
    emit(
      appEvent(
        "user.profile_updated",
        ctx,
        { type: "user", id: u.id },
        {
          before: {
            name: u.name,
            telefono: u.telefono,
            programa: u.programa,
            codigoUis: u.codigoUis,
          },
          after,
        },
      ),
    );
  });
  return ok(true);
}

export async function setMyAvatar(
  c: Deps,
  ctx: UseCaseContext,
  input: { image: string | null },
): Promise<Result<true, DomainError>> {
  await unitOfWork(c, async (tx, emit) => {
    await tx
      .update(user)
      .set({ image: input.image, updatedAt: ctx.now })
      .where(eq(user.id, ctx.actor.id));
    emit(
      appEvent(
        "user.avatar_changed",
        ctx,
        { type: "user", id: ctx.actor.id },
        { after: { image: !!input.image } },
      ),
    );
  });
  return ok(true);
}
