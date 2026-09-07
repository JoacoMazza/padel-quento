import { DayOfWeek } from "@/src/domain/enums";

export const SLOT_DURATION_MINUTES = 90;

const DAY_OF_WEEK_BY_INDEX: DayOfWeek[] = [
  DayOfWeek.SUNDAY,
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
];

export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dayOfWeekFromDate(date: Date): DayOfWeek {
  return DAY_OF_WEEK_BY_INDEX[date.getDay()];
}

export function timeStringToMinutes(value: string): number {
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function buildSlotDate(baseDate: Date, minutesOfDay: number): Date {
  const result = new Date(baseDate);
  result.setHours(0, 0, 0, 0);
  result.setMinutes(minutesOfDay);
  return result;
}

export function rangesOverlap(startA: Date, endA: Date, startB: Date, endB: Date): boolean {
  return startA < endB && startB < endA;
}

const LONG_DATE_FORMATTER = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatLongDate(date: Date): string {
  const formatted = LONG_DATE_FORMATTER.format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

const PRICE_FORMATTER = new Intl.NumberFormat("es-AR");

export function formatPrice(amount: number): string {
  return `$ ${PRICE_FORMATTER.format(amount)}`;
}
