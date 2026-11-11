import { and, asc, desc, eq, ilike, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { outer } from "@/shared/db/sql";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { teamMembers, teams, user } from "@/shared/db/schema";
import type { UserStatus } from "@/shared/db/schema/enums";
import type { DbExecutor } from "@/shared/db/types";

export type UserRowDTO = {
  id: string;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  requestedRole: Role | null;
  status: UserStatus;
  emailVerified: boolean;
  codigoUis: string | null;
  programa: string | null;
  createdAt: string;
  team: string | null;
};

export async function listUsers(
  db: DbExecutor,
  f: { q?: string; roles?: Role[]; status?: UserStatus[]; limit?: number; offset?: number },
) {
  const where: (SQL | undefined)[] = [];
  if (f.q?.trim()) {
    const q = `%${f.q.trim()}%`;
    where.push(or(ilike(user.name, q), ilike(user.email, q), ilike(user.codigoUis, q)));
  }
  if (f.roles?.length) where.push(inArray(user.role, f.roles));
  if (f.status?.length) where.push(inArray(user.status, f.status));
  const limit = f.limit ?? 50;
  const rows = await db
    .select({
      u: user,
      team: sql<
        string | null
      >`(select t.name from ${teamMembers} m join ${teams} t on t.id = m.team_id where m.user_id = ${outer(user.id)} and m.until is null and t.active limit 1)`,
    })
    .from(user)
    .where(and(...where))
    .orderBy(sql`case ${user.status} when 'pendiente' then 0 else 1 end`, asc(user.name))
    .limit(limit + 1)
    .offset(f.offset ?? 0);
  const [{ total } = { total: 0 }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(user)
    .where(and(...where));
  return {
    total,
    hasMore: rows.length > limit,
    items: rows.slice(0, limit).map(({ u, team }) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      roleLabel: ROLE_LABEL[u.role],
      requestedRole: u.requestedRole,
      status: u.status,
      emailVerified: u.emailVerified,
      codigoUis: u.codigoUis,
      programa: u.programa,
      createdAt: u.createdAt.toISOString(),
      team,
    })) satisfies UserRowDTO[],
  };
}

export async function pendingCount(db: DbExecutor) {
  const [r] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(user)
    .where(eq(user.status, "pendiente"));
  return r?.n ?? 0;
}

/** Equipos con sus integrantes vigentes (y el historial de los cerrados). */
export async function teamsWithMembers(db: DbExecutor, opts: { includeClosed?: boolean } = {}) {
  const list = await db
    .select({
      id: teams.id,
      name: teams.name,
      semester: teams.semester,
      active: teams.active,
      liderId: teams.liderId,
      liderName: sql<
        string | null
      >`(select u.name from ${user} u where u.id = ${outer(teams.liderId)})`,
    })
    .from(teams)
    .where(and(isNull(teams.deletedAt), opts.includeClosed ? undefined : eq(teams.active, true)))
    .orderBy(desc(teams.active), desc(teams.semester), asc(teams.name));
  const ids = list.map((t) => t.id);
  const members = ids.length
    ? await db
        .select({
          teamId: teamMembers.teamId,
          id: user.id,
          name: user.name,
          role: user.role,
          since: teamMembers.since,
          until: teamMembers.until,
        })
        .from(teamMembers)
        .innerJoin(user, eq(user.id, teamMembers.userId))
        .where(inArray(teamMembers.teamId, ids))
        .orderBy(asc(user.name))
    : [];
  return list.map((t) => ({
    ...t,
    members: members
      .filter((m) => m.teamId === t.id && (!m.until || !t.active))
      .map((m) => ({
        id: m.id,
        name: m.name,
        role: ROLE_LABEL[m.role],
        since: m.since.toISOString(),
        until: m.until?.toISOString() ?? null,
      })),
  }));
}

/** Personal activo sin equipo vigente (para armar equipos). */
export async function staffCandidates(db: DbExecutor) {
  return db
    .select({ id: user.id, name: user.name, role: user.role })
    .from(user)
    .where(and(inArray(user.role, ["auxiliar", "lider"]), eq(user.status, "activo")))
    .orderBy(asc(user.name));
}

/** Personas activas a las que se podría otorgar un rol de personal. */
export async function promotableUsers(db: DbExecutor, q: string) {
  if (q.trim().length < 2) return [];
  const like = `%${q.trim()}%`;
  return db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(
      and(
        eq(user.status, "activo"),
        inArray(user.role, ["estudiante", "profesor", "auxiliar", "lider"]),
        or(ilike(user.name, like), ilike(user.email, like)),
      ),
    )
    .limit(8);
}
