import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import type { BookingProp, CourtProp, OutOfServiceProp, ScheduleProp, Slot } from "@/app/bookings/types";

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

function lastSlotStartMinutes(openMinutes: number, closeMinutes: number): number | null {
  const totalSlots = Math.floor((closeMinutes - openMinutes) / SLOT_DURATION_MINUTES);
  if (totalSlots <= 0) return null;
  return openMinutes + (totalSlots - 1) * SLOT_DURATION_MINUTES;
}

// Skips to tomorrow when every slot today is already in the past.
export function getInitialBoardDate(
  courts: CourtProp[],
  schedules: ScheduleProp[],
  now: Date,
): Date {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayDayOfWeek = dayOfWeekFromDate(today);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const hasSlotLeftToday = courts.some((court) => {
    const schedule = schedules.find((s) => s.courtId === court.id && s.dayOfWeek === todayDayOfWeek);
    if (!schedule) return false;
    const openMinutes = timeStringToMinutes(schedule.openingTime);
    const closeMinutes = timeStringToMinutes(schedule.closingTime);
    const lastStart = lastSlotStartMinutes(openMinutes, closeMinutes);
    return lastStart !== null && lastStart >= nowMinutes;
  });

  if (hasSlotLeftToday) return today;

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow;
}

/**
 * Turnos de una cancha para un día según su horario. No contempla la selección
 * del usuario: el tablero la aplica después sobre el resultado.
 */
export function buildCourtSlots({
  court,
  schedules,
  bookings,
  outOfServices,
  date,
  now,
  playerId,
}: {
  court: CourtProp;
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
  date: Date;
  now: Date;
  playerId: number | null;
}): Slot[] {
  const schedule = schedules.find((s) => s.courtId === court.id && s.dayOfWeek === dayOfWeekFromDate(date));
  if (!schedule) return [];

  const openMinutes = timeStringToMinutes(schedule.openingTime);
  const closeMinutes = timeStringToMinutes(schedule.closingTime);
  const isCourtOutOfService = court.state !== CourtState.AVAILABLE;
  const slots: Slot[] = [];

  for (
    let minutesOfDay = openMinutes;
    minutesOfDay + SLOT_DURATION_MINUTES <= closeMinutes;
    minutesOfDay += SLOT_DURATION_MINUTES
  ) {
    const start = buildSlotDate(date, minutesOfDay);
    const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60_000);
    const isPast = start < now;

    const isBlockedByOutOfService = outOfServices.some(
      (o) => o.courtId === court.id && rangesOverlap(start, end, new Date(o.fromDateTime), new Date(o.toDateTime)),
    );

    const overlappingBooking = bookings.find((b) => {
      if (b.courtId !== court.id || b.bookingState === BookingState.CANCELLED) return false;
      const bookingStart = new Date(b.fromDateTime);
      const bookingEnd = new Date(bookingStart.getTime() + b.durationMinutes * 60_000);
      return rangesOverlap(start, end, bookingStart, bookingEnd);
    });

    const isUnavailable = isCourtOutOfService || isPast || isBlockedByOutOfService;

    // Un partido abierto no cuenta como ocupado: todavía busca jugadores.
    if (overlappingBooking?.needPlayers && !isUnavailable) {
      slots.push({
        minutesOfDay,
        start,
        end,
        status: "open",
        bookingId: overlappingBooking.id,
        confirmedPlayers: overlappingBooking.confirmedPlayers,
        alreadyJoined: playerId != null && (overlappingBooking.matchPlayerIds ?? []).includes(playerId),
      });
      continue;
    }

    slots.push({ minutesOfDay, start, end, status: isUnavailable || overlappingBooking ? "occupied" : "available" });
  }

  return slots;
}

/** Turnos libres y partidos abiertos de un día, sumando todas las canchas. */
export function summarizeSlots(slotsByCourt: Slot[][]): { free: number; open: number } {
  const all = slotsByCourt.flat();
  return {
    free: all.filter((s) => s.status === "available").length,
    open: all.filter((s) => s.status === "open").length,
  };
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
