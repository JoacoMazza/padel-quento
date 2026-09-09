import { CourtState, OutOfServiceReason } from "@/src/domain/enums";
import type { BookingProp } from "@/app/bookings/types";

export type CourtOption = { id: number; number: number };

export type OutOfServiceItem = {
  id: number;
  createdAt: Date;
  fromDateTime: Date;
  toDateTime: Date;
  reason: OutOfServiceReason;
  description: string | null;
  courtId: number;
  courtNumber: number;
};

export type CourtMonitorItem = {
  id: number;
  number: number;
  state: CourtState;
  activeBlock: OutOfServiceItem | null;
  currentBooking: BookingProp | null;
  nextBooking: BookingProp | null;
  nextService: OutOfServiceItem | null;
};

export type OutOfServiceStats = {
  totalCourts: number;
  courtsAvailable: number;
  activeBlocks: number;
  bookingsAffectedToday: number;
  nextService: { courtNumber: number; fromDateTime: Date } | null;
};
