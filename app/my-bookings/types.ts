import { BookingState } from "@/src/domain/enums";

export type MyBookingItem = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtNumber: number;
  price: number;
  /** Id del partido abierto asociado, si lo hay. */
  matchId: number | null;
  needPlayers: boolean;
  confirmedPlayers: number;
  /** Id de la sala de chat temporal del partido, si ya se creó. */
  chatId: number | null;
  /** true si este jugador se sumó a un partido abierto creado por otro (no lo reservó él). */
  joinedAsParticipant: boolean;
  /** true si es un partido terminado en el que puede calificar a sus compañeros (HU-36). */
  canReview: boolean;
  /** true si es una fecha de un turno fijo (HU-41): solo el club la puede liberar. */
  isFixed: boolean;
};

export type DateFilter = "all" | "today" | "week" | "month";

export type StatusFilter = "all" | "confirmed" | "pending";

export type BookingTone = "confirmed" | "pending" | "completed" | "cancelled";
