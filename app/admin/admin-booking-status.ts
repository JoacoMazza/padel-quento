import { BookingState } from "@/src/domain/enums";

export type AdminBookingStatus = "active" | "finished" | "cancelled";

/**
 * Estado de un turno visto por el admin: cancelado manda siempre; si no, el
 * turno está finalizado una vez pasado su horario de fin.
 */
export function getAdminBookingStatus(
  booking: { fromDateTime: Date; durationMinutes: number; bookingState: BookingState },
  now: Date,
): AdminBookingStatus {
  if (booking.bookingState === BookingState.CANCELLED) return "cancelled";
  const end = new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000;
  return end < now.getTime() ? "finished" : "active";
}
