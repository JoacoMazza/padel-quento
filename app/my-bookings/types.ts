import { BookingState } from "@/src/domain/enums";

export type MyBookingItem = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtNumber: number;
  /** Id del partido abierto asociado, si lo hay. */
  matchId: number | null;
  needPlayers: boolean;
  confirmedPlayers: number;
  /** true si este jugador se sumó a un partido abierto creado por otro (no lo reservó él). */
  joinedAsParticipant: boolean;
};

export type DateFilter = "all" | "today" | "week" | "month";

export type StatusFilter = "all" | "confirmed" | "pending";

export type BookingTone = "confirmed" | "pending" | "completed" | "cancelled";
