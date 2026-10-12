import { LATE_CANCELLATION_HOURS } from "@/src/domain/constants";

/**
 * Motivos con los que se registran las penalidades por cancelar un turno o
 * darse de baja de un partido abierto tarde. El reporte de asistencia los usa
 * para contar las cancelaciones tardías (ver getAttendanceReport).
 */
export const LATE_CANCELLATION_REASON = "Cancelación con menos de 3 horas de anticipación";
export const LATE_LEAVE_REASON = "Baja de un partido con menos de 3 horas de anticipación";

/**
 * Una cancelación es tardía (y se penaliza, RN-03) cuando faltan menos de
 * LATE_CANCELLATION_HOURS para el inicio del turno, o el turno ya empezó.
 */
export function isLateCancellation(fromDateTime: Date, now: Date = new Date()): boolean {
  return fromDateTime.getTime() - now.getTime() < LATE_CANCELLATION_HOURS * 60 * 60_000;
}
