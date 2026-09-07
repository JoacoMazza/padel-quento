import { BookingState } from "@/src/domain/enums";

export type MyBookingItem = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtNumber: number;
};

export type DateFilter = "all" | "today" | "week" | "month";

export type StatusFilter = "all" | "confirmed" | "pending";

export type BookingTone = "confirmed" | "pending" | "completed" | "cancelled";
