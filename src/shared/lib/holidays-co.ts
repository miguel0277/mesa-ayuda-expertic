/**
 * Festivos de Colombia (Ley 51 de 1983, "Ley Emiliani").
 * Devuelve fechas locales `YYYY-MM-DD`. Función pura, sin dependencias.
 */

const DAY_MS = 86_400_000;

const toKey = (d: Date) => d.toISOString().slice(0, 10);
const utc = (y: number, m: number, d: number) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * DAY_MS);

/** Lunes siguiente (o el mismo día si ya es lunes). */
function nextMonday(d: Date): Date {
  const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1 = lunes … 7 = domingo
  return addDays(d, (8 - iso) % 7);
}

/** Domingo de Pascua (algoritmo anónimo gregoriano). */
export function easterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return utc(year, month, day);
}

export type Holiday = { date: string; name: string };

export function colombianHolidays(year: number): Holiday[] {
  const easter = easterSunday(year);
  const list: Holiday[] = [
    // Fijos
    { date: toKey(utc(year, 1, 1)), name: "Año Nuevo" },
    { date: toKey(utc(year, 5, 1)), name: "Día del Trabajo" },
    { date: toKey(utc(year, 7, 20)), name: "Día de la Independencia" },
    { date: toKey(utc(year, 8, 7)), name: "Batalla de Boyacá" },
    { date: toKey(utc(year, 12, 8)), name: "Inmaculada Concepción" },
    { date: toKey(utc(year, 12, 25)), name: "Navidad" },
    // Trasladables al lunes
    { date: toKey(nextMonday(utc(year, 1, 6))), name: "Reyes Magos" },
    { date: toKey(nextMonday(utc(year, 3, 19))), name: "San José" },
    { date: toKey(nextMonday(utc(year, 6, 29))), name: "San Pedro y San Pablo" },
    { date: toKey(nextMonday(utc(year, 8, 15))), name: "Asunción de la Virgen" },
    { date: toKey(nextMonday(utc(year, 10, 12))), name: "Día de la Raza" },
    { date: toKey(nextMonday(utc(year, 11, 1))), name: "Todos los Santos" },
    { date: toKey(nextMonday(utc(year, 11, 11))), name: "Independencia de Cartagena" },
    // Según la Pascua
    { date: toKey(addDays(easter, -3)), name: "Jueves Santo" },
    { date: toKey(addDays(easter, -2)), name: "Viernes Santo" },
    { date: toKey(nextMonday(addDays(easter, 39))), name: "Ascensión del Señor" },
    { date: toKey(nextMonday(addDays(easter, 60))), name: "Corpus Christi" },
    { date: toKey(nextMonday(addDays(easter, 68))), name: "Sagrado Corazón" },
  ];
  return list.sort((x, y) => x.date.localeCompare(y.date));
}

/** Conjunto de festivos para varios años, más fechas extra configurables. */
export function holidaySet(years: number[], extra: readonly string[] = []): Set<string> {
  const set = new Set<string>(extra);
  for (const y of years) for (const h of colombianHolidays(y)) set.add(h.date);
  return set;
}
