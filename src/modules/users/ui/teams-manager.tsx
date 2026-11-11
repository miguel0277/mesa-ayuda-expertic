"use client";

import { Plus, UserMinus, UsersRound, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ROLE_LABEL, type Role } from "@/shared/auth/roles";
import { formatDate } from "@/shared/lib/dates";
import { Badge } from "@/shared/ui/components/badge";
import { Button } from "@/shared/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/components/dialog";
import { Field, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { useConfirm } from "@/shared/ui/confirm";
import { EmptyState } from "@/shared/ui/states";
import {
  addMemberAction,
  createTeamAction,
  removeMemberAction,
  setTeamActiveAction,
} from "./actions";

type Team = {
  id: string;
  name: string;
  semester: string;
  active: boolean;
  liderName: string | null;
  members: { id: string; name: string; role: string; since: string; until: string | null }[];
};
type Candidate = { id: string; name: string; role: Role };

function currentSemester() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() >= 6 ? 2 : 1}`;
}

function CreateTeamDialog({ leaders }: { leaders: Candidate[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(currentSemester());
  const [liderId, setLiderId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const submit = () =>
    start(async () => {
      setError(null);
      const r = await createTeamAction({ name, semester, liderId: liderId || null });
      if (!r.ok) {
        setError(Object.values(r.error.fieldErrors ?? {})[0]?.[0] ?? r.error.message);
        return;
      }
      toast.success(`Creamos el equipo ${name}.`);
      setOpen(false);
      setName("");
      router.refresh();
    });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" aria-hidden="true" />
          Nuevo equipo
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo equipo</DialogTitle>
          <DialogDescription>
            Los equipos se arman por semestre. Al cerrar el semestre se conserva su historial.
          </DialogDescription>
        </DialogHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="eq-nombre">Nombre</FieldLabel>
            <Input
              id="eq-nombre"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej.: Equipo Plataforma Moodle"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="eq-sem">Semestre</FieldLabel>
              <Input
                id="eq-sem"
                value={semester}
                onChange={(e) => setSemester(e.target.value)}
                placeholder="2026-2"
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="eq-lider">Líder</FieldLabel>
              <Select value={liderId} onValueChange={setLiderId}>
                <SelectTrigger id="eq-lider" className="w-full">
                  <SelectValue placeholder="Elige un líder" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {leaders.map((l) => (
                      <SelectItem key={l.id} value={l.id}>
                        {l.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </FieldGroup>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={pending || name.trim().length < 3}>
            Crear equipo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Equipos por semestre (HU-43): integrantes, altas, bajas y cierre. */
export function TeamsManager({ teams, candidates }: { teams: Team[]; candidates: Candidate[] }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean; error?: { message: string } }>, ok: string) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return void toast.error(r.error?.message ?? "No se pudo.");
      toast.success(ok);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <CreateTeamDialog leaders={candidates.filter((c) => c.role === "lider")} />
      </div>
      {teams.length === 0 ? (
        <EmptyState
          icon={UsersRound}
          title="Aún no hay equipos"
          description="Crea el primer equipo del semestre y suma a sus auxiliares."
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {teams.map((t) => {
            const memberIds = new Set(t.members.map((m) => m.id));
            const available = candidates.filter((c) => !memberIds.has(c.id));
            return (
              <li key={t.id} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col">
                    <span className="font-semibold">{t.name}</span>
                    <span className="text-xs text-muted-foreground">
                      Semestre {t.semester} · Líder: {t.liderName ?? "sin asignar"}
                    </span>
                  </div>
                  {t.active ? (
                    <Badge variant="ok">Activo</Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      Cerrado
                    </Badge>
                  )}
                </div>
                <ul className="flex flex-col divide-y rounded-lg border">
                  {t.members.length === 0 && (
                    <li className="px-3 py-3 text-sm text-muted-foreground">Sin integrantes.</li>
                  )}
                  {t.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <span className="flex-1 truncate">{m.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {m.until ? `hasta ${formatDate(m.until)}` : m.role}
                      </span>
                      {t.active && (
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          aria-label={`Quitar a ${m.name}`}
                          disabled={pending}
                          onClick={() =>
                            run(
                              () => removeMemberAction({ teamId: t.id, userId: m.id }),
                              `${m.name} salió del equipo.`,
                            )
                          }
                        >
                          <UserMinus aria-hidden="true" />
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
                {t.active && (
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      onValueChange={(userId) =>
                        run(() => addMemberAction({ teamId: t.id, userId }), "Integrante agregado.")
                      }
                      disabled={pending || !available.length}
                    >
                      <SelectTrigger
                        className="min-w-48 flex-1"
                        aria-label={`Agregar integrante a ${t.name}`}
                      >
                        <SelectValue
                          placeholder={
                            available.length
                              ? "Agregar integrante"
                              : "No hay más personal disponible"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {available.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.name}{" "}
                              <span className="text-muted-foreground">· {ROLE_LABEL[c.role]}</span>
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      className="text-muted-foreground"
                      disabled={pending}
                      onClick={async () => {
                        const yes = await confirm({
                          title: `¿Cerrar el equipo ${t.name}?`,
                          description:
                            "Termina el semestre del equipo: sus integrantes salen, pero se conserva todo el historial.",
                          confirmLabel: "Cerrar equipo",
                          destructive: true,
                        });
                        if (yes)
                          run(
                            () => setTeamActiveAction({ teamId: t.id, active: false }),
                            "Equipo cerrado.",
                          );
                      }}
                    >
                      <X data-icon="inline-start" aria-hidden="true" />
                      Cerrar semestre
                    </Button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
