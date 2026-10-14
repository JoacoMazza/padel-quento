import "reflect-metadata";
import { Not } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";

/**
 * Turno tal como lo ve cualquiera en la grilla pública de /bookings: sin datos
 * de quién reservó ni de quiénes se sumaron al partido.
 */
export type PublicBooking = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  price: number;
  courtId: number;
  /** Si es un partido abierto que todavía busca jugadores. */
  needPlayers: boolean;
  confirmedPlayers: number;
  /** Si quien mira (el jugador de la sesión) ya forma parte del partido. */
  joinedByViewer: boolean;
};

/**
 * Turnos no cancelados para la grilla pública. Se usa desde el servidor (no es
 * una Server Action): `viewerPlayerId` es el jugador de la sesión, o null.
 */
export async function getPublicBookings(viewerPlayerId: number | null): Promise<PublicBooking[]> {
  const dataSource = await getDataSource();
  const bookings = await dataSource.getRepository<Booking>("Booking").find({
    where: { bookingState: Not(BookingState.CANCELLED) },
    relations: { court: true, match: { matchPlayers: true } },
  });

  return bookings.map((booking) => {
    const matchPlayers = booking.match?.matchPlayers ?? [];
    return {
      id: booking.id,
      fromDateTime: booking.fromDateTime,
      durationMinutes: booking.durationMinutes,
      bookingState: booking.bookingState,
      price: booking.price,
      courtId: booking.court.id,
      needPlayers: booking.match?.needPlayers ?? false,
      confirmedPlayers: matchPlayers.reduce((sum, mp) => sum + (mp.playersCount ?? 1), 0),
      joinedByViewer: viewerPlayerId !== null && matchPlayers.some((mp) => mp.playerId === viewerPlayerId),
    };
  });
}
