"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, Eye, Plus, Save, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { CategoryTile } from "@/modules/tickets/ui/badges";
import type { Priority } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/shared/ui/components/dropdown-menu";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Switch } from "@/shared/ui/components/switch";
import { Textarea } from "@/shared/ui/components/textarea";
import { CATEGORY_ICONS, CategoryIcon } from "@/shared/ui/category-icon";
import { FileDropzone } from "@/shared/ui/file-dropzone";
import { FIELD_TYPES, type FieldType, type TemplateField } from "../domain/template-field";
import { buildTicketForm } from "../domain/ticket-form-factory";
import { saveTicketTypeAction } from "./actions";
import { DynamicField } from "./dynamic-field";

export type TypeDraft = {
  id: string | null;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  defaultPriority: Priority;
  active: boolean;
  sortOrder: number;
  fields: TemplateField[];
};

const TYPE_LABEL: Record<FieldType, string> = {
  text: "Texto corto",
  textarea: "Texto largo",
  number: "Número",
  select: "Lista (una opción)",
  multiselect: "Lista (varias opciones)",
  date: "Fecha",
  datetime: "Fecha y hora",
  checkbox: "Casilla",
  file: "Archivos",
};

const ACCEPT_PRESETS: { label: string; mime: string[] }[] = [
  { label: "Imágenes", mime: ["image/*"] },
  { label: "PDF", mime: ["application/pdf"] },
  {
    label: "Hojas de cálculo",
    mime: ["text/csv", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
  },
  {
    label: "Documentos Word",
    mime: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  },
  { label: "ZIP", mime: ["application/zip"] },
];

const slugify = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40) || "campo";

function newField(type: FieldType, existing: TemplateField[]): TemplateField {
  let key = slugify(TYPE_LABEL[type]);
  let n = 2;
  while (existing.some((f) => f.key === key)) key = `${slugify(TYPE_LABEL[type])}_${n++}`;
  const base = { key, label: TYPE_LABEL[type], required: false };
  switch (type) {
    case "select":
    case "multiselect":
      return { ...base, type, options: ["Opción 1", "Opción 2"] };
    case "file":
      return { ...base, type, accept: ["image/*", "application/pdf"], maxFiles: 3 };
    default:
      return { ...base, type } as TemplateField;
  }
}

/** Editor de un campo: lo común + las opciones propias de su tipo. */
function FieldEditor({
  field,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  field: TemplateField;
  index: number;
  total: number;
  onChange: (f: TemplateField) => void;
  onMove: (dir: -1 | 1) => void;
  onRemove: () => void;
}) {
  const id = `f${index}`;
  const set = (patch: Partial<TemplateField>) => onChange({ ...field, ...patch } as TemplateField);
  return (
    <li className="flex flex-col gap-3 rounded-xl border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          {TYPE_LABEL[field.type]}
        </span>
        <span className="code-id truncate text-xs text-muted-foreground">{field.key}</span>
        <div className="ml-auto flex">
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Subir campo"
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Bajar campo"
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={`Quitar ${field.label}`}
            onClick={onRemove}
          >
            <Trash2 aria-hidden="true" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor={`${id}-label`}>Pregunta</FieldLabel>
          <Input
            id={`${id}-label`}
            value={field.label}
            maxLength={80}
            onChange={(e) => set({ label: e.target.value })}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor={`${id}-key`}>Clave interna</FieldLabel>
          <Input
            id={`${id}-key`}
            value={field.key}
            maxLength={40}
            onChange={(e) => set({ key: slugify(e.target.value) })}
            className="font-mono text-xs"
          />
        </Field>
      </div>
      <Field>
        <FieldLabel htmlFor={`${id}-help`}>
          Ayuda <span className="font-normal text-muted-foreground">(opcional)</span>
        </FieldLabel>
        <Input
          id={`${id}-help`}
          value={field.helpText ?? ""}
          maxLength={200}
          onChange={(e) => set({ helpText: e.target.value || undefined })}
        />
      </Field>
      {(field.type === "select" || field.type === "multiselect") && (
        <Field>
          <FieldLabel htmlFor={`${id}-opts`}>Opciones (una por línea)</FieldLabel>
          <Textarea
            id={`${id}-opts`}
            rows={4}
            value={field.options.join("\n")}
            onChange={(e) =>
              set({
                options: e.target.value
                  .split("\n")
                  .map((o) => o.trimStart())
                  .filter((o, i, a) => o || i === a.length - 1),
              } as Partial<TemplateField>)
            }
          />
        </Field>
      )}
      {(field.type === "text" || field.type === "textarea") && (
        <Field>
          <FieldLabel htmlFor={`${id}-max`}>Máximo de caracteres</FieldLabel>
          <Input
            id={`${id}-max`}
            type="number"
            min={1}
            value={field.maxLength ?? ""}
            onChange={(e) =>
              set({
                maxLength: e.target.value ? Number(e.target.value) : undefined,
              } as Partial<TemplateField>)
            }
            className="max-w-32"
          />
        </Field>
      )}
      {field.type === "datetime" && (
        <Field>
          <FieldLabel htmlFor={`${id}-min`}>Anticipación mínima (horas)</FieldLabel>
          <Input
            id={`${id}-min`}
            type="number"
            min={0}
            value={field.minFromNowMinutes !== undefined ? field.minFromNowMinutes / 60 : ""}
            onChange={(e) =>
              set({
                minFromNowMinutes: e.target.value
                  ? Math.round(Number(e.target.value) * 60)
                  : undefined,
              } as Partial<TemplateField>)
            }
            className="max-w-32"
          />
        </Field>
      )}
      {field.type === "file" && (
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">Tipos aceptados</span>
          <div className="flex flex-wrap gap-2">
            {ACCEPT_PRESETS.map((p) => {
              const on = p.mime.every((m) => field.accept?.includes(m));
              return (
                <button
                  key={p.label}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    set({
                      accept: on
                        ? (field.accept ?? []).filter((m) => !p.mime.includes(m))
                        : [...new Set([...(field.accept ?? []), ...p.mime])],
                    } as Partial<TemplateField>)
                  }
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs",
                    on
                      ? "border-primary bg-secondary text-secondary-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <Field>
            <FieldLabel htmlFor={`${id}-files`}>Máximo de archivos</FieldLabel>
            <Input
              id={`${id}-files`}
              type="number"
              min={1}
              max={10}
              value={field.maxFiles ?? 1}
              onChange={(e) =>
                set({ maxFiles: Number(e.target.value) || 1 } as Partial<TemplateField>)
              }
              className="max-w-24"
            />
          </Field>
        </div>
      )}
      <Field orientation="horizontal">
        <Switch
          id={`${id}-req`}
          checked={!!field.required}
          onCheckedChange={(v) => set({ required: v })}
        />
        <FieldLabel htmlFor={`${id}-req`}>Obligatorio</FieldLabel>
      </Field>
    </li>
  );
}

/** Vista previa en vivo: el MISMO formulario que verá quien crea la solicitud. */
function Preview({ draft }: { draft: TypeDraft }) {
  const form = useMemo(() => {
    try {
      return buildTicketForm(draft.fields);
    } catch {
      return null;
    }
  }, [draft.fields]);
  const rhf = useForm({
    resolver: form ? zodResolver(form.valuesSchema) : undefined,
    values: form?.defaults ?? {},
  });
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-background p-4">
      <div className="flex items-center gap-3">
        <CategoryTile icon={draft.icon} color={draft.color} name={draft.name || "Categoría"} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate font-medium">{draft.name || "Nombre de la categoría"}</span>
          <span className="truncate text-xs text-muted-foreground">
            {draft.description || "Descripción corta"}
          </span>
        </div>
      </div>
      <FieldGroup>
        {draft.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Esta categoría solo pide título y descripción.
          </p>
        )}
        {draft.fields.map((f) =>
          f.type === "file" ? (
            <Field key={f.key}>
              <FieldLabel>{f.label}</FieldLabel>
              <FileDropzone
                files={[]}
                onChange={() => {}}
                accept={f.accept}
                maxFiles={f.maxFiles}
                hint={f.helpText}
              />
            </Field>
          ) : (
            <DynamicField key={`${f.key}-${f.type}`} field={f} control={rhf.control} name={f.key} />
          ),
        )}
      </FieldGroup>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => void rhf.trigger()}
      >
        Probar validación
      </Button>
    </div>
  );
}

export function TemplateEditor({ initial, onSaved }: { initial: TypeDraft; onSaved?: () => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<TypeDraft>(initial);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [pending, start] = useTransition();
  const set = <K extends keyof TypeDraft>(k: K, v: TypeDraft[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));
  const setField = (i: number, f: TemplateField) =>
    set(
      "fields",
      draft.fields.map((x, j) => (j === i ? f : x)),
    );
  const move = (i: number, dir: -1 | 1) => {
    const next = [...draft.fields];
    const [it] = next.splice(i, 1);
    if (it) next.splice(i + dir, 0, it);
    set("fields", next);
  };

  const save = () =>
    start(async () => {
      setErrors({});
      const r = await saveTicketTypeAction({
        ...draft,
        fields: draft.fields.map((f) =>
          "options" in f ? { ...f, options: f.options.filter(Boolean) } : f,
        ) as TemplateField[],
      });
      if (!r.ok) {
        setErrors(r.error.fieldErrors ?? {});
        toast.error(r.error.message);
        return;
      }
      toast.success(`Guardamos "${draft.name}". Ya está disponible en Nueva solicitud.`);
      if (!draft.id) setDraft((d) => ({ ...d, id: r.data.id }));
      onSaved?.();
      router.refresh();
    });

  const fieldErrors = Object.entries(errors).filter(([k]) => k.startsWith("fields"));
  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
      <div className="flex min-w-0 flex-col gap-5">
        <section className="flex flex-col gap-4 rounded-xl border bg-card p-4">
          <h2 className="text-base font-semibold">Datos de la categoría</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field data-invalid={!!errors.name}>
              <FieldLabel htmlFor="tt-nombre">Nombre</FieldLabel>
              <Input
                id="tt-nombre"
                value={draft.name}
                maxLength={80}
                onChange={(e) => {
                  set("name", e.target.value);
                  if (!initial.id) set("slug", slugify(e.target.value).replace(/_/g, "-"));
                }}
              />
            </Field>
            <Field data-invalid={!!errors.slug}>
              <FieldLabel htmlFor="tt-slug">Identificador</FieldLabel>
              <Input
                id="tt-slug"
                value={draft.slug}
                onChange={(e) => set("slug", e.target.value.toLowerCase())}
                className="font-mono text-xs"
              />
              {errors.slug && (
                <FieldDescription className="text-destructive">{errors.slug[0]}</FieldDescription>
              )}
            </Field>
          </div>
          <Field>
            <FieldLabel htmlFor="tt-desc">Descripción</FieldLabel>
            <Input
              id="tt-desc"
              value={draft.description}
              maxLength={240}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Ícono y color</span>
            <div className="flex flex-wrap items-center gap-2">
              {Object.keys(CATEGORY_ICONS).map((name) => (
                <button
                  key={name}
                  type="button"
                  aria-pressed={draft.icon === name}
                  aria-label={`Ícono ${name}`}
                  onClick={() => set("icon", name)}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg border",
                    draft.icon === name && "border-primary bg-secondary",
                  )}
                >
                  <CategoryIcon name={name} aria-hidden="true" className="size-4" />
                </button>
              ))}
              <label className="ml-2 flex items-center gap-2 text-sm">
                <input
                  type="color"
                  value={draft.color}
                  onChange={(e) => set("color", e.target.value)}
                  className="size-9 cursor-pointer rounded-lg border bg-transparent p-1"
                  aria-label="Color de la categoría"
                />
                <span className="code-id text-muted-foreground">{draft.color.toUpperCase()}</span>
              </label>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field>
              <FieldLabel htmlFor="tt-prio">Prioridad por defecto</FieldLabel>
              <Select
                value={draft.defaultPriority}
                onValueChange={(v) => set("defaultPriority", v as Priority)}
              >
                <SelectTrigger id="tt-prio" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectItem value="alta">Alta</SelectItem>
                    <SelectItem value="media">Media</SelectItem>
                    <SelectItem value="baja">Baja</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="tt-orden">Orden</FieldLabel>
              <Input
                id="tt-orden"
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(e) => set("sortOrder", Number(e.target.value) || 0)}
              />
            </Field>
            <Field orientation="horizontal" className="self-end pb-2">
              <Switch
                id="tt-activa"
                checked={draft.active}
                onCheckedChange={(v) => set("active", v)}
              />
              <FieldLabel htmlFor="tt-activa">Activa</FieldLabel>
            </Field>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Campos del formulario</h2>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={draft.fields.length >= 30}
                >
                  <Plus data-icon="inline-start" aria-hidden="true" />
                  Agregar campo
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {FIELD_TYPES.map((t) => (
                  <DropdownMenuItem
                    key={t}
                    onSelect={() => set("fields", [...draft.fields, newField(t, draft.fields)])}
                  >
                    {TYPE_LABEL[t]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {fieldErrors.length > 0 && (
            <ul role="alert" className="rounded-lg bg-late-soft px-3 py-2 text-sm text-late">
              {fieldErrors.map(([k, msgs]) => (
                <li key={k}>{msgs[0]}</li>
              ))}
            </ul>
          )}
          <ol className="flex flex-col gap-3">
            {draft.fields.map((f, i) => (
              <FieldEditor
                key={i}
                field={f}
                index={i}
                total={draft.fields.length}
                onChange={(nf) => setField(i, nf)}
                onMove={(d) => move(i, d)}
                onRemove={() =>
                  set(
                    "fields",
                    draft.fields.filter((_, j) => j !== i),
                  )
                }
              />
            ))}
          </ol>
          <p className="text-xs text-muted-foreground">
            Título, descripción y prioridad siempre se piden; aquí defines las preguntas propias de
            la categoría.
          </p>
        </section>
        <Button onClick={save} disabled={pending} size="lg" className="self-start">
          <Save data-icon="inline-start" aria-hidden="true" />
          {pending ? "Guardando…" : "Guardar categoría"}
        </Button>
      </div>

      <aside className="flex flex-col gap-2 xl:sticky xl:top-20 xl:self-start">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Eye aria-hidden="true" className="size-4" />
          Vista previa en vivo
        </h2>
        <Preview draft={draft} />
      </aside>
    </div>
  );
}
