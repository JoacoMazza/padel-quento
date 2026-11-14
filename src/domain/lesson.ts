import { DayOfWeek } from "@/src/domain/enums";
import { FIXED_BOOKING_HORIZON_DAYS, MAX_CLASS_CAPACITY, MIN_CLASS_CAPACITY } from "@/src/domain/constants";
import { addDaysISO, dayOfWeekOfISO } from "@/src/domain/fixed-booking";
import { SLOT_DURATION_MINUTES } from "@/app/bookings/slot-utils";
import { minutesToTimeLabel } from "@/src/domain/time-format";

/** Horario semanal de una clase: día y horas ("HH:MM") en hora de pared del club. */
export type LessonSlot = { dayOfWeek: DayOfWeek; startTime: string; endTime: string };

export type LessonInputToValidate = {
  classCapacity: number;
  price: number;
  /** Primera y última fecha de la clase ("YYYY-MM-DD"), ambas incluidas; sin la última, no tiene fin. */
  fromDate: string;
  toDate: string | null;
  schedules: LessonSlot[];
};

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

export function scheduleDurationMinutes(slot: { startTime: string; endTime: string }): number {
  return toMinutes(slot.endTime) - toMinutes(slot.startTime);
}

/**
 * Inicios ("HH:MM") de los turnos de la grilla entre la apertura y el cierre
 * de la cancha: cada 90 minutos desde la apertura, como en las reservas.
 */
export function slotStartTimes(openingTime: string, closingTime: string): string[] {
  const starts: string[] = [];
  for (let minutes = toMinutes(openingTime); minutes + SLOT_DURATION_MINUTES <= toMinutes(closingTime); minutes += SLOT_DURATION_MINUTES) {
    starts.push(minutesToTimeLabel(minutes));
  }
  return starts;
}

/**
 * Hasta qué fecha se reservan los turnos de la clase: su fecha de fin o, si no
 * tiene, el horizonte de 6 meses desde hoy (como los turnos fijos).
 */
export function lessonEndDate(toDate: string | null, today: string): string {
  return toDate ?? addDaysISO(today, FIXED_BOOKING_HORIZON_DAYS);
}

/** Fechas ("YYYY-MM-DD") entre `fromDate` y `toDate`, ambas incluidas, que caen en `dayOfWeek`. */
export function lessonOccurrenceDates(dayOfWeek: DayOfWeek, fromDate: string, toDate: string): string[] {
  const dates: string[] = [];
  for (let date = fromDate; date <= toDate; date = addDaysISO(date, 1)) {
    if (dayOfWeekOfISO(date) === dayOfWeek) dates.push(date);
  }
  return dates;
}

/**
 * Reglas de una clase que no dependen de la base: cupo, precio, fechas y
 * horarios. Devuelve el motivo del rechazo para mostrar al admin, o null.
 */
export function lessonInputProblem(input: LessonInputToValidate, today: string): string | null {
  if (
    !Number.isInteger(input.classCapacity) ||
    input.classCapacity < MIN_CLASS_CAPACITY ||
    input.classCapacity > MAX_CLASS_CAPACITY
  ) {
    return `El cupo de la clase tiene que ser de ${MIN_CLASS_CAPACITY} a ${MAX_CLASS_CAPACITY} alumnos.`;
  }
  if (typeof input.price !== "number" || Number.isNaN(input.price) || input.price <= 0) {
    return "El precio de la clase tiene que ser mayor a 0.";
  }
  if (input.fromDate < today) return "La fecha de inicio no puede ser anterior a hoy.";
  if (input.toDate !== null && input.toDate < input.fromDate) {
    return "La fecha de fin no puede ser anterior a la de inicio.";
  }
  if (input.toDate !== null && input.toDate > addDaysISO(today, FIXED_BOOKING_HORIZON_DAYS)) {
    return "La clase no puede extenderse más de 6 meses desde hoy.";
  }
  if (input.schedules.length === 0) return "Agregá al menos un horario a la clase.";
  if (input.schedules.some((slot) => scheduleDurationMinutes(slot) <= 0)) {
    return "La hora de fin de cada horario tiene que ser posterior a la de inicio.";
  }
  const keys = input.schedules.map((slot) => `${slot.dayOfWeek} ${toMinutes(slot.startTime)}`);
  if (new Set(keys).size !== keys.length) return "Hay dos horarios el mismo día a la misma hora.";
  const until = lessonEndDate(input.toDate, today);
  if (input.schedules.every((slot) => lessonOccurrenceDates(slot.dayOfWeek, input.fromDate, until).length === 0)) {
    return "Ningún horario cae dentro de las fechas de la clase.";
  }
  return null;
}
