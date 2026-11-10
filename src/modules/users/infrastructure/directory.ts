import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Role } from "@/shared/auth/roles";
import { teamMembers, teams, user } from "@/shared/db/schema";
import type { DbExecutor } from "@/shared/db/types";

/**
 * Directorio de personas: consultas de solo lectura que necesitan varios casos de uso
 * (destinatarios de avisos, equipo de un auxiliar, líder de un equipo).
 */
export class Directory {
  constructor(private readonly db: DbExecutor) {}

  async activeIdsByRole(roles: Role[]): Promise<string[]> {
    const rows = await this.db
      .select({ id: user.id })
      .from(user)
      .where(and(inArray(user.role, roles), eq(user.status, "activo")));
    return rows.map((r) => r.id);
  }

  async basic(id: string) {
    const [row] = await this.db
      .select({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return row ?? null;
  }

  /** Equipo activo vigente de una persona (el primero si tuviera varios). */
  async activeTeamOf(userId: string): Promise<string | null> {
    const [row] = await this.db
      .select({ teamId: teamMembers.teamId })
      .from(teamMembers)
      .innerJoin(teams, eq(teams.id, teamMembers.teamId))
      .where(and(eq(teamMembers.userId, userId), isNull(teamMembers.until), eq(teams.active, true)))
      .limit(1);
    return row?.teamId ?? null;
  }

  async teamLeader(teamId: string | null | undefined): Promise<string | null> {
    if (!teamId) return null;
    const [row] = await this.db
      .select({ liderId: teams.liderId })
      .from(teams)
      .where(eq(teams.id, teamId))
      .limit(1);
    return row?.liderId ?? null;
  }
}
