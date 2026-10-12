import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import type { Booking } from "@/src/entities/Booking";

export type OpenMatchItem = {
  bookingId: number;
  start: Date;
  end: Date;
  courtNumber: number;
  price: number;
  confirmedPlayers: number;
  remainingSpots: number;
  organizerName: string;
  /** true si el jugador logueado ya forma parte del partido (creador o sumado). */
  alreadyJoined: boolean;
};

export type OpenMatchParticipant = {
  playerId: number;
  name: string;
  initials: string;
  category: PlayerCategory;
  /** El jugador más los acompañantes sin cuenta propia que trae. */
  playersCount: number;
  isOrganizer: boolean;
};

export type OpenMatchStatus = "open" | "full" | "cancelled" | "past";

export type OpenMatchDetail = OpenMatchItem & {
  status: OpenMatchStatus;
  participants: OpenMatchParticipant[];
  chatId: number | null;
};

export type OpenMatchFilter = "all" | "today" | "week";

/**
 * Arma el detalle del partido asociado a un turno (getBookings/getBookingById,
 * con booker, court y match.matchPlayers.player cargados). Devuelve null si el
 * turno no tiene partido.
 */
export function toOpenMatchDetail(booking: Booking, playerId: number | null, now: Date): OpenMatchDetail | null {
  const match = booking.match;
  if (!match) return null;

  const start = new Date(booking.fromDateTime);
  const matchPlayers = match.matchPlayers ?? [];
  const confirmedPlayers = matchPlayers.reduce((sum, mp) => sum + (mp.playersCount ?? 1), 0);

  const status: OpenMatchStatus =
    booking.bookingState === BookingState.CANCELLED
      ? "cancelled"
      : start < now
        ? "past"
        : match.needPlayers
          ? "open"
          : "full";

  return {
    bookingId: booking.id,
    start,
    end: new Date(start.getTime() + booking.durationMinutes * 60_000),
    courtNumber: booking.court?.number ?? 0,
    price: booking.price,
    confirmedPlayers,
    remainingSpots: Math.max(OPEN_MATCH_MAX_PLAYERS - confirmedPlayers, 0),
    organizerName: `${booking.booker.names} ${booking.booker.lastnames}`,
    alreadyJoined: playerId !== null && matchPlayers.some((mp) => mp.playerId === playerId),
    status,
    chatId: match.chat?.id ?? null,
    participants: matchPlayers.map((mp) => ({
      playerId: mp.playerId,
      name: `${mp.player.names} ${mp.player.lastnames}`,
      initials: `${mp.player.names.charAt(0)}${mp.player.lastnames.charAt(0)}`.toUpperCase(),
      category: mp.player.category,
      playersCount: mp.playersCount ?? 1,
      isOrganizer: mp.playerId === booking.booker.id,
    })),
  };
}

/** Partidos que todavía buscan jugadores y no empezaron, del más próximo al más lejano. */
export function listOpenMatches(bookings: Booking[], playerId: number | null, now: Date): OpenMatchItem[] {
  return bookings
    .map((booking) => toOpenMatchDetail(booking, playerId, now))
    .filter((detail): detail is OpenMatchDetail => detail?.status === "open")
    .sort((a, b) => a.start.getTime() - b.start.getTime())
    .map((detail) => ({
      bookingId: detail.bookingId,
      start: detail.start,
      end: detail.end,
      courtNumber: detail.courtNumber,
      price: detail.price,
      confirmedPlayers: detail.confirmedPlayers,
      remainingSpots: detail.remainingSpots,
      organizerName: detail.organizerName,
      alreadyJoined: detail.alreadyJoined,
    }));
}

export function matchesOpenMatchFilter(start: Date, now: Date, filter: OpenMatchFilter): boolean {
  if (filter === "all") return true;

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const limit = new Date(startOfToday);
  limit.setDate(limit.getDate() + (filter === "today" ? 1 : 7));

  return start >= startOfToday && start < limit;
}

// Los visitantes sin sesión ven los partidos abiertos sin datos personales de
// los jugadores: ni nombres ni el chat del partido (sí la categoría y los cupos).
const ANONYMOUS_PLAYER_NAME = "Jugador del club";

export function anonymizeOpenMatchItem(item: OpenMatchItem): OpenMatchItem {
  return { ...item, organizerName: ANONYMOUS_PLAYER_NAME };
}

export function anonymizeOpenMatch(detail: OpenMatchDetail): OpenMatchDetail {
  return {
    ...detail,
    organizerName: ANONYMOUS_PLAYER_NAME,
    chatId: null,
    participants: detail.participants.map((participant) => ({
      ...participant,
      name: ANONYMOUS_PLAYER_NAME,
      initials: "",
    })),
  };
}
