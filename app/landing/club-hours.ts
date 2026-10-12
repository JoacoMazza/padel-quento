import { DayOfWeek } from "@/src/domain/enums";

type ScheduleLike = { dayOfWeek: DayOfWeek; openingTime: string; closingTime: string };

export type ClubHoursRow = { days: string; hours: string };

const WEEK: Array<{ day: DayOfWeek; label: string }> = [
  { day: DayOfWeek.MONDAY, label: "lunes" },
  { day: DayOfWeek.TUESDAY, label: "martes" },
  { day: DayOfWeek.WEDNESDAY, label: "miércoles" },
  { day: DayOfWeek.THURSDAY, label: "jueves" },
  { day: DayOfWeek.FRIDAY, label: "viernes" },
  { day: DayOfWeek.SATURDAY, label: "sábado" },
  { day: DayOfWeek.SUNDAY, label: "domingo" },
];

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function daysLabel(first: string, last: string, count: number) {
  if (count === 1) return capitalize(first);
  return capitalize(`${first} ${count === 2 ? "y" : "a"} ${last}`);
}

/**
 * Horarios de apertura del complejo para mostrar en la landing, a partir de los
 * horarios de las canchas: de cada día se toma el más amplio, y los días
 * consecutivos con el mismo horario se agrupan ("Lunes a viernes").
 */
export function summarizeClubHours(schedules: ScheduleLike[]): ClubHoursRow[] {
  const byDay = WEEK.map(({ day, label }) => {
    const ofDay = schedules.filter((s) => s.dayOfWeek === day);
    if (ofDay.length === 0) return { label, hours: null };
    const opening = ofDay.map((s) => s.openingTime.slice(0, 5)).sort()[0];
    const closing = ofDay.map((s) => s.closingTime.slice(0, 5)).sort().at(-1)!;
    return { label, hours: `${opening} – ${closing}` };
  });

  const rows: ClubHoursRow[] = [];
  let start = 0;
  for (let i = 1; i <= byDay.length; i++) {
    if (i < byDay.length && byDay[i].hours === byDay[start].hours) continue;
    const hours = byDay[start].hours;
    if (hours) rows.push({ days: daysLabel(byDay[start].label, byDay[i - 1].label, i - start), hours });
    start = i;
  }
  return rows;
}
