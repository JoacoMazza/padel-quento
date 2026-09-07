import { BookingState } from "@/src/domain/enums";
import type { BookingTone, DateFilter, MyBookingItem, StatusFilter } from "@/app/my-bookings/types";

export function getBookingEnd(booking: MyBookingItem): Date {
  return new Date(booking.fromDateTime.getTime() + booking.durationMinutes * 60_000);
}

export function getBookingTone(booking: MyBookingItem, now: Date): BookingTone {
  if (booking.bookingState === BookingState.CANCELLED) return "cancelled";
  if (booking.bookingState === BookingState.PENDING_PLAYERS) return "pending";
  return getBookingEnd(booking) < now ? "completed" : "confirmed";
}

const TONE_LABEL: Record<BookingTone, string> = {
  confirmed: "Confirmado",
  pending: "Pendiente",
  completed: "Completado",
  cancelled: "Cancelado",
};

export function getBookingStatusLabel(tone: BookingTone): string {
  return TONE_LABEL[tone];
}

const TONE_BADGE_CLASSES: Record<BookingTone, string> = {
  confirmed: "bg-green-50 text-green-700",
  pending: "bg-blue-50 text-blue-700",
  completed: "bg-line/60 text-foreground/60",
  cancelled: "bg-danger-light text-danger",
};

export function getBookingBadgeClasses(tone: BookingTone): string {
  return TONE_BADGE_CLASSES[tone];
}

export function matchesStatusFilter(tone: BookingTone, filter: StatusFilter): boolean {
  if (filter === "all") return true;
  if (filter === "pending") return tone === "pending";
  return tone === "confirmed" || tone === "completed";
}

export function matchesDateFilter(start: Date, now: Date, filter: DateFilter): boolean {
  if (filter === "all") return true;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);

  if (filter === "today") {
    const startOfTomorrow = new Date(startOfToday);
    startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);
    return start >= startOfToday && start < startOfTomorrow;
  }

  if (filter === "week") {
    const in7Days = new Date(startOfToday);
    in7Days.setDate(in7Days.getDate() + 7);
    return start >= startOfToday && start < in7Days;
  }

  const in30Days = new Date(startOfToday);
  in30Days.setDate(in30Days.getDate() + 30);
  return start >= startOfToday && start < in30Days;
}
