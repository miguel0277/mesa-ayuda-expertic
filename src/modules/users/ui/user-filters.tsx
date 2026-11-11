import { Search } from "lucide-react";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { Button } from "@/shared/ui/components/button";

/** Filtros por URL (formulario GET: funciona sin JavaScript y se puede compartir). */
export function UserFilters({
  action,
  q,
  role,
  status,
  roles,
}: {
  action: string;
  q?: string;
  role?: string;
  status?: string;
  roles: Role[];
}) {
  const select = "h-9 rounded-lg border bg-card px-3 text-sm";
  return (
    <form action={action} method="get" className="flex flex-wrap items-center gap-2" role="search">
      <label className="relative min-w-0 flex-1 sm:max-w-xs">
        <span className="sr-only">Buscar personas</span>
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
        />
        <input
          name="q"
          defaultValue={q}
          placeholder="Nombre, correo o código"
          className="h-9 w-full rounded-lg border bg-card pr-3 pl-9 text-sm"
        />
      </label>
      <label>
        <span className="sr-only">Rol</span>
        <select name="rol" defaultValue={role ?? ""} className={select}>
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r} value={r}>
              {ROLE_LABEL[r]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className="sr-only">Estado</span>
        <select name="estado" defaultValue={status ?? ""} className={select}>
          <option value="">Todos los estados</option>
          <option value="pendiente">Pendientes</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
          <option value="bloqueado">Bloqueados</option>
        </select>
      </label>
      <Button type="submit" variant="outline">
        Filtrar
      </Button>
    </form>
  );
}
