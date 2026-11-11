"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  ArrowLeft,
  ArrowUp,
  ChevronRight,
  Equal,
  ArrowDown,
  Send,
  TriangleAlert,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import type { TemplateField } from "@/modules/templates/domain/template-field";
import { buildTicketForm } from "@/modules/templates/domain/ticket-form-factory";
import { DynamicField } from "@/modules/templates/ui/dynamic-field";
import type { Priority } from "@/shared/db/schema/enums";
import { cn } from "@/shared/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/shared/ui/components/alert";
import { Button } from "@/shared/ui/components/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import { Spinner } from "@/shared/ui/components/spinner";
import { Textarea } from "@/shared/ui/components/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/components/toggle-group";
import { FileDropzone } from "@/shared/ui/file-dropzone";
import { ease, staggerContainer, staggerItem } from "@/shared/ui/motion";
import { createTicketAction } from "./actions";
import { CategoryTile } from "./badges";

export type TicketTypeOption = {
  id: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  fields: TemplateField[];
  defaultPriority: Priority;
};

const PRIORITY_OPTIONS: { value: Priority; label: string; hint: string; icon: typeof ArrowUp }[] = [
  { value: "baja", label: "Baja", hint: "Puede esperar unos días", icon: ArrowDown },
  { value: "media", label: "Media", hint: "Afecta el trabajo, hay alternativa", icon: Equal },
  { value: "alta", label: "Alta", hint: "Impide trabajar o afecta a un grupo", icon: ArrowUp },
];

const draftKey = (typeId: string) => `borrador-ticket:${typeId}`;
function readDraft(typeId: string): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(draftKey(typeId));
    return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
function writeDraft(typeId: string, value: unknown) {
  try {
    window.localStorage.setItem(draftKey(typeId), JSON.stringify(value));
  } catch {
    /* almacenamiento no disponible: el borrador es opcional */
  }
}
function clearDraft(typeId: string) {
  try {
    window.localStorage.removeItem(draftKey(typeId));
  } catch {
    /* sin efecto */
  }
}

// ───────────────────────── Paso 1: categoría ─────────────────────────

function CategoryPicker({
  types,
  onPick,
}: {
  types: TicketTypeOption[];
  onPick: (t: TicketTypeOption) => void;
}) {
  return (
    <motion.ul
      variants={staggerContainer(0.035)}
      initial="initial"
      animate="enter"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {types.map((t) => (
        <motion.li key={t.id} variants={staggerItem}>
          <button
            type="button"
            onClick={() => onPick(t)}
            className="group flex h-full w-full items-start gap-3 rounded-xl border bg-card p-4 text-left transition-[border-color,box-shadow,transform] duration-150 hover:border-primary/50 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.99]"
          >
            <CategoryTile icon={t.icon} color={t.color} name={t.name} size="lg" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-center gap-1 font-medium">
                {t.name}
                <ChevronRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </span>
              <span className="text-sm text-muted-foreground">{t.description}</span>
            </span>
          </button>
        </motion.li>
      ))}
    </motion.ul>
  );
}

// ───────────────────────── Paso 2: formulario ─────────────────────────

function TicketForm({
  type,
  onBack,
  onDone,
}: {
  type: TicketTypeOption;
  onBack: () => void;
  onDone: (code: string) => void;
}) {
  const form = useMemo(() => buildTicketForm(type.fields), [type.fields]);
  const schema = useMemo(
    () =>
      z.object({
        title: z
          .string()
          .trim()
          .min(5, "Escribe un título de al menos 5 caracteres.")
          .max(140, "Máximo 140 caracteres."),
        description: z
          .string()
          .trim()
          .min(10, "Cuéntanos un poco más (al menos 10 caracteres).")
          .max(5000),
        priority: z.enum(["baja", "media", "alta"]),
        values: form.valuesSchema,
      }),
    [form],
  );
  type Values = z.infer<typeof schema>;

  const [files, setFiles] = useState<Record<string, File[]>>({});
  const [fileErrors, setFileErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const restored = useRef(false);

  const rhf = useForm<Values>({
    resolver: zodResolver(schema),
    mode: "onTouched",
    defaultValues: {
      title: "",
      description: "",
      priority: type.defaultPriority,
      values: form.defaults as Values["values"],
    },
  });

  // Recupera el borrador una sola vez.
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;
    const draft = readDraft(type.id);
    if (draft) {
      rhf.reset({ ...rhf.getValues(), ...(draft as Partial<Values>) });
      toast.info("Recuperamos el borrador que dejaste.", {
        action: {
          label: "Descartar",
          onClick: () => {
            clearDraft(type.id);
            rhf.reset({
              title: "",
              description: "",
              priority: type.defaultPriority,
              values: form.defaults as Values["values"],
            });
          },
        },
      });
    }
  }, [type.id, type.defaultPriority, form.defaults, rhf]);

  // Autoguardado del borrador (sin archivos).
  const watched = useWatch({ control: rhf.control });
  useEffect(() => {
    const id = setTimeout(() => writeDraft(type.id, watched), 600);
    return () => clearTimeout(id);
  }, [watched, type.id]);

  const onSubmit = rhf.handleSubmit((v) => {
    const missing: Record<string, string> = {};
    for (const rule of form.fileRules) {
      if (rule.required && !(files[rule.key]?.length ?? 0))
        missing[rule.key] = `${rule.label}: adjunta al menos un archivo.`;
    }
    setFileErrors(missing);
    if (Object.keys(missing).length) return;

    // datetime-local está en la hora del navegador: se envía como ISO (UTC) sin ambigüedad.
    const values: Record<string, unknown> = { ...v.values };
    for (const f of type.fields) {
      if (f.type === "datetime" && typeof values[f.key] === "string" && values[f.key]) {
        values[f.key] = new Date(values[f.key] as string).toISOString();
      }
    }
    const fd = new FormData();
    fd.set(
      "payload",
      JSON.stringify({
        typeId: type.id,
        title: v.title,
        description: v.description,
        priority: v.priority,
        values,
      }),
    );
    for (const [key, list] of Object.entries(files))
      for (const file of list) fd.append(`archivo:${key}`, file);

    start(async () => {
      setServerError(null);
      const r = await createTicketAction(fd);
      if (!r.ok) {
        for (const [path, msgs] of Object.entries(r.error.fieldErrors ?? {})) {
          rhf.setError(path as Parameters<typeof rhf.setError>[0], { message: msgs[0] });
        }
        setServerError(
          r.error.message + (r.error.requestId ? ` (referencia: ${r.error.requestId})` : ""),
        );
        return;
      }
      clearDraft(type.id);
      onDone(r.data.code);
    });
  });

  const fieldsInOrder = type.fields;

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <CategoryTile icon={type.icon} color={type.color} name={type.name} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs text-muted-foreground">Categoría</span>
          <span className="truncate font-medium">{type.name}</span>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft data-icon="inline-start" aria-hidden="true" />
          Cambiar
        </Button>
      </div>

      {serverError && (
        <Alert variant="destructive" role="alert">
          <TriangleAlert aria-hidden="true" />
          <AlertTitle>No pudimos enviar tu solicitud</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      <FieldGroup>
        <Controller
          name="title"
          control={rhf.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="title">Título</FieldLabel>
              <Input
                {...field}
                id="title"
                maxLength={140}
                placeholder="Resume el problema en una frase"
                aria-invalid={fieldState.invalid}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />
        <Controller
          name="description"
          control={rhf.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="description">Descripción</FieldLabel>
              <Textarea
                {...field}
                id="description"
                rows={5}
                maxLength={5000}
                placeholder="Cuéntanos qué pasó, desde cuándo y a quién afecta."
                aria-invalid={fieldState.invalid}
              />
              <FieldDescription className="tabular">
                {(field.value ?? "").length}/5000
              </FieldDescription>
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        {fieldsInOrder.map((f) =>
          f.type === "file" ? (
            <Field key={f.key} data-invalid={!!fileErrors[f.key]}>
              <FieldLabel>
                {f.label}
                {!f.required && (
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                )}
              </FieldLabel>
              <FileDropzone
                label={f.label}
                files={files[f.key] ?? []}
                onChange={(list) => setFiles((s) => ({ ...s, [f.key]: list }))}
                accept={f.accept}
                maxFiles={f.maxFiles ?? 1}
                hint={f.helpText ?? `Máximo ${f.maxFiles ?? 1} archivo(s) de 10 MB.`}
                invalid={!!fileErrors[f.key]}
              />
              {fileErrors[f.key] && <FieldError>{fileErrors[f.key]}</FieldError>}
            </Field>
          ) : (
            <DynamicField
              key={f.key}
              field={f}
              control={rhf.control}
              name={`values.${f.key}` as const}
            />
          ),
        )}

        <Controller
          name="priority"
          control={rhf.control}
          render={({ field }) => (
            <FieldSet>
              <FieldLegend variant="label">¿Qué tan urgente es?</FieldLegend>
              <FieldDescription>
                El equipo puede ajustarla después de revisar tu caso.
              </FieldDescription>
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(v) => v && field.onChange(v)}
                className="grid w-full grid-cols-3"
                aria-label="Prioridad"
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <ToggleGroupItem
                    key={o.value}
                    value={o.value}
                    className="h-auto flex-col gap-0.5 py-2.5 data-[state=on]:border-primary data-[state=on]:bg-secondary data-[state=on]:text-secondary-foreground"
                  >
                    <span className="flex items-center gap-1 font-medium">
                      <o.icon aria-hidden="true" className="size-3.5" />
                      {o.label}
                    </span>
                    <span className="hidden text-xs font-normal text-muted-foreground sm:block">
                      {o.hint}
                    </span>
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </FieldSet>
          )}
        />
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">
          Guardamos un borrador en este navegador mientras escribes.
        </p>
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <Send data-icon="inline-start" aria-hidden="true" />
          )}
          {pending ? "Enviando…" : "Enviar solicitud"}
        </Button>
      </div>
    </form>
  );
}

// ───────────────────────── Confirmación ─────────────────────────

function AnimatedCheck() {
  const reduce = useReducedMotion();
  return (
    <svg viewBox="0 0 52 52" className="size-16" aria-hidden="true">
      <motion.circle
        cx="26"
        cy="26"
        r="24"
        fill="none"
        className="stroke-ok-fill"
        strokeWidth="3"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.5, ease: ease.out }}
      />
      <motion.path
        d="M15 27 l7 7 l15 -16"
        fill="none"
        className="stroke-ok"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.35, delay: 0.4, ease: ease.out }}
      />
    </svg>
  );
}

function Success({ code, onAnother }: { code: string; onAnother: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-4 rounded-2xl border bg-card px-6 py-12 text-center"
      role="status"
    >
      <AnimatedCheck />
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Recibimos tu solicitud</h2>
        <p className="text-muted-foreground">
          Tu código es <span className="code-id text-foreground">{code}</span>. Te avisaremos por
          correo y aquí cuando haya novedades.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button asChild>
          <Link href={`/solicitudes/${code}`}>Ver la solicitud</Link>
        </Button>
        <Button variant="outline" onClick={onAnother}>
          Crear otra
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────── Contenedor ─────────────────────────

export function NewTicketFlow({ types }: { types: TicketTypeOption[] }) {
  const params = useSearchParams();
  const router = useRouter();
  const initial = types.find((t) => t.slug === params.get("categoria")) ?? null;
  const [type, setType] = useState<TicketTypeOption | null>(initial);
  const [done, setDone] = useState<string | null>(null);

  const pick = (t: TicketTypeOption | null) => {
    setType(t);
    router.replace(t ? `/solicitudes/nueva?categoria=${t.slug}` : "/solicitudes/nueva", {
      scroll: false,
    });
  };

  if (done)
    return (
      <Success
        code={done}
        onAnother={() => {
          setDone(null);
          pick(null);
        }}
      />
    );
  return (
    <div className={cn("flex flex-col gap-4", type && "max-w-2xl")}>
      {type ? (
        <TicketForm key={type.id} type={type} onBack={() => pick(null)} onDone={setDone} />
      ) : (
        <CategoryPicker types={types} onPick={pick} />
      )}
    </div>
  );
}
