import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";

export type CourtProp = { id: number; number: number; state: CourtState; price?: number };

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
  price?: number;
  /** Si tiene un partido abierto asociado que todavía está buscando jugadores. */
  needPlayers: boolean;
  courtId?: number;
  confirmedPlayers: number;
  /** IDs de los jugadores ya sumados al partido (incluye a quien lo creó). */
  matchPlayerIds?: number[];
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
  /** true si el jugador logueado ya forma parte de este partido (creador o sumado). */
  alreadyJoined?: boolean;
};

export type SelectedSlot = {
  courtId: number;
  courtNumber: number;
  price: number;
  start: Date;
  end: Date;
};

export type SelectedOpenMatch = {
  bookingId: number;
  courtId: number;
  courtNumber: number;
  price: number;
  start: Date;
  end: Date;
  confirmedPlayers: number;
  alreadyJoined: boolean;
};
