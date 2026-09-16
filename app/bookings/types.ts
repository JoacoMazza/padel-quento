import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";

export type CourtProp = { id: number; number: number; state: CourtState };

export type ScheduleProp = {
  id: number;
  dayOfWeek: DayOfWeek;
  openingTime: string;
  closingTime: string;
  courtId?: number;
};

export type BookingProp = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtId?: number;
  confirmedPlayers: number;
};

export type OutOfServiceProp = {
  id: number;
  fromDateTime: Date;
  toDateTime: Date;
  courtId?: number;
};

export type SlotStatus = "available" | "occupied" | "selected" | "open";

export type Slot = {
  minutesOfDay: number;
  start: Date;
  end: Date;
  status: SlotStatus;
  /** Sólo presentes cuando status === "open": el partido abierto al que se puede sumar. */
  bookingId?: number;
  confirmedPlayers?: number;
};

export type SelectedSlot = {
  courtId: number;
  courtNumber: number;
  start: Date;
  end: Date;
};

export type SelectedOpenMatch = {
  bookingId: number;
  courtId: number;
  courtNumber: number;
  start: Date;
  end: Date;
  confirmedPlayers: number;
};
