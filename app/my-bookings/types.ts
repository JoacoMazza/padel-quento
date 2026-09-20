import { BookingState } from "@/src/domain/enums";

export type MyBookingItem = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtNumber: number;
  courtLocation?: string;
  price: number;
  /** Id del partido abierto asociado, si lo hay. */
  matchId: number | null;
  needPlayers: boolean;
  confirmedPlayers: number;
  /** Id de la sala de chat temporal del partido, si ya se creó. */
  chatId: number | null;
  /** true si este jugador se sumó a un partido abierto creado por otro (no lo reservó él). */
  joinedAsParticipant: boolean;
};

export type DateFilter = "all" | "today" | "week" | "month";

export type StatusFilter = "all" | "confirmed" | "pending";

export type BookingTone = "confirmed" | "pending" | "completed" | "cancelled";
