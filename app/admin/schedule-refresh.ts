import {
  SLOT_DURATION_MINUTES,
  buildSlotDate,
  dayOfWeekFromDate,
  timeStringToMinutes,
} from "@/app/bookings/slot-utils";
import type { ScheduleProp } from "@/app/bookings/types";

const DAYS_TO_LOOK_AHEAD = 7;

/**
 * Próximo momento en que cambia de turno la grilla de la Turnera Global: el
 * inicio de un turno o el fin del último del día. Los turnos arrancan en el
 * horario de apertura más temprano del día, igual que el eje de la turnera.
 * Devuelve null si no hay horarios configurados.
 */
export function getNextSlotChange(now: Date, schedules: ScheduleProp[]): Date | null {
  for (let offset = 0; offset < DAYS_TO_LOOK_AHEAD; offset += 1) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    const daySchedules = schedules.filter((s) => s.dayOfWeek === dayOfWeekFromDate(day));
    if (daySchedules.length === 0) continue;

    const earliestOpen = Math.min(...daySchedules.map((s) => timeStringToMinutes(s.openingTime)));
    const latestClose = Math.max(...daySchedules.map((s) => timeStringToMinutes(s.closingTime)));
    for (
      let minutesOfDay = earliestOpen;
      minutesOfDay <= latestClose;
      minutesOfDay += SLOT_DURATION_MINUTES
    ) {
      const change = buildSlotDate(day, minutesOfDay);
      if (change > now) return change;
    }
  }
  return null;
}
