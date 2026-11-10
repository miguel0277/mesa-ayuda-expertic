import { TZDate } from "@date-fns/tz";
import { addDays, format, getISODay, set, startOfDay } from "date-fns";
import { holidaySet } from "./holidays-co";

/** Calendario hábil: días ISO (1 = lunes), franja horaria y festivos `YYYY-MM-DD` locales. */
export type BusinessCalendar = {
  timezone: string;
  days: readonly number[];
  start: string; // "07:00"
  end: string; // "18:00"
  holidays: ReadonlySet<string>;
};

const MINUTE = 60_000;

function parseHm(hm: string): { hours: number; minutes: number } {
  const [h, m] = hm.split(":").map(Number);
  if (h === undefined || m === undefined || Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Hora inválida: ${hm}`);
  }
  return { hours: h, minutes: m };
}

/** Calendario por defecto ExperTIC: lunes a viernes 7:00–18:00, festivos de Colombia. */
export function defaultCalendar(
  years: number[],
  extraHolidays: readonly string[] = [],
): BusinessCalendar {
  return {
    timezone: "America/Bogota",
    days: [1, 2, 3, 4, 5],
    start: "07:00",
    end: "18:00",
    holidays: holidaySet(years, extraHolidays),
  };
}

type DayWindow = { open: TZDate; close: TZDate } | null;

function windowFor(day: TZDate, cal: BusinessCalendar): DayWindow {
  const key = format(day, "yyyy-MM-dd");
  if (!cal.days.includes(getISODay(day)) || cal.holidays.has(key)) return null;
  const s = parseHm(cal.start);
  const e = parseHm(cal.end);
  return {
    open: set(day, { hours: s.hours, minutes: s.minutes, seconds: 0, milliseconds: 0 }),
    close: set(day, { hours: e.hours, minutes: e.minutes, seconds: 0, milliseconds: 0 }),
  };
}

/**
 * Suma minutos hábiles a una fecha. Si `start` cae fuera del horario,
 * el conteo empieza en la siguiente apertura.
 */
export function addBusinessMinutes(start: Date, minutes: number, cal: BusinessCalendar): Date {
  if (minutes < 0) throw new Error("Los minutos deben ser positivos.");
  let cursor = new TZDate(start.getTime(), cal.timezone);
  let remaining = minutes;

  // Tope de seguridad: ~10 años de días.
  for (let i = 0; i < 3660; i++) {
    const w = windowFor(cursor, cal);
    if (w && cursor.getTime() < w.close.getTime()) {
      if (cursor.getTime() < w.open.getTime()) cursor = w.open;
      const available = (w.close.getTime() - cursor.getTime()) / MINUTE;
      if (remaining <= available) return new Date(cursor.getTime() + remaining * MINUTE);
      remaining -= available;
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  throw new Error("El calendario hábil no tiene días laborables.");
}

/** Minutos hábiles entre dos fechas (0 si `to` ≤ `from`). */
export function businessMinutesBetween(from: Date, to: Date, cal: BusinessCalendar): number {
  if (to.getTime() <= from.getTime()) return 0;
  let cursor = new TZDate(from.getTime(), cal.timezone);
  let total = 0;
  for (let i = 0; i < 3660 && cursor.getTime() < to.getTime(); i++) {
    const w = windowFor(cursor, cal);
    if (w) {
      const s = Math.max(cursor.getTime(), w.open.getTime());
      const e = Math.min(to.getTime(), w.close.getTime());
      if (e > s) total += (e - s) / MINUTE;
    }
    cursor = startOfDay(addDays(cursor, 1));
  }
  return Math.round(total);
}
