"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
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
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Spinner } from "@/shared/ui/components/spinner";
import { Switch } from "@/shared/ui/components/switch";
import { Textarea } from "@/shared/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/components/toggle-group";
import { createTaskAction } from "./actions";

type Person = { id: string; name: string; role: string; teamName: string | null };
type Team = { id: string; name: string };

const schema = z.object({
  title: z.string().trim().min(4, "Escribe un título de al menos 4 caracteres.").max(140),
  description: z.string().max(4000),
  target: z.string().min(1, "Elige a quién se la asignas."),
  due: z.string().min(1, "Elige la fecha y hora límite."),
  priority: z.enum(["baja", "media", "alta"]),
  requiresEvidence: z.boolean(),
});
type Values = z.infer<typeof schema>;

/** Fecha local por defecto: pasado mañana a las 5:00 p. m. (formato datetime-local). */
function defaultDue() {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(17, 0, 0, 0);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Crear y asignar tareas (HU-42) a una persona o a todo un equipo. */
export function CreateTaskDialog({
  people,
  teams,
  ticket,
}: {
  people: Person[];
  teams: Team[];
  ticket?: { id: string; code: string };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: "",
      description: "",
      target: "",
      due: defaultDue(),
      priority: "media",
      requiresEvidence: true,
    },
  });
  const target = useWatch({ control: form.control, name: "target" });

  const onSubmit = form.handleSubmit((v) =>
    start(async () => {
      setServerError(null);
      const [kind, id] = v.target.split(":");
      const r = await createTaskAction({
        title: v.title,
        description: v.description,
        assigneeId: kind === "p" ? (id ?? null) : null,
        teamId: kind === "t" ? (id ?? null) : null,
        dueAt: new Date(v.due),
        priority: v.priority,
        ticketId: ticket?.id ?? null,
        requiresEvidence: v.requiresEvidence,
      });
      if (!r.ok) {
        setServerError(r.error.message);
        return;
      }
      toast.success(
        r.data.codes.length > 1
          ? `Creamos ${r.data.codes.length} tareas, una por integrante.`
          : `Tarea ${r.data.codes[0]} asignada.`,
      );
      setOpen(false);
      form.reset({ ...form.getValues(), title: "", description: "", target: "" });
      router.refresh();
    }),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus data-icon="inline-start" aria-hidden="true" />
          {ticket ? "Crear tarea desde este ticket" : "Asignar tarea"}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Asignar una tarea</DialogTitle>
          <DialogDescription>
            {ticket ? (
              <>
                Quedará vinculada a <span className="code-id">{ticket.code}</span>.
              </>
            ) : (
              "Le avisaremos a la persona por correo y en la app."
            )}
          </DialogDescription>
        </DialogHeader>
        <form id="crear-tarea" onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              name="title"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="t-titulo">Título</FieldLabel>
                  <Input
                    {...field}
                    id="t-titulo"
                    maxLength={140}
                    placeholder="Ej.: Revisar los enlaces del curso de Física I"
                    aria-invalid={fieldState.invalid}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <Controller
              name="description"
              control={form.control}
              render={({ field }) => (
                <Field>
                  <FieldLabel htmlFor="t-desc">
                    Detalle <span className="font-normal text-muted-foreground">(opcional)</span>
                  </FieldLabel>
                  <Textarea {...field} id="t-desc" rows={3} maxLength={4000} />
                </Field>
              )}
            />
            <Controller
              name="target"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="t-para">Para</FieldLabel>
                  <Select value={field.value || undefined} onValueChange={field.onChange}>
                    <SelectTrigger id="t-para" className="w-full" aria-invalid={fieldState.invalid}>
                      <SelectValue placeholder="Elige una persona o un equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.length > 0 && (
                        <SelectGroup>
                          <SelectLabel>Equipos (una tarea por integrante)</SelectLabel>
                          {teams.map((t) => (
                            <SelectItem key={t.id} value={`t:${t.id}`}>
                              {t.name}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      )}
                      <SelectGroup>
                        <SelectLabel>Personas</SelectLabel>
                        {people.map((p) => (
                          <SelectItem key={p.id} value={`p:${p.id}`}>
                            {p.name}{" "}
                            <span className="text-muted-foreground">· {p.teamName ?? p.role}</span>
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  {target.startsWith("t:") && (
                    <FieldDescription>
                      Cada integrante recibirá su propia tarea con su propio seguimiento.
                    </FieldDescription>
                  )}
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                name="due"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="t-fecha">Fecha límite</FieldLabel>
                    <Input
                      {...field}
                      id="t-fecha"
                      type="datetime-local"
                      aria-invalid={fieldState.invalid}
                    />
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
              <Controller
                name="priority"
                control={form.control}
                render={({ field }) => (
                  <Field>
                    <FieldLabel>Prioridad</FieldLabel>
                    <ToggleGroup
                      type="single"
                      variant="outline"
                      value={field.value}
                      onValueChange={(v) => v && field.onChange(v)}
                      className="w-full"
                      aria-label="Prioridad"
                    >
                      <ToggleGroupItem value="baja" className="flex-1">
                        Baja
                      </ToggleGroupItem>
                      <ToggleGroupItem value="media" className="flex-1">
                        Media
                      </ToggleGroupItem>
                      <ToggleGroupItem value="alta" className="flex-1">
                        Alta
                      </ToggleGroupItem>
                    </ToggleGroup>
                  </Field>
                )}
              />
            </div>
            <Controller
              name="requiresEvidence"
              control={form.control}
              render={({ field }) => (
                <Field orientation="horizontal">
                  <Switch id="t-evid" checked={field.value} onCheckedChange={field.onChange} />
                  <FieldContent>
                    <FieldLabel htmlFor="t-evid">Pedir evidencia para completarla</FieldLabel>
                    <FieldDescription>
                      Una nota o un archivo que muestre lo que se hizo.
                    </FieldDescription>
                  </FieldContent>
                </Field>
              )}
            />
            {serverError && (
              <p role="alert" className="text-sm text-destructive">
                {serverError}
              </p>
            )}
          </FieldGroup>
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" form="crear-tarea" disabled={pending}>
            {pending && <Spinner data-icon="inline-start" />}
            Asignar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
