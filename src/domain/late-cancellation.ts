import { LATE_CANCELLATION_HOURS } from "@/src/domain/constants";

/**
 * Una cancelación es tardía (y se penaliza, RN-03) cuando faltan menos de
 * LATE_CANCELLATION_HOURS para el inicio del turno, o el turno ya empezó.
 */
export function isLateCancellation(fromDateTime: Date, now: Date = new Date()): boolean {
  return fromDateTime.getTime() - now.getTime() < LATE_CANCELLATION_HOURS * 60 * 60_000;
}
