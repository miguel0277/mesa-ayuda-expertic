import type { Metadata } from "next";
import Link from "next/link";
import {
  listUsers,
  pendingCount,
  staffCandidates,
  teamsWithMembers,
} from "@/modules/users/infrastructure/user-queries";
import { GrantRole } from "@/modules/users/ui/grant-role";
import { TeamsManager } from "@/modules/users/ui/teams-manager";
import { UsersTable } from "@/modules/users/ui/users-table";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Auxiliares y equipos" };

/** Gestión de auxiliares y equipos del docente (HU-43). */
export default async function AuxiliaresPage({ searchParams }: PageProps<"/panel/auxiliares">) {
  const viewer = await requireRoute("/panel/auxiliares");
  const tab = (await searchParams).ver === "personal" ? "personal" : "equipos";
  const db = getDb();
  const [teamList, candidates, staff, pending] = await Promise.all([
    teamsWithMembers(db),
    staffCandidates(db),
    tab === "personal"
      ? listUsers(db, { roles: ["auxiliar", "lider"], limit: 200 })
      : Promise.resolve({ items: [], total: 0, hasMore: false }),
    pendingCount(db),
  ]);

  return (
    <>
      <PageHeader
        title="Auxiliares y equipos"
        description="Arma los equipos de cada semestre, otorga roles y, al cerrar el semestre, desactiva al personal en bloque."
      />
      <div className="flex flex-col gap-4">
        <nav aria-label="Secciones" className="tab-strip">
          {[
            { key: "equipos", label: "Equipos del semestre", href: "/panel/auxiliares" },
            { key: "personal", label: "Personal", href: "/panel/auxiliares?ver=personal" },
          ].map((t) => (
            <Link
              key={t.key}
              href={t.href}
              aria-current={tab === t.key ? "page" : undefined}
              className="tab-item"
            >
              {t.label}
            </Link>
          ))}
        </nav>
        {pending > 0 && (
          <p className="rounded-lg bg-muted/60 px-3 py-2 text-sm text-muted-foreground">
            Hay {pending} cuenta(s) del equipo esperando aprobación. Las aprueba el administrador
            (D-002).
          </p>
        )}
        {tab === "equipos" ? (
          <TeamsManager teams={teamList} candidates={candidates} />
        ) : (
          <div className="flex flex-col gap-4">
            <GrantRole />
            <UsersTable users={staff.items} actor={viewer} selectable />
          </div>
        )}
      </div>
    </>
  );
}
