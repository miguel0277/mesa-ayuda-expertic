import type { Metadata } from "next";
import Link from "next/link";
import { listUsers, pendingCount } from "@/modules/users/infrastructure/user-queries";
import { CreateUserDialog } from "@/modules/users/ui/create-user-dialog";
import { UserFilters } from "@/modules/users/ui/user-filters";
import { UsersTable } from "@/modules/users/ui/users-table";
import { isRole, ROLES } from "@/shared/auth/roles";
import { requireRoute } from "@/shared/auth/viewer";
import { getDb } from "@/shared/db/client";
import { USER_STATUSES, type UserStatus } from "@/shared/db/schema/enums";
import { Button } from "@/shared/ui/components/button";
import { PageHeader } from "@/shared/ui/states";

export const metadata: Metadata = { title: "Usuarios" };

const PAGE = 50;

/** Consola de usuarios (HU-50): crear, aprobar, cambiar rol, bloquear, restablecer y "ver como". */
export default async function AdminUsuariosPage({ searchParams }: PageProps<"/admin/usuarios">) {
  const viewer = await requireRoute("/admin/usuarios");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const role = typeof sp.rol === "string" && isRole(sp.rol) ? sp.rol : undefined;
  const status =
    typeof sp.estado === "string" && (USER_STATUSES as readonly string[]).includes(sp.estado)
      ? (sp.estado as UserStatus)
      : undefined;
  const page = Math.max(0, Number(sp.pagina) || 0);
  const db = getDb();
  const [list, pending] = await Promise.all([
    listUsers(db, {
      q,
      roles: role ? [role] : undefined,
      status: status ? [status] : undefined,
      limit: PAGE,
      offset: page * PAGE,
    }),
    pendingCount(db),
  ]);
  const qs = (p: number) => {
    const s = new URLSearchParams();
    if (q) s.set("q", q);
    if (role) s.set("rol", role);
    if (status) s.set("estado", status);
    if (p) s.set("pagina", String(p));
    return `/admin/usuarios${s.size ? `?${s}` : ""}`;
  };

  return (
    <>
      <PageHeader
        title="Usuarios"
        description={
          pending
            ? `${pending} cuenta(s) esperan tu aprobación.`
            : "Todas las cuentas de la Mesa de Ayuda."
        }
        actions={<CreateUserDialog />}
      />
      <div className="flex flex-col gap-4">
        <UserFilters
          action="/admin/usuarios"
          q={q}
          role={role}
          status={status}
          roles={[...ROLES]}
        />
        {pending > 0 && status !== "pendiente" && (
          <Link
            href="/admin/usuarios?estado=pendiente"
            className="w-fit rounded-lg bg-risk-soft px-3 py-2 text-sm font-medium text-risk hover:underline"
          >
            Ver las {pending} cuenta(s) pendientes de aprobación
          </Link>
        )}
        <UsersTable users={list.items} actor={viewer} />
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span className="tabular">{list.total} persona(s)</span>
          <div className="flex gap-2">
            {page > 0 && (
              <Button asChild variant="ghost" size="sm">
                <Link href={qs(page - 1)}>Anteriores</Link>
              </Button>
            )}
            {list.hasMore && (
              <Button asChild variant="outline" size="sm">
                <Link href={qs(page + 1)}>Siguientes</Link>
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
