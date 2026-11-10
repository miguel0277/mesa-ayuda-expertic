import { z } from "zod";

/**
 * Definición de un campo de plantilla de tipo de ticket (`ticket_types.fields`).
 * Fuente única de verdad: de aquí salen el esquema Zod del formulario y el formulario dinámico
 * (ver TicketFormFactory, Fase 4).
 */

export const FIELD_TYPES = [
  "text",
  "textarea",
  "number",
  "select",
  "multiselect",
  "date",
  "datetime",
  "checkbox",
  "file",
] as const;

export type FieldType = (typeof FIELD_TYPES)[number];

const fieldKey = z
  .string()
  .regex(/^[a-z][a-z0-9_]{0,39}$/, "La clave usa minúsculas, números y _ (máx. 40).");

const base = {
  key: fieldKey,
  label: z.string().min(1).max(80),
  required: z.boolean().optional(),
  helpText: z.string().max(200).optional(),
  placeholder: z.string().max(100).optional(),
};

const options = z.array(z.string().min(1).max(80)).min(1).max(50);

export const templateFieldSchema = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("text"),
    maxLength: z.number().int().positive().max(500).optional(),
    format: z.enum(["url", "email"]).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("textarea"),
    maxLength: z.number().int().positive().max(10_000).optional(),
  }),
  z.object({
    ...base,
    type: z.literal("number"),
    min: z.number().optional(),
    max: z.number().optional(),
    integer: z.boolean().optional(),
  }),
  z.object({ ...base, type: z.literal("select"), options }),
  z.object({ ...base, type: z.literal("multiselect"), options }),
  z.object({ ...base, type: z.literal("date"), minFromNowDays: z.number().int().optional() }),
  z.object({
    ...base,
    type: z.literal("datetime"),
    minFromNowMinutes: z.number().int().min(0).optional(),
  }),
  z.object({ ...base, type: z.literal("checkbox") }),
  z.object({
    ...base,
    type: z.literal("file"),
    accept: z.array(z.string().min(1)).min(1).optional(),
    maxFiles: z.number().int().min(1).max(10).optional(),
  }),
]);

export type TemplateField = z.infer<typeof templateFieldSchema>;

export const templateFieldsSchema = z
  .array(templateFieldSchema)
  .max(30, "Una plantilla admite máximo 30 campos.")
  .superRefine((fields, ctx) => {
    const seen = new Set<string>();
    fields.forEach((f, i) => {
      if (seen.has(f.key)) {
        ctx.addIssue({
          code: "custom",
          path: [i, "key"],
          message: `La clave "${f.key}" está repetida.`,
        });
      }
      seen.add(f.key);
    });
  });
