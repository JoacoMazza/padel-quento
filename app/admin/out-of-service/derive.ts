import { BookingState } from "@/src/domain/enums";
import { rangesOverlap } from "@/app/bookings/slot-utils";
import type { BookingProp } from "@/app/bookings/types";
import type { CourtOption } from "@/app/admin/out-of-service/types";
import type { CourtMonitorItem, OutOfServiceItem, OutOfServiceStats } from "@/app/admin/out-of-service/types";
import type { CourtState } from "@/src/domain/enums";

function bookingEnd(booking: BookingProp): Date {
  return new Date(booking.fromDateTime.getTime() + booking.durationMinutes * 60_000);
}

export function buildCourtMonitorItems(
  courts: (CourtOption & { state: CourtState })[],
  outOfServices: OutOfServiceItem[],
  bookings: BookingProp[],
  now: Date,
): CourtMonitorItem[] {
  return courts.map((court) => {
    const courtBlocks = outOfServices.filter((entry) => entry.courtId === court.id);
    const activeBlock =
      courtBlocks.find((entry) => entry.fromDateTime <= now && now < entry.toDateTime) ?? null;

    const upcomingBlocks = courtBlocks
      .filter((entry) => entry.fromDateTime > now)
      .sort((a, b) => a.fromDateTime.getTime() - b.fromDateTime.getTime());

    const courtBookings = bookings.filter(
      (b) => b.courtId === court.id && b.bookingState !== BookingState.CANCELLED,
    );

    const currentBooking =
      courtBookings.find((b) => b.fromDateTime <= now && now < bookingEnd(b)) ?? null;

    const nextBooking =
      courtBookings
        .filter((b) => b.fromDateTime > now)
        .sort((a, b) => a.fromDateTime.getTime() - b.fromDateTime.getTime())[0] ?? null;

    return {
      id: court.id,
      number: court.number,
      state: court.state,
      activeBlock,
      currentBooking,
      nextBooking,
      nextService: upcomingBlocks[0] ?? null,
    };
  });
}

export function buildStats(
  courts: CourtOption[],
  outOfServices: OutOfServiceItem[],
  bookings: BookingProp[],
  now: Date,
): OutOfServiceStats {
  const activeBlocksList = outOfServices.filter(
    (entry) => entry.fromDateTime <= now && now < entry.toDateTime,
  );
  const blockedCourtIds = new Set(activeBlocksList.map((entry) => entry.courtId));

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTomorrow = new Date(startOfToday);
  startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

  const affectedBookingIds = new Set<number>();
  for (const booking of bookings) {
    if (booking.bookingState !== BookingState.CANCELLED) continue;
    if (booking.fromDateTime < startOfToday || booking.fromDateTime >= startOfTomorrow) continue;
    if (booking.courtId === undefined) continue;

    const end = bookingEnd(booking);
    const wasBlocked = outOfServices.some(
      (entry) =>
        entry.courtId === booking.courtId &&
        rangesOverlap(booking.fromDateTime, end, entry.fromDateTime, entry.toDateTime),
    );
    if (wasBlocked) {
      affectedBookingIds.add(booking.id);
    }
  }

  const upcomingBlocks = outOfServices
    .filter((entry) => entry.fromDateTime > now)
    .sort((a, b) => a.fromDateTime.getTime() - b.fromDateTime.getTime());

  return {
    totalCourts: courts.length,
    courtsAvailable: courts.length - blockedCourtIds.size,
    activeBlocks: activeBlocksList.length,
    bookingsAffectedToday: affectedBookingIds.size,
    nextService: upcomingBlocks[0]
      ? { courtNumber: upcomingBlocks[0].courtNumber, fromDateTime: upcomingBlocks[0].fromDateTime }
      : null,
  };
}

export function outOfServiceStatusLabel(
  entry: OutOfServiceItem,
  now: Date,
): "Activo ahora" | "Finalizado" | "Programado" {
  if (now < entry.fromDateTime) return "Programado";
  if (now >= entry.toDateTime) return "Finalizado";
  return "Activo ahora";
}
