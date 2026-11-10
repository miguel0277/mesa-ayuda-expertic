import { z } from "zod";
import type { TemplateField } from "./template-field";

/**
 * TicketFormFactory (patrón Factory): a partir de los campos JSON de una plantilla construye
 * el esquema Zod de los valores. El MISMO esquema valida en el navegador (React Hook Form) y en
 * el servidor (caso de uso CreateTicket): una sola fuente de verdad.
 *
 * Los campos de tipo "file" no van en `values`: se validan aparte con `fileRules`.
 */

export type FileRule = {
  key: string;
  label: string;
  required: boolean;
  maxFiles: number;
  accept?: string[];
};

export type TicketForm = {
  /** Esquema de `values` (sin archivos). */
  valuesSchema: z.ZodObject<Record<string, z.ZodType>>;
  fileRules: FileRule[];
  /** Valores iniciales vacíos para el formulario. */
  defaults: Record<string, unknown>;
};

const req = (label: string) => `${label} es obligatorio.`;

function fieldSchema(
  f: Exclude<TemplateField, { type: "file" }>,
  now: () => Date,
): { schema: z.ZodType; empty: unknown } {
  const optional = !f.required;
  switch (f.type) {
    case "text": {
      let s = z
        .string()
        .trim()
        .max(f.maxLength ?? 500, `Máximo ${f.maxLength ?? 500} caracteres.`);
      if (f.format === "url")
        s = s.refine(
          (v) => !v || /^https?:\/\/\S+$/i.test(v),
          "Escribe un enlace válido (https://…).",
        ) as unknown as typeof s;
      if (f.format === "email")
        s = s.refine(
          (v) => !v || z.email().safeParse(v).success,
          "Escribe un correo válido.",
        ) as unknown as typeof s;
      return {
        schema: optional ? s.optional().or(z.literal("")) : s.min(1, req(f.label)),
        empty: "",
      };
    }
    case "textarea": {
      const s = z
        .string()
        .trim()
        .max(f.maxLength ?? 10_000, `Máximo ${f.maxLength ?? 10_000} caracteres.`);
      return {
        schema: optional ? s.optional().or(z.literal("")) : s.min(1, req(f.label)),
        empty: "",
      };
    }
    case "number": {
      let s = z.coerce.number({ error: "Escribe un número." });
      if (f.integer) s = s.int("Escribe un número entero.");
      if (f.min !== undefined) s = s.min(f.min, `Mínimo ${f.min}.`);
      if (f.max !== undefined) s = s.max(f.max, `Máximo ${f.max}.`);
      const blankToUndef = z.preprocess(
        (v) => (v === "" || v === null ? undefined : v),
        optional ? s.optional() : s,
      );
      return { schema: blankToUndef, empty: "" };
    }
    case "select": {
      const s = z.enum(f.options as [string, ...string[]], {
        error: `Elige una opción de ${f.label.toLowerCase()}.`,
      });
      return {
        schema: optional ? z.preprocess((v) => (v === "" ? undefined : v), s.optional()) : s,
        empty: "",
      };
    }
    case "multiselect": {
      const s = z.array(z.enum(f.options as [string, ...string[]]));
      return {
        schema: optional
          ? s.default([])
          : s.min(1, `Elige al menos una opción de ${f.label.toLowerCase()}.`),
        empty: [],
      };
    }
    case "date": {
      const s = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha.");
      const withMin =
        f.minFromNowDays !== undefined
          ? s.refine((v) => {
              const min = new Date(now().getTime() + (f.minFromNowDays ?? 0) * 86_400_000)
                .toISOString()
                .slice(0, 10);
              return v >= min;
            }, `La fecha debe ser al menos dentro de ${f.minFromNowDays} día(s).`)
          : s;
      return {
        schema: optional
          ? z.preprocess((v) => (v === "" ? undefined : v), withMin.optional())
          : withMin,
        empty: "",
      };
    }
    case "datetime": {
      const s = z
        .string()
        .min(1, req(f.label))
        .refine((v) => !Number.isNaN(new Date(v).getTime()), "Elige fecha y hora.");
      const withMin =
        f.minFromNowMinutes !== undefined
          ? s.refine(
              (v) =>
                new Date(v).getTime() >=
                now().getTime() + (f.minFromNowMinutes ?? 0) * 60_000 - 60_000,
              `Debe ser al menos ${f.minFromNowMinutes >= 1440 ? `${Math.round(f.minFromNowMinutes / 1440)} día(s)` : `${f.minFromNowMinutes} minutos`} después de ahora.`,
            )
          : s;
      return {
        schema: optional
          ? z.preprocess((v) => (v === "" ? undefined : v), withMin.optional())
          : withMin,
        empty: "",
      };
    }
    case "checkbox": {
      const s = z.boolean();
      return {
        schema: f.required ? s.refine((v) => v, req(f.label)) : s.default(false),
        empty: false,
      };
    }
  }
}

export function buildTicketForm(
  fields: readonly TemplateField[],
  now: () => Date = () => new Date(),
): TicketForm {
  const shape: Record<string, z.ZodType> = {};
  const defaults: Record<string, unknown> = {};
  const fileRules: FileRule[] = [];
  for (const f of fields) {
    if (f.type === "file") {
      fileRules.push({
        key: f.key,
        label: f.label,
        required: !!f.required,
        maxFiles: f.maxFiles ?? 1,
        accept: f.accept,
      });
      continue;
    }
    const { schema, empty } = fieldSchema(f, now);
    shape[f.key] = schema;
    defaults[f.key] = empty;
  }
  return { valuesSchema: z.object(shape), fileRules, defaults };
}

/** Quita valores vacíos antes de guardar (la BD solo guarda lo que se respondió). */
export function compactValues(values: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(values).filter(
      ([, v]) => v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0),
    ),
  );
}

/** Texto legible de un valor para mostrarlo en el detalle. */
export function displayValue(
  field: TemplateField,
  value: unknown,
  formatDateTime: (d: Date) => string,
): string {
  if (value === undefined || value === null || value === "") return "—";
  switch (field.type) {
    case "multiselect":
      return Array.isArray(value) ? value.join(", ") : String(value);
    case "checkbox":
      return value ? "Sí" : "No";
    case "datetime":
      return formatDateTime(new Date(String(value)));
    case "date": {
      const [y, m, d] = String(value).split("-");
      return `${d}/${m}/${y}`;
    }
    default:
      return String(value);
  }
}
