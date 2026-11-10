import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateTime,
  formatDue,
  formatDuration,
  formatRelative,
  formatTime,
} from "./dates";

// 10/11/2026 3:05 p. m. en Bogotá (UTC-5)
const T = new Date("2026-11-10T20:05:00Z");

describe("fechas es-CO", () => {
  it("formatea fecha dd/MM/yyyy en hora de Bogotá", () => {
    expect(formatDate(T)).toBe("10/11/2026");
    // 11:30 p. m. del 10 en Bogotá ya es 11 en UTC: debe mostrar 10.
    expect(formatDate(new Date("2026-11-11T04:30:00Z"))).toBe("10/11/2026");
  });

  it("usa 12 h con a. m. / p. m.", () => {
    expect(formatTime(T)).toBe("3:05 p. m.");
    expect(formatTime(new Date("2026-11-10T12:00:00Z"))).toBe("7:00 a. m.");
    expect(formatTime(new Date("2026-11-10T17:00:00Z"))).toBe("12:00 p. m.");
    expect(formatTime(new Date("2026-11-10T05:15:00Z"))).toBe("12:15 a. m.");
  });

  it("combina fecha y hora", () => {
    expect(formatDateTime(T)).toBe("10/11/2026, 3:05 p. m.");
  });

  it("duraciones compactas", () => {
    expect(formatDuration(30_000)).toBe("menos de 1 min");
    expect(formatDuration(45 * 60_000)).toBe("45 min");
    expect(formatDuration(3 * 3_600_000)).toBe("3 h");
    expect(formatDuration(24 * 3_600_000)).toBe("1 día");
    expect(formatDuration(5 * 86_400_000)).toBe("5 días");
    expect(formatDuration(21 * 86_400_000)).toBe("3 semanas");
  });

  it("fechas relativas", () => {
    expect(formatRelative(new Date(T.getTime() - 2 * 3_600_000), T)).toBe("hace 2 h");
    expect(formatRelative(new Date(T.getTime() + 3 * 86_400_000), T)).toBe("en 3 días");
    expect(formatRelative(new Date(T.getTime() - 26 * 3_600_000), T)).toBe("ayer");
    expect(formatRelative(T, T)).toBe("justo ahora");
  });

  it("texto de vencimiento", () => {
    expect(formatDue(new Date(T.getTime() + 3 * 3_600_000), T)).toBe("Vence en 3 h");
    expect(formatDue(new Date(T.getTime() - 2 * 86_400_000), T)).toBe("Venció hace 2 días");
  });
});
