import type { Metadata } from "next";
import { staffCandidates, teamsWithMembers } from "@/modules/users/infrastructure/user-queries";
import { TeamsManager } from "@/modules/users/ui/teams-manager";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Equipos" };

/** Equipos de todos los semestres, incluido el historial de los cerrados. */
export default async function AdminEquiposPage() {
  await requireRoute("/admin/equipos");
  const db = getDb();
  const [teams, candidates] = await Promise.all([
    teamsWithMembers(db, { includeClosed: true }),
    staffCandidates(db),
  ]);
  return (
    <>
      <PageHeader
        title="Equipos"
        description="Todos los equipos, activos y cerrados. Los cerrados conservan quién estuvo y hasta cuándo."
      />
      <TeamsManager teams={teams} candidates={candidates} />
    </>
  );
}
