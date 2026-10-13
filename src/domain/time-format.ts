/**
 * Formato único de horas de la app y de los avisos: 24 h con el cero adelante
 * ("09:00", "18:30"). Los turnos se guardan como hora de pared del club, así
 * que las fechas se leen en hora local.
 */

const pad = (value: number) => String(value).padStart(2, "0");

/** Minutos desde las 00:00 a "HH:MM" (por ejemplo 570 → "09:30"). */
export function minutesToTimeLabel(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

/** Hora de una fecha como "HH:MM". */
export function dateToTimeLabel(date: Date): string {
  return minutesToTimeLabel(date.getHours() * 60 + date.getMinutes());
}

/** Hora de una fecha con segundos, como "HH:MM:SS" (por ejemplo, la última actualización de la turnera). */
export function dateToClockLabel(date: Date): string {
  return `${dateToTimeLabel(date)}:${pad(date.getSeconds())}`;
}
