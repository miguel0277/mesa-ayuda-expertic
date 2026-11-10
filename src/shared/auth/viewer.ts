import "server-only";
import { and, eq, isNull } from "drizzle-orm";
import { headers } from "next/headers";
import { forbidden, redirect } from "next/navigation";
import { cache } from "react";
import { getDb } from "@/shared/db/client";
import { teamMembers, teams, user as userTable } from "@/shared/db/schema";
import { canVisit } from "@/shared/ui/shell/nav";
import { auth } from "./auth";
import type { Actor } from "./permissions";
import { isRole, ROLE_LABEL, type Role } from "./roles";

/**
 * Quién está viendo la app: la sesión de Better Auth + datos para autorizar (equipos).
 * Se resuelve una sola vez por petición (React cache).
 */
export type Viewer = Actor & {
  name: string;
  email: string;
  roleLabel: string;
  image: string | null;
  telefono: string | null;
  programa: string | null;
  codigoUis: string | null;
  /** Si un admin está "viendo como" este usuario: el id del admin. */
  impersonatedBy: string | null;
};

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & Record<string, unknown>;
  const role: Role = isRole(u.role) ? u.role : "estudiante";

  const db = getDb();
  // Estado vigente desde la BD (la caché de la cookie puede tener hasta 5 min).
  const [fresh] = await db
    .select({ status: userTable.status, role: userTable.role })
    .from(userTable)
    .where(eq(userTable.id, u.id))
    .limit(1);
  if (!fresh || fresh.status !== "activo") return null;

  const memberships = await db
    .select({ teamId: teamMembers.teamId, liderId: teams.liderId, active: teams.active })
    .from(teamMembers)
    .innerJoin(teams, eq(teams.id, teamMembers.teamId))
    .where(and(eq(teamMembers.userId, u.id), isNull(teamMembers.until), isNull(teams.deletedAt)));
  const led = await db
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.liderId, u.id), eq(teams.active, true), isNull(teams.deletedAt)));

  const effectiveRole = isRole(fresh.role) ? fresh.role : role;
  return {
    id: u.id,
    role: effectiveRole,
    roleLabel: ROLE_LABEL[effectiveRole],
    name: u.name,
    email: u.email,
    image: u.image ?? null,
    telefono: (u.telefono as string | null | undefined) ?? null,
    programa: (u.programa as string | null | undefined) ?? null,
    codigoUis: (u.codigoUis as string | null | undefined) ?? null,
    teamIds: memberships.filter((m) => m.active).map((m) => m.teamId),
    leadTeamIds: led.map((t) => t.id),
    impersonatedBy: (session.session as { impersonatedBy?: string | null }).impersonatedBy ?? null,
  };
});

/** Exige sesión activa; si no hay, va al inicio de sesión. */
export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

/** Exige sesión y acceso a la ruta; si no, responde con la página 403 amable. */
export async function requireRoute(href: string): Promise<Viewer> {
  const viewer = await requireViewer();
  if (!canVisit(viewer.role, href)) forbidden();
  return viewer;
}
