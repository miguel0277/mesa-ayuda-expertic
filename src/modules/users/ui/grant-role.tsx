"use client";

import { Search, UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { Button } from "@/shared/ui/components/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/shared/ui/components/input-group";
import { Spinner } from "@/shared/ui/components/spinner";
import { searchPromotableAction, setRoleAction } from "./actions";

type Found = { id: string; name: string; email: string; role: Role };

/** Otorgar el rol de auxiliar o líder a alguien que ya tiene cuenta (HU-43). */
export function GrantRole() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, startSearch] = useTransition();
  const [pending, start] = useTransition();

  useEffect(() => {
    if (q.trim().length < 2) return;
    const id = setTimeout(
      () =>
        startSearch(async () => {
          const r = await searchPromotableAction({ q });
          setFound(r.ok ? r.data : []);
        }),
      250,
    );
    return () => clearTimeout(id);
  }, [q]);

  const grant = (u: Found, role: "auxiliar" | "lider") =>
    start(async () => {
      const r = await setRoleAction({ userId: u.id, role });
      if (!r.ok) return void toast.error(r.error.message);
      toast.success(`${u.name} ahora es ${ROLE_LABEL[role].toLowerCase()}.`);
      setQ("");
      setFound([]);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold">Otorgar un rol del equipo</h2>
        <p className="text-sm text-muted-foreground">
          Busca a alguien que ya tenga cuenta y hazlo auxiliar o auxiliar líder.
        </p>
      </div>
      <InputGroup className="sm:max-w-md">
        <InputGroupAddon>{searching ? <Spinner /> : <Search aria-hidden="true" />}</InputGroupAddon>
        <InputGroupInput
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            if (e.target.value.trim().length < 2) setFound([]);
          }}
          placeholder="Nombre o correo"
          aria-label="Buscar persona"
        />
      </InputGroup>
      {found.length > 0 && (
        <ul className="flex flex-col divide-y rounded-lg border">
          {found.map((u) => (
            <li key={u.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{u.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {u.email} · {ROLE_LABEL[u.role]}
                </span>
              </span>
              {u.role !== "auxiliar" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => grant(u, "auxiliar")}
                >
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                  Auxiliar
                </Button>
              )}
              {u.role !== "lider" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() => grant(u, "lider")}
                >
                  <UserPlus data-icon="inline-start" aria-hidden="true" />
                  Líder
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && !searching && !found.length && (
        <p className="text-sm text-muted-foreground">No encontramos a nadie con “{q}”.</p>
      )}
    </div>
  );
}
