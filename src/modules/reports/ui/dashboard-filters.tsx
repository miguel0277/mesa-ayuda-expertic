"use client";

import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs";
import { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Spinner } from "@/shared/ui/components/spinner";

/** Filtros del panel (periodo y equipo) en la URL. */
export function DashboardFilters({ teams }: { teams: { id: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [p, set] = useQueryStates(
    {
      periodo: parseAsStringLiteral(["mes", "30d", "semestre"] as const).withDefault("mes"),
      equipo: parseAsString,
    },
    { shallow: false, startTransition: start },
  );
  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending && <Spinner className="text-muted-foreground" />}
      <Select value={p.periodo} onValueChange={(v) => void set({ periodo: v as typeof p.periodo })}>
        <SelectTrigger aria-label="Periodo" className="w-40">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="mes">Este mes</SelectItem>
            <SelectItem value="30d">Últimos 30 días</SelectItem>
            <SelectItem value="semestre">Este semestre</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
      <Select
        value={p.equipo ?? "todos"}
        onValueChange={(v) => void set({ equipo: v === "todos" ? null : v })}
      >
        <SelectTrigger aria-label="Equipo" className="w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectItem value="todos">Todos los equipos</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}
