import { DayOfWeek } from "@/src/domain/enums";

/** Textos de las clases que comparten el panel, la sección del profesor y la de los jugadores. */
export const DAY_LABELS: Record<DayOfWeek, string> = {
  [DayOfWeek.MONDAY]: "Lunes",
  [DayOfWeek.TUESDAY]: "Martes",
  [DayOfWeek.WEDNESDAY]: "Miércoles",
  [DayOfWeek.THURSDAY]: "Jueves",
  [DayOfWeek.FRIDAY]: "Viernes",
  [DayOfWeek.SATURDAY]: "Sábado",
  [DayOfWeek.SUNDAY]: "Domingo",
};

/** "Martes 10:00–11:30 · Cancha 3" */
export function scheduleLabel(schedule: {
  dayOfWeek: DayOfWeek;
  startTime: string;
  endTime: string;
  courtNumber: number;
}): string {
  return `${DAY_LABELS[schedule.dayOfWeek]} ${schedule.startTime}–${schedule.endTime} · Cancha ${schedule.courtNumber}`;
}

/** "YYYY-MM-DD" → "DD/MM/YYYY" */
export function formatDate(iso: string): string {
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

/** "1/2 alumnos · 1 lugar libre", o "· completa" si no quedan lugares. */
export function occupancyLabel(studentsCount: number, classCapacity: number): string {
  const free = classCapacity - studentsCount;
  const freeLabel = free <= 0 ? "completa" : `${free} ${free === 1 ? "lugar libre" : "lugares libres"}`;
  return `${studentsCount}/${classCapacity} alumnos · ${freeLabel}`;
}
