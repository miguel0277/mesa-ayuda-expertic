"use client";

import {
  Ban,
  CircleCheck,
  Eye,
  KeyRound,
  MailWarning,
  MoreHorizontal,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { authClient } from "@/shared/auth/auth-client";
import { can, type Actor } from "@/shared/auth/permissions";
import { ROLE_LABEL, ROLES, type Role } from "@/shared/auth/roles";
import type { UserStatus } from "@/shared/db/schema/enums";
import { formatDate } from "@/shared/lib/dates";
import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { useConfirm } from "@/shared/ui/confirm";
import { EmptyState } from "@/shared/ui/states";
import type { UserRowDTO } from "../infrastructure/user-queries";
import {
  approveUserAction,
  bulkDeactivateAction,
  rejectUserAction,
  resetAccessAction,
  setRoleAction,
  setStatusAction,
} from "./actions";

const STATUS: Record<UserStatus, { label: string; cls: string }> = {
  activo: { label: "Activo", cls: "bg-ok-soft text-ok" },
  pendiente: { label: "Pendiente", cls: "bg-risk-soft text-risk" },
  inactivo: { label: "Inactivo", cls: "bg-muted text-muted-foreground" },
  bloqueado: { label: "Bloqueado", cls: "bg-late-soft text-late" },
};

export function UsersTable({
  users,
  actor,
  selectable,
}: {
  users: UserRowDTO[];
  actor: Actor;
  selectable?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const isAdmin = can(actor, "roles.grant.admin");
  const confirm = useConfirm();

  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, success: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) {
        toast.error(r.error?.message ?? "No se pudo completar.");
        return;
      }
      toast.success(success);
      router.refresh();
    });

  const impersonate = (u: UserRowDTO) =>
    start(async () => {
      const { error } = await authClient.admin.impersonateUser({ userId: u.id });
      if (error) {
        toast.error("No pudimos abrir la vista de esa persona.");
        return;
      }
      router.replace("/inicio");
      router.refresh();
    });

  if (!users.length)
    return (
      <EmptyState
        icon={Users}
        title="No hay personas con esos filtros"
        description="Prueba con otra búsqueda."
      />
    );

  const staffSelected = users.filter(
    (u) =>
      selected.has(u.id) && (u.role === "auxiliar" || u.role === "lider") && u.status === "activo",
  );

  return (
    <div className="flex flex-col gap-3">
      {selectable && selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-overlay">
          <span className="tabular text-sm font-medium">{selected.size} seleccionada(s)</span>
          <Button
            size="sm"
            variant="outline"
            className="ml-auto"
            disabled={pending || !staffSelected.length}
            onClick={async () => {
              const yes = await confirm({
                title: `¿Desactivar a ${staffSelected.length} persona(s)?`,
                description:
                  "Conservarán todo su historial, pero no podrán entrar hasta que alguien las active de nuevo.",
                confirmLabel: "Desactivar",
                destructive: true,
              });
              if (!yes) return;
              run(async () => {
                const r = await bulkDeactivateAction({ userIds: staffSelected.map((u) => u.id) });
                setSelected(new Set());
                return r;
              }, `Desactivamos a ${staffSelected.length} persona(s).`);
            }}
          >
            Desactivar al cerrar semestre
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Quitar selección
          </Button>
        </div>
      )}
      <div className="overflow-hidden rounded-xl border bg-card">
        <table className="w-full text-sm">
          <caption className="sr-only">Personas</caption>
          <thead className="hidden border-b bg-muted/40 text-left text-xs font-medium text-muted-foreground md:table-header-group">
            <tr>
              {selectable && <th className="w-10 px-4 py-2" />}
              <th className="px-4 py-2 font-medium">Persona</th>
              <th className="px-4 py-2 font-medium">Rol</th>
              <th className="px-4 py-2 font-medium">Estado</th>
              <th className="px-4 py-2 font-medium">Equipo</th>
              <th className="px-4 py-2 font-medium">Desde</th>
              <th className="w-12 px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u) => {
              const s = STATUS[u.status];
              const manageable =
                isAdmin ||
                (can(actor, "users.manage", { targetRole: u.role }) && u.id !== actor.id);
              return (
                <tr
                  key={u.id}
                  className={cn(
                    "flex flex-col gap-1 px-4 py-3 md:table-row md:p-0",
                    selected.has(u.id) && "bg-secondary/40",
                  )}
                >
                  {selectable && (
                    <td className="md:px-4 md:py-3">
                      <Checkbox
                        aria-label={`Seleccionar a ${u.name}`}
                        checked={selected.has(u.id)}
                        onCheckedChange={(v) =>
                          setSelected((x) => {
                            const n = new Set(x);
                            if (v === true) n.add(u.id);
                            else n.delete(u.id);
                            return n;
                          })
                        }
                      />
                    </td>
                  )}
                  <td className="md:px-4 md:py-3">
                    <div className="flex flex-col">
                      <span className="font-medium">{u.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {u.email}
                        {!u.emailVerified && (
                          <span className="ml-1 inline-flex items-center gap-0.5 text-risk">
                            <MailWarning aria-hidden="true" className="size-3" /> sin confirmar
                          </span>
                        )}
                      </span>
                    </div>
                  </td>
                  <td className="md:px-4 md:py-3">
                    {u.roleLabel}
                    {u.status === "pendiente" && u.requestedRole && u.requestedRole !== u.role && (
                      <span className="block text-xs text-muted-foreground">
                        Pidió: {ROLE_LABEL[u.requestedRole]}
                      </span>
                    )}
                  </td>
                  <td className="md:px-4 md:py-3">
                    <Badge variant="outline" className={cn("border-transparent", s.cls)}>
                      {s.label}
                    </Badge>
                  </td>
                  <td className="text-muted-foreground md:px-4 md:py-3">{u.team ?? "—"}</td>
                  <td className="tabular text-xs text-muted-foreground md:px-4 md:py-3">
                    {formatDate(u.createdAt)}
                  </td>
                  <td className="md:px-4 md:py-3">
                    {manageable && (
                      <div className="flex items-center gap-1">
                        {u.status === "pendiente" && can(actor, "users.approve") && (
                          <Button
                            size="sm"
                            variant="secondary"
                            disabled={pending}
                            onClick={() =>
                              run(
                                () => approveUserAction({ userId: u.id }),
                                `${u.name} ya puede entrar.`,
                              )
                            }
                          >
                            <UserCheck data-icon="inline-start" aria-hidden="true" />
                            Aprobar
                          </Button>
                        )}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="icon-sm"
                              variant="ghost"
                              aria-label={`Acciones para ${u.name}`}
                              disabled={pending}
                            >
                              <MoreHorizontal aria-hidden="true" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            <DropdownMenuLabel className="truncate">{u.name}</DropdownMenuLabel>
                            {u.status === "pendiente" && can(actor, "users.approve") && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  run(
                                    () => rejectUserAction({ userId: u.id }),
                                    "Solicitud rechazada.",
                                  )
                                }
                              >
                                <UserX aria-hidden="true" />
                                Rechazar solicitud
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>Cambiar rol</DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                <DropdownMenuRadioGroup
                                  value={u.role}
                                  onValueChange={(role) =>
                                    run(
                                      () => setRoleAction({ userId: u.id, role: role as Role }),
                                      `Ahora es ${ROLE_LABEL[role as Role].toLowerCase()}.`,
                                    )
                                  }
                                >
                                  {ROLES.filter(
                                    (r) => isAdmin || r === "auxiliar" || r === "lider",
                                  ).map((r) => (
                                    <DropdownMenuRadioItem key={r} value={r}>
                                      {ROLE_LABEL[r]}
                                    </DropdownMenuRadioItem>
                                  ))}
                                </DropdownMenuRadioGroup>
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            {u.status !== "activo" && u.status !== "pendiente" && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  run(
                                    () => setStatusAction({ userId: u.id, status: "activo" }),
                                    "Cuenta activada.",
                                  )
                                }
                              >
                                <CircleCheck aria-hidden="true" />
                                Activar
                              </DropdownMenuItem>
                            )}
                            {u.status === "activo" && (
                              <DropdownMenuItem
                                onSelect={() =>
                                  run(
                                    () => setStatusAction({ userId: u.id, status: "inactivo" }),
                                    "Cuenta desactivada.",
                                  )
                                }
                              >
                                <UserX aria-hidden="true" />
                                Desactivar
                              </DropdownMenuItem>
                            )}
                            {isAdmin && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() =>
                                    run(
                                      () => resetAccessAction({ userId: u.id }),
                                      "Le enviamos un enlace para elegir contraseña.",
                                    )
                                  }
                                >
                                  <KeyRound aria-hidden="true" />
                                  Restablecer acceso
                                </DropdownMenuItem>
                                {u.status === "activo" && u.role !== "admin" && (
                                  <DropdownMenuItem onSelect={() => impersonate(u)}>
                                    <Eye aria-hidden="true" />
                                    Ver como esta persona
                                  </DropdownMenuItem>
                                )}
                                {u.status !== "bloqueado" && (
                                  <DropdownMenuItem
                                    variant="destructive"
                                    onSelect={async () => {
                                      const yes = await confirm({
                                        title: `¿Bloquear a ${u.name}?`,
                                        description:
                                          "Se cerrarán sus sesiones y no podrá entrar. Queda registrado en la auditoría.",
                                        confirmLabel: "Bloquear",
                                        destructive: true,
                                      });
                                      if (yes)
                                        run(
                                          () =>
                                            setStatusAction({ userId: u.id, status: "bloqueado" }),
                                          "Cuenta bloqueada.",
                                        );
                                    }}
                                  >
                                    <Ban aria-hidden="true" />
                                    Bloquear
                                  </DropdownMenuItem>
                                )}
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
