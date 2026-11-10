import { describe, expect, it } from "vitest";
import { addBusinessMinutes, businessMinutesBetween, defaultCalendar } from "./business-time";
import { colombianHolidays, easterSunday } from "./holidays-co";

// Bogotá = UTC-5 (sin horario de verano).
const bog = (local: string) => new Date(`${local}-05:00`);
const cal = defaultCalendar([2026, 2027]);

describe("festivos de Colombia", () => {
  it("calcula la Pascua", () => {
    expect(easterSunday(2026).toISOString().slice(0, 10)).toBe("2026-04-05");
    expect(easterSunday(2027).toISOString().slice(0, 10)).toBe("2027-03-28");
  });

  it("lista los 18 festivos de 2026 con traslados de la Ley Emiliani", () => {
    const dates = colombianHolidays(2026).map((h) => h.date);
    expect(dates).toHaveLength(18);
    expect(dates).toEqual([
      "2026-01-01",
      "2026-01-12",
      "2026-03-23",
      "2026-04-02",
      "2026-04-03",
      "2026-05-01",
      "2026-05-18",
      "2026-06-08",
      "2026-06-15",
      "2026-06-29",
      "2026-07-20",
      "2026-08-07",
      "2026-08-17",
      "2026-10-12",
      "2026-11-02",
      "2026-11-16",
      "2026-12-08",
      "2026-12-25",
    ]);
  });
});

describe("addBusinessMinutes", () => {
  it("suma dentro del mismo día hábil", () => {
    expect(addBusinessMinutes(bog("2026-11-10T09:00:00"), 120, cal)).toEqual(
      bog("2026-11-10T11:00:00"),
    );
  });

  it("si empieza antes de abrir, cuenta desde las 7:00", () => {
    expect(addBusinessMinutes(bog("2026-11-10T05:30:00"), 60, cal)).toEqual(
      bog("2026-11-10T08:00:00"),
    );
  });

  it("pasa al día siguiente al cerrar a las 18:00", () => {
    expect(addBusinessMinutes(bog("2026-11-10T17:00:00"), 120, cal)).toEqual(
      bog("2026-11-11T08:00:00"),
    );
  });

  it("salta fin de semana y festivo (viernes 13 → martes 17 de noviembre de 2026)", () => {
    expect(addBusinessMinutes(bog("2026-11-13T17:00:00"), 120, cal)).toEqual(
      bog("2026-11-17T08:00:00"),
    );
  });

  it("si se crea en fin de semana, empieza el lunes hábil", () => {
    expect(addBusinessMinutes(bog("2026-11-07T10:00:00"), 30, cal)).toEqual(
      bog("2026-11-09T07:30:00"),
    );
  });

  it("24 h hábiles equivalen a algo más de 2 días laborales (11 h por día)", () => {
    expect(addBusinessMinutes(bog("2026-11-10T07:00:00"), 24 * 60, cal)).toEqual(
      bog("2026-11-12T09:00:00"),
    );
  });

  it("rechaza minutos negativos", () => {
    expect(() => addBusinessMinutes(new Date(), -1, cal)).toThrow();
  });
});

describe("businessMinutesBetween", () => {
  it("es el inverso de addBusinessMinutes", () => {
    const start = bog("2026-11-13T16:15:00");
    const end = addBusinessMinutes(start, 500, cal);
    expect(businessMinutesBetween(start, end, cal)).toBe(500);
  });

  it("devuelve 0 si el fin es anterior al inicio", () => {
    expect(
      businessMinutesBetween(bog("2026-11-10T10:00:00"), bog("2026-11-10T09:00:00"), cal),
    ).toBe(0);
  });
});
