"use server";

import "reflect-metadata";
import { Booking } from "@/src/entities/Booking";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { BookingState } from "@/src/domain/enums";
import { ATTENDANCE_POINTS, OPEN_MATCH_JOIN_BONUS_POINTS, PENALTY_POINTS } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";
import { recordPointsMovement } from "@/src/actions/profile";

const BOOKING_NOT_FOUND_MESSAGE = "El turno no existe.";
const MATCH_PLAYER_NOT_FOUND_MESSAGE = "El jugador no forma parte de este partido.";
const OPEN_MATCH_BOOKING_MESSAGE =
  "Este turno es un partido abierto: marcá la asistencia de cada jugador por separado.";
const ATTENDANCE_POINTS_REASON = "Asistencia a turno reservado";
const OPEN_MATCH_JOIN_BONUS_REASON = "Bonus por sumarse a un partido abierto";
const NO_SHOW_PENALTY_REASON = "Inasistencia a turno reservado";

/**
 * Marca si quien reservó un turno sin partido abierto asociado
 * asistió o no. Todo turno arranca con attended = true (ver Booking.attended):
 * el administrador solo interviene desde la turnera global para marcar la
 * ausencia antes de que corra el job de puntos (src/jobs/attendance-points.ts).
 */
export async function setBookingAttendance(
  bookingId: number,
  attended: boolean,
): Promise<ActionResult<Booking>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");

    const booking = await bookings.findOne({ where: { id: bookingId }, relations: { match: true } });
    if (!booking) {
      return { success: false, error: BOOKING_NOT_FOUND_MESSAGE };
    }
    if (booking.match) {
      return { success: false, error: OPEN_MATCH_BOOKING_MESSAGE };
    }

    await bookings.update(bookingId, { attended });
    booking.attended = attended;

    return { success: true, data: toPlain(booking) };
  } catch (error) {
    console.error("setBookingAttendance", error);
    return { success: false, error: "No se pudo actualizar la asistencia." };
  }
}

/**
 * Marca la asistencia de un jugador puntual dentro de un partido abierto
 * (ver MatchPlayer.attended). Arranca en true por jugador.
 */
export async function setMatchPlayerAttendance(
  matchPlayerId: number,
  attended: boolean,
): Promise<ActionResult<MatchPlayer>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const matchPlayers = dataSource.getRepository<MatchPlayer>("MatchPlayer");

    const matchPlayer = await matchPlayers.findOne({ where: { id: matchPlayerId } });
    if (!matchPlayer) {
      return { success: false, error: MATCH_PLAYER_NOT_FOUND_MESSAGE };
    }

    await matchPlayers.update(matchPlayerId, { attended });
    matchPlayer.attended = attended;

    return { success: true, data: toPlain(matchPlayer) };
  } catch (error) {
    console.error("setMatchPlayerAttendance", error);
    return { success: false, error: "No se pudo actualizar la asistencia." };
  }
}

/**
 * Acredita los puntos de fidelidad por asistencia a los turnos ya finalizados
 * (fromDateTime + durationMinutes en el pasado) que todavía no fueron
 * procesados. Pensada para correr periódicamente desde un proceso en segundo
 * plano (ver src/jobs/attendance-points.ts): el jugador que reservó el turno
 * (o cada jugador confirmado, si es un partido abierto) recibe los puntos
 * salvo que el administrador ya lo haya marcado como ausente. Quienes se sumaron
 * al partido abierto de otro jugador (no el que lo creó) reciben además
 * OPEN_MATCH_JOIN_BONUS_POINTS, también solo si asistieron. Booking.pointsAwarded
 * evita procesar el mismo turno más de una vez.
 */
export async function awardAttendancePoints(): Promise<ActionResult<number>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");

    const pending = await bookings.find({
      where: { pointsAwarded: false },
      relations: { booker: true, match: { matchPlayers: { player: true } } },
    });

    const now = Date.now();
    const ended = pending.filter((booking) => {
      if (booking.bookingState === BookingState.CANCELLED) return false;
      const endTime = booking.fromDateTime.getTime() + booking.durationMinutes * 60_000;
      return endTime <= now;
    });

    let awarded = 0;
    for (const booking of ended) {
      // Player hereda de Booker: el id de quien reservó es el de su jugador. Un
      // turno previo a la migración puede no tener quien reservó.
      const bookerPlayerId = booking.booker?.id ?? null;
      if (booking.match) {
        for (const matchPlayer of booking.match.matchPlayers ?? []) {
          if (matchPlayer.attended) {
            await recordPointsMovement(matchPlayer.player.id, ATTENDANCE_POINTS, "bonus", ATTENDANCE_POINTS_REASON);
            if (matchPlayer.player.id !== bookerPlayerId) {
              await recordPointsMovement(
                matchPlayer.player.id,
                OPEN_MATCH_JOIN_BONUS_POINTS,
                "bonus",
                OPEN_MATCH_JOIN_BONUS_REASON,
              );
            }
            awarded += 1;
          } else {
            await recordPointsMovement(matchPlayer.player.id, PENALTY_POINTS, "penalty", NO_SHOW_PENALTY_REASON);
          }
        }
      } else if (bookerPlayerId === null) {
        // Sin jugador registrado no hay a quién acreditar ni descontar puntos.
      } else if (booking.attended) {
        await recordPointsMovement(bookerPlayerId, ATTENDANCE_POINTS, "bonus", ATTENDANCE_POINTS_REASON);
        awarded += 1;
      } else {
        // Inasistencia marcada por el administrador (RN-04).
        await recordPointsMovement(bookerPlayerId, PENALTY_POINTS, "penalty", NO_SHOW_PENALTY_REASON);
      }

      await bookings.update(booking.id, { pointsAwarded: true });
    }

    return { success: true, data: awarded };
  } catch (error) {
    console.error("awardAttendancePoints", error);
    return { success: false, error: "No se pudieron acreditar los puntos por asistencia." };
  }
}
