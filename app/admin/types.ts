import type { Booking } from "@/src/entities/Booking";
import type { BookingProp } from "@/app/bookings/types";

export type AdminMatchPlayerProp = {
  id: number;
  playerId: number;
  playerName: string;
  attended: boolean;
};

/**
 * BookingProp ampliado con los datos que necesita la turnera global del admin
 * para mostrar y marcar la asistencia (ver src/actions/attendance.ts): quien
 * reservó el turno (booker) si no tiene partido asociado, o cada jugador
 * confirmado del partido abierto si lo tiene.
 */
export type AdminBookingProp = BookingProp & {
  bookerId: number;
  bookerName: string;
  attended: boolean;
  matchPlayers: AdminMatchPlayerProp[];
};

/**
 * Arma un AdminBookingProp a partir de la entidad Booking devuelta por
 * getBookings()/getScheduleBoardData() (con booker y match.matchPlayers.player.booker
 * cargados). Se usa tanto en el render inicial (server) como en el refresco en
 * vivo (client), por eso no depende de nada del lado del servidor.
 */
export function mapBookingToAdminProp(booking: Booking): AdminBookingProp {
  return {
    id: booking.id,
    fromDateTime: new Date(booking.fromDateTime),
    durationMinutes: booking.durationMinutes,
    bookingState: booking.bookingState,
    price: booking.price,
    needPlayers: booking.match?.needPlayers ?? false,
    courtId: booking.court?.id,
    confirmedPlayers: (booking.match?.matchPlayers ?? []).reduce(
      (sum, mp) => sum + (mp.playersCount ?? 1),
      0,
    ),
    bookerId: booking.booker.id,
    bookerName: `${booking.booker.names} ${booking.booker.lastnames}`,
    attended: booking.attended,
    matchPlayers: (booking.match?.matchPlayers ?? []).map((mp) => ({
      id: mp.id,
      playerId: mp.player.id,
      playerName: `${mp.player.booker.names} ${mp.player.booker.lastnames}`,
      attended: mp.attended,
    })),
  };
}
