import { describe, expect, it } from "vitest";
import { TICKET_TYPES } from "@/shared/db/seed/catalog";
import { templateFieldsSchema } from "./template-field";

describe("templateFieldsSchema", () => {
  it("las 6 plantillas del catálogo son válidas", () => {
    for (const t of TICKET_TYPES) {
      const r = templateFieldsSchema.safeParse(t.fields);
      expect(r.success, `${t.slug}: ${JSON.stringify(r.error?.issues)}`).toBe(true);
    }
  });

  it("rechaza claves repetidas", () => {
    const r = templateFieldsSchema.safeParse([
      { key: "curso", label: "Curso", type: "text" },
      { key: "curso", label: "Otro", type: "textarea" },
    ]);
    expect(r.success).toBe(false);
  });

  it("rechaza un select sin opciones y tipos desconocidos", () => {
    expect(
      templateFieldsSchema.safeParse([{ key: "a", label: "A", type: "select", options: [] }])
        .success,
    ).toBe(false);
    expect(templateFieldsSchema.safeParse([{ key: "a", label: "A", type: "color" }]).success).toBe(
      false,
    );
  });

  it("rechaza claves con mayúsculas o espacios", () => {
    expect(
      templateFieldsSchema.safeParse([{ key: "Mi Campo", label: "A", type: "text" }]).success,
    ).toBe(false);
  });
});
