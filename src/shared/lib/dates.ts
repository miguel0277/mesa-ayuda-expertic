/**
 * Formato de fechas para Colombia: dd/MM/yyyy, 12 h con "a. m." / "p. m.", zona America/Bogota.
 *
 * Funciones puras: reciben `now` para ser deterministas en pruebas y al prerenderizar.
 * Se usa Intl (no TZDate) porque TZDate crea un `new Date()` interno que Next 16 con
 * Cache Components rechaza durante el prerenderizado.
 */
export const APP_TIMEZONE = "America/Bogota";

type DateInput = Date | string | number;

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type LocalParts = { year: number; month: number; day: number; hour: number; minute: number };

/** Componentes de fecha/hora en Bogotá. */
export function localParts(d: DateInput): LocalParts {
  const parts = partsFormatter.formatToParts(new Date(d));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour") % 24,
    minute: get("minute"),
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** 10/11/2026 */
export function formatDate(d: DateInput): string {
  const p = localParts(d);
  return `${pad(p.day)}/${pad(p.month)}/${p.year}`;
}

/** 3:05 p. m. */
export function formatTime(d: DateInput): string {
  const p = localParts(d);
  const h12 = p.hour % 12 === 0 ? 12 : p.hour % 12;
  return `${h12}:${pad(p.minute)} ${p.hour < 12 ? "a. m." : "p. m."}`;
}

/** 10/11/2026, 3:05 p. m. */
export function formatDateTime(d: DateInput): string {
  return `${formatDate(d)}, ${formatTime(d)}`;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

/** Duración compacta y legible: "45 min", "3 h", "2 días", "3 semanas". */
export function formatDuration(ms: number): string {
  const abs = Math.abs(ms);
  if (abs < MINUTE) return "menos de 1 min";
  if (abs < HOUR) return `${Math.round(abs / MINUTE)} min`;
  if (abs < DAY) return `${Math.round(abs / HOUR)} h`;
  if (abs < 14 * DAY) return plural(Math.round(abs / DAY), "día", "días");
  return plural(Math.round(abs / (7 * DAY)), "semana", "semanas");
}

/** Días de calendario (en Bogotá) entre dos fechas. */
function calendarDayDiff(a: Date, b: Date): number {
  const pa = localParts(a);
  const pb = localParts(b);
  return Math.round(
    (Date.UTC(pa.year, pa.month - 1, pa.day) - Date.UTC(pb.year, pb.month - 1, pb.day)) / DAY,
  );
}

/**
 * Fecha relativa: "hace 2 h", "en 3 días", "ayer", "mañana".
 * Siempre acompañarla con la fecha absoluta en un tooltip (formatDateTime).
 */
export function formatRelative(d: DateInput, now: Date): string {
  const date = new Date(d);
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < MINUTE) return "justo ahora";
  if (abs >= DAY) {
    const days = calendarDayDiff(date, now);
    if (days === -1) return "ayer";
    if (days === 1) return "mañana";
  }
  return diff < 0 ? `hace ${formatDuration(diff)}` : `en ${formatDuration(diff)}`;
}

/** Texto de vencimiento: "Vence en 3 h" / "Venció hace 2 días". */
export function formatDue(due: DateInput, now: Date): string {
  const diff = new Date(due).getTime() - now.getTime();
  return diff >= 0 ? `Vence en ${formatDuration(diff)}` : `Venció hace ${formatDuration(diff)}`;
}
