import { DayOfWeek, FixedBookingFrequency } from "@/src/domain/enums";

// Las fechas de un turno fijo se manejan como "YYYY-MM-DD" (columnas `date`): así
// el cálculo de la serie no depende de la zona horaria ni de cambios de horario.
const DAY_MS = 24 * 60 * 60 * 1000;

const FREQUENCY_DAYS: Record<FixedBookingFrequency, number> = {
  [FixedBookingFrequency.WEEKLY]: 7,
  [FixedBookingFrequency.BIWEEKLY]: 14,
};

// Mismo orden que Date#getUTCDay (domingo = 0).
const DAYS_OF_WEEK = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

function isoToUTC(iso: string): number {
  const [year, month, day] = iso.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

function utcToISO(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  return utcToISO(isoToUTC(iso) + days * DAY_MS);
}

export function dayOfWeekOfISO(iso: string): DayOfWeek {
  return DAYS_OF_WEEK[new Date(isoToUTC(iso)).getUTCDay()];
}

/** Fecha local (hora de pared del club) de hoy en formato "YYYY-MM-DD". */
export function todayISO(now: Date = new Date()): string {
  return utcToISO(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export type FixedBookingSeries = {
  startDate: string;
  frequency: FixedBookingFrequency;
  endDate: string | null;
};

/**
 * Fechas de la serie entre `from` y `until` (ambas incluidas), sin pasar de la
 * fecha de fin. La serie arranca en `startDate` y se repite cada 7 o 14 días.
 */
export function occurrenceDates(series: FixedBookingSeries, from: string, until: string): string[] {
  const step = FREQUENCY_DAYS[series.frequency] * DAY_MS;
  const start = isoToUTC(series.startDate);
  const last = Math.min(isoToUTC(until), series.endDate ? isoToUTC(series.endDate) : Infinity);

  // Primera fecha de la serie que no es anterior a `from`.
  const offset = Math.max(isoToUTC(from) - start, 0);
  let current = start + Math.ceil(offset / step) * step;

  const dates: string[] = [];
  while (current <= last) {
    dates.push(utcToISO(current));
    current += step;
  }
  return dates;
}

/** Inicio del turno de una fecha de la serie, en hora de pared del club. */
export function occurrenceStart(iso: string, startTime: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  const [hours, minutes] = startTime.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes);
}
