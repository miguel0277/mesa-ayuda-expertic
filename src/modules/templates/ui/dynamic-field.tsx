"use client";

import { Controller, type Control, type FieldValues, type Path } from "react-hook-form";
import { Checkbox } from "@/shared/ui/components/checkbox";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/shared/ui/components/field";
import { Input } from "@/shared/ui/components/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/components/select";
import { Textarea } from "@/shared/ui/components/textarea";
import type { TemplateField } from "../domain/template-field";

/** Etiqueta con marca de opcional (en vez de asteriscos). */
function Label({ field, htmlFor }: { field: TemplateField; htmlFor?: string }) {
  return (
    <FieldLabel htmlFor={htmlFor}>
      {field.label}
      {!field.required && <span className="font-normal text-muted-foreground">(opcional)</span>}
    </FieldLabel>
  );
}

/**
 * Dibuja un campo de plantilla (no-archivo) conectado a React Hook Form.
 * Se usa en "Nueva solicitud" y en la vista previa del editor de plantillas.
 */
export function DynamicField<T extends FieldValues>({
  field,
  control,
  name,
}: {
  field: Exclude<TemplateField, { type: "file" }>;
  control: Control<T>;
  name: Path<T>;
}) {
  const id = `campo-${field.key}`;
  return (
    <Controller
      name={name}
      control={control}
      render={({ field: f, fieldState }) => {
        const invalid = fieldState.invalid;
        const help = field.helpText ? <FieldDescription>{field.helpText}</FieldDescription> : null;
        const error = <FieldError errors={[fieldState.error]} />;

        switch (field.type) {
          case "text":
          case "number":
          case "date":
          case "datetime":
            return (
              <Field data-invalid={invalid}>
                <Label field={field} htmlFor={id} />
                <Input
                  id={id}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : field.type === "datetime"
                          ? "datetime-local"
                          : field.format === "url"
                            ? "url"
                            : field.format === "email"
                              ? "email"
                              : "text"
                  }
                  inputMode={
                    field.type === "number"
                      ? "decimal"
                      : field.type === "text" && field.format === "url"
                        ? "url"
                        : undefined
                  }
                  placeholder={field.placeholder}
                  maxLength={field.type === "text" ? field.maxLength : undefined}
                  value={(f.value as string | number | undefined) ?? ""}
                  onChange={f.onChange}
                  onBlur={f.onBlur}
                  ref={f.ref}
                  aria-invalid={invalid}
                />
                {help}
                {error}
              </Field>
            );
          case "textarea":
            return (
              <Field data-invalid={invalid}>
                <Label field={field} htmlFor={id} />
                <Textarea
                  id={id}
                  rows={4}
                  placeholder={field.placeholder}
                  maxLength={field.maxLength}
                  value={(f.value as string | undefined) ?? ""}
                  onChange={f.onChange}
                  onBlur={f.onBlur}
                  ref={f.ref}
                  aria-invalid={invalid}
                />
                {help}
                {error}
              </Field>
            );
          case "select":
            return (
              <Field data-invalid={invalid}>
                <Label field={field} htmlFor={id} />
                <Select
                  value={(f.value as string | undefined) || undefined}
                  onValueChange={f.onChange}
                >
                  <SelectTrigger
                    id={id}
                    aria-invalid={invalid}
                    className="w-full"
                    onBlur={f.onBlur}
                  >
                    <SelectValue placeholder={field.placeholder ?? "Elige una opción"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {field.options.map((o) => (
                        <SelectItem key={o} value={o}>
                          {o}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
                {help}
                {error}
              </Field>
            );
          case "multiselect": {
            const value = (f.value as string[] | undefined) ?? [];
            return (
              <FieldSet data-invalid={invalid}>
                <FieldLegend variant="label">
                  {field.label}
                  {!field.required && (
                    <span className="font-normal text-muted-foreground"> (opcional)</span>
                  )}
                </FieldLegend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {field.options.map((o) => {
                    const oid = `${id}-${o}`;
                    return (
                      <Field
                        key={o}
                        orientation="horizontal"
                        className="rounded-lg border px-3 py-2 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-secondary/50"
                      >
                        <Checkbox
                          id={oid}
                          checked={value.includes(o)}
                          onCheckedChange={(on) =>
                            f.onChange(on ? [...value, o] : value.filter((x) => x !== o))
                          }
                        />
                        <FieldLabel htmlFor={oid} className="font-normal">
                          {o}
                        </FieldLabel>
                      </Field>
                    );
                  })}
                </div>
                {help}
                {error}
              </FieldSet>
            );
          }
          case "checkbox":
            return (
              <Field orientation="horizontal" data-invalid={invalid}>
                <Checkbox
                  id={id}
                  checked={!!f.value}
                  onCheckedChange={(v) => f.onChange(v === true)}
                  aria-invalid={invalid}
                />
                <FieldContent>
                  <FieldLabel htmlFor={id} className="font-normal">
                    {field.label}
                  </FieldLabel>
                  {help}
                  {error}
                </FieldContent>
              </Field>
            );
        }
      }}
    />
  );
}
