import { describe, expect, it } from "vitest";
import { buildTicketForm, compactValues } from "@/modules/templates/domain/ticket-form-factory";
import { TICKET_TYPES } from "@/shared/db/seed/catalog";
import { TICKET_STATUSES } from "@/shared/db/schema/enums";
import { computeSlaDues, slaView, type SlaPolicy } from "./sla";
import { allowedTransitions, TICKET_TRANSITIONS, timestampsFor, transition } from "./ticket-state";

const now = new Date("2026-11-10T15:00:00Z"); // martes 10:00 a. m. Bogotá

describe("máquina de estados del ticket", () => {
  it("define reglas para todos los estados", () => {
    for (const s of TICKET_STATUSES) expect(TICKET_TRANSITIONS[s]).toBeDefined();
  });

  it("flujo feliz completo", () => {
    let s = "abierto" as (typeof TICKET_STATUSES)[number];
    for (const [to, by] of [
      ["asignado", "staff"],
      ["en_progreso", "staff"],
      ["respondido", "staff"],
      ["cerrado", "requester"],
    ] as const) {
      const r = transition({ from: s, to, by, now });
      expect(r.ok, `${s} → ${to}`).toBe(true);
      if (r.ok) s = r.value;
    }
    expect(s).toBe("cerrado");
  });

  it("el solicitante responde y vuelve a en progreso", () => {
    expect(transition({ from: "respondido", to: "en_progreso", by: "requester", now }).ok).toBe(
      true,
    );
  });

  it("transiciones inválidas devuelven error, nunca pasan en silencio", () => {
    const r = transition({ from: "abierto", to: "respondido", by: "staff", now });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe("INVALID_TRANSITION");
    // El solicitante no puede asignar ni marcar en progreso.
    expect(transition({ from: "abierto", to: "asignado", by: "requester", now }).ok).toBe(false);
    expect(transition({ from: "asignado", to: "en_progreso", by: "requester", now }).ok).toBe(
      false,
    );
    // Nadie cierra dos veces.
    expect(transition({ from: "cerrado", to: "cerrado", by: "staff", now }).ok).toBe(false);
  });

  it("el solicitante solo reabre dentro de la ventana", () => {
    const closed3 = new Date(now.getTime() - 3 * 86_400_000);
    const closed9 = new Date(now.getTime() - 9 * 86_400_000);
    expect(
      transition({
        from: "cerrado",
        to: "reabierto",
        by: "requester",
        now,
        closedAt: closed3,
        reopenWindowDays: 7,
      }).ok,
    ).toBe(true);
    const late = transition({
      from: "cerrado",
      to: "reabierto",
      by: "requester",
      now,
      closedAt: closed9,
      reopenWindowDays: 7,
    });
    expect(late.ok).toBe(false);
    if (!late.ok) expect(late.error.message).toMatch(/7 días/);
    // El personal puede reabrir siempre.
    expect(
      transition({ from: "cerrado", to: "reabierto", by: "staff", now, closedAt: closed9 }).ok,
    ).toBe(true);
  });

  it("solo el sistema y las personas cierran por inactividad desde respondido", () => {
    expect(transition({ from: "respondido", to: "cerrado", by: "system", now }).ok).toBe(true);
    expect(transition({ from: "en_progreso", to: "cerrado", by: "system", now }).ok).toBe(false);
  });

  it("lista las acciones del solicitante", () => {
    expect(
      allowedTransitions("respondido", "requester")
        .map((r) => r.to)
        .sort(),
    ).toEqual(["cerrado", "en_progreso"]);
  });

  it("marcas de tiempo al responder, cerrar y reabrir", () => {
    const empty = { firstResponseAt: null, resolvedAt: null, closedAt: null };
    expect(timestampsFor("respondido", empty, now)).toEqual({
      firstResponseAt: now,
      resolvedAt: now,
      closedAt: null,
    });
    expect(timestampsFor("cerrado", empty, now).closedAt).toEqual(now);
    expect(
      timestampsFor("reabierto", { firstResponseAt: now, resolvedAt: now, closedAt: now }, now),
    ).toEqual({
      firstResponseAt: now,
      resolvedAt: null,
      closedAt: null,
    });
  });
});

describe("SLA", () => {
  const policy: SlaPolicy = {
    priority: "alta",
    firstResponseMinutes: 120,
    resolutionMinutes: 480,
    businessHours: {
      timezone: "America/Bogota",
      days: [1, 2, 3, 4, 5],
      start: "07:00",
      end: "18:00",
    },
  };

  it("calcula vencimientos en horas hábiles (viernes tarde → martes, por el festivo)", () => {
    const fridayLate = new Date("2026-11-13T22:00:00Z"); // viernes 5:00 p. m.
    const d = computeSlaDues(fridayLate, policy);
    expect(d.slaFirstResponseDue.toISOString()).toBe("2026-11-17T13:00:00.000Z"); // martes 8:00 a. m.
  });

  it("estado del SLA: en curso, en riesgo y vencido", () => {
    const base = {
      status: "asignado" as const,
      createdAt: new Date(now.getTime() - 3_600_000),
      firstResponseAt: null,
      resolvedAt: null,
      slaFirstResponseDue: new Date(now.getTime() + 3_600_000),
      slaResolutionDue: new Date(now.getTime() + 10 * 3_600_000),
    };
    expect(slaView(base, now).state).toBe("en_curso");
    expect(
      slaView({ ...base, slaFirstResponseDue: new Date(now.getTime() + 600_000) }, now).state,
    ).toBe("en_riesgo");
    expect(slaView({ ...base, slaFirstResponseDue: new Date(now.getTime() - 1) }, now).signal).toBe(
      "atrasada",
    );
  });

  it("resuelto a tiempo o tarde", () => {
    const t = {
      status: "cerrado" as const,
      createdAt: new Date(now.getTime() - 10 * 3_600_000),
      firstResponseAt: now,
      resolvedAt: now,
      slaFirstResponseDue: now,
      slaResolutionDue: new Date(now.getTime() + 1),
    };
    expect(slaView(t, now).state).toBe("cumplido");
    expect(slaView({ ...t, slaResolutionDue: new Date(now.getTime() - 1) }, now).state).toBe(
      "incumplido",
    );
  });
});

describe("TicketFormFactory", () => {
  const moodle = TICKET_TYPES.find((t) => t.slug === "errores-moodle")!;
  const sistemas = TICKET_TYPES.find((t) => t.slug === "solicitud-sistemas")!;

  it("separa campos de archivo y arma valores por defecto", () => {
    const f = buildTicketForm(moodle.fields, () => now);
    expect(f.fileRules.map((r) => r.key)).toEqual(["captura"]);
    expect(Object.keys(f.defaults)).toEqual(["curso", "enlace", "navegador", "pasos"]);
  });

  it("valida obligatorios, opciones y formato de enlace", () => {
    const { valuesSchema } = buildTicketForm(moodle.fields, () => now);
    const bad = valuesSchema.safeParse({
      curso: "",
      enlace: "no-es-url",
      navegador: "Netscape",
      pasos: "",
    });
    expect(bad.success).toBe(false);
    const paths = bad.success ? [] : bad.error.issues.map((i) => i.path.join("."));
    expect(paths).toEqual(expect.arrayContaining(["curso", "enlace", "navegador", "pasos"]));

    const good = valuesSchema.safeParse({
      curso: "Física I",
      enlace: "https://sea.uis.edu.co/course/view.php?id=1",
      navegador: "Chrome",
      pasos: "Abrí el quiz y falló.",
    });
    expect(good.success).toBe(true);
  });

  it("exige la anticipación mínima en fecha y hora", () => {
    const { valuesSchema } = buildTicketForm(sistemas.fields, () => now);
    const soon = new Date(now.getTime() + 3_600_000).toISOString();
    const later = new Date(now.getTime() + 3 * 86_400_000).toISOString();
    expect(
      valuesSchema.safeParse({ tipo_solicitud: "Creación de curso", fecha_requerida: soon })
        .success,
    ).toBe(false);
    expect(
      valuesSchema.safeParse({ tipo_solicitud: "Creación de curso", fecha_requerida: later })
        .success,
    ).toBe(true);
  });

  it("compacta valores vacíos", () => {
    expect(compactValues({ a: "", b: [], c: "x", d: undefined, e: false })).toEqual({
      c: "x",
      e: false,
    });
  });
});
