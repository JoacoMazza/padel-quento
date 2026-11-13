"use server";

import "reflect-metadata";
import { LessThan } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { BookingState } from "@/src/domain/enums";
import { ATTENDANCE_POINTS, OPEN_MATCH_JOIN_BONUS_POINTS } from "@/src/domain/constants";
import {
  ATTENDANCE_POINTS_REASON,
  OPEN_MATCH_JOIN_BONUS_REASON,
  bookerAttended,
  isPresent,
} from "@/src/domain/attendance";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";
import { recordPointsMovement } from "@/src/actions/profile";
import { syncNoShowPenalty } from "@/src/lib/no-show-penalties";
import { notifyReviewInvite } from "@/src/lib/match-notifications";

const BOOKING_NOT_FOUND_MESSAGE = "El turno no existe.";
const MATCH_PLAYER_NOT_FOUND_MESSAGE = "El jugador no forma parte de este partido.";
const OPEN_MATCH_BOOKING_MESSAGE =
  "Este turno es un partido abierto: marcá la asistencia de cada jugador por separado.";

/**
 * Marca si quien reservó un turno sin partido abierto asociado asistió o no.
 * Todo turno arranca como asistido: el administrador solo interviene desde la
 * turnera global para marcar la ausencia, que le descuenta la penalización en
 * el momento (ligada al turno). Volver a marcarlo presente se la devuelve.
 */
export async function setBookingAttendance(
  bookingId: number,
  attended: boolean,
): Promise<ActionResult<{ id: number; attended: boolean }>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const booking = await dataSource
      .getRepository<Booking>("Booking")
      .findOne({ where: { id: bookingId }, relations: { match: true, booker: true } });
    if (!booking) {
      return { success: false, error: BOOKING_NOT_FOUND_MESSAGE };
    }
    if (booking.match) {
      return { success: false, error: OPEN_MATCH_BOOKING_MESSAGE };
    }

    // Un turno previo a la migración puede no tener quien reservó: no hay a quién penalizar.
    if (booking.booker) await syncNoShowPenalty(booking.id, booking.booker.id, attended ? 0 : 1);

    return { success: true, data: { id: booking.id, attended } };
  } catch (error) {
    console.error("setBookingAttendance", error);
    return { success: false, error: "No se pudo actualizar la asistencia." };
  }
}

/**
 * Marca cuántos del grupo de un jugador de un partido abierto asistieron (de 0
 * a playersCount; arranca en playersCount). Cada ausente le descuenta la
 * penalización a ese jugador, que es quien se sumó o quien trajo al que faltó.
 */
export async function setMatchPlayerAttendance(
  matchPlayerId: number,
  attendedCount: number,
): Promise<ActionResult<{ id: number; attendedCount: number }>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const matchPlayers = dataSource.getRepository<MatchPlayer>("MatchPlayer");

    const matchPlayer = await matchPlayers.findOne({
      where: { id: matchPlayerId },
      relations: { match: { booking: true } },
    });
    if (!matchPlayer) {
      return { success: false, error: MATCH_PLAYER_NOT_FOUND_MESSAGE };
    }
    if (!Number.isInteger(attendedCount) || attendedCount < 0 || attendedCount > matchPlayer.playersCount) {
      return { success: false, error: `La cantidad de asistentes tiene que ser de 0 a ${matchPlayer.playersCount}.` };
    }

    await matchPlayers.update(matchPlayerId, { attendedCount });
    await syncNoShowPenalty(matchPlayer.match.booking.id, matchPlayer.playerId, matchPlayer.playersCount - attendedCount);

    return { success: true, data: { id: matchPlayerId, attendedCount } };
  } catch (error) {
    console.error("setMatchPlayerAttendance", error);
    return { success: false, error: "No se pudo actualizar la asistencia." };
  }
}

/**
 * Da por finalizados los turnos reservados que ya terminaron
 * (fromDateTime + durationMinutes en el pasado) y acredita sus puntos de
 * fidelidad por asistencia. Pensada para correr periódicamente desde un
 * proceso en segundo plano (ver src/jobs/attendance-points.ts): quien reservó
 * el turno (o cada jugador presente, si es un partido abierto) recibe los
 * puntos salvo que el administrador lo haya marcado ausente; las
 * inasistencias ya se descontaron al marcarlas. Quienes se sumaron al partido
 * abierto de otro jugador (no el que lo creó) reciben además
 * OPEN_MATCH_JOIN_BONUS_POINTS. Los turnos de una clase no mueven puntos.
 * Como solo procesa turnos reservados, cada turno se procesa una sola vez.
 */
export async function awardAttendancePoints(): Promise<ActionResult<number>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const matchPlayers = dataSource.getRepository<MatchPlayer>("MatchPlayer");

    const now = Date.now();
    const started = await bookings.find({
      where: { bookingState: BookingState.RESERVED, fromDateTime: LessThan(new Date(now)) },
      relations: { booker: true, lesson: true, penalties: true, match: { matchPlayers: { player: true } } },
    });
    const ended = started.filter((booking) => booking.fromDateTime.getTime() + booking.durationMinutes * 60_000 <= now);

    let awarded = 0;
    for (const booking of ended) {
      // Player hereda de Booker: el id de quien reservó es el de su jugador. Un
      // turno previo a la migración puede no tener quien reservó.
      const bookerPlayerId = booking.booker?.id ?? null;
      if (booking.lesson) {
        // Las clases no suman puntos.
      } else if (booking.match) {
        for (const matchPlayer of booking.match.matchPlayers ?? []) {
          if (!isPresent(matchPlayer)) continue;
          await recordPointsMovement(matchPlayer.player.id, ATTENDANCE_POINTS, "bonus", ATTENDANCE_POINTS_REASON, booking.id);
          let points = ATTENDANCE_POINTS;
          if (matchPlayer.player.id !== bookerPlayerId) {
            await recordPointsMovement(
              matchPlayer.player.id,
              OPEN_MATCH_JOIN_BONUS_POINTS,
              "bonus",
              OPEN_MATCH_JOIN_BONUS_REASON,
              booking.id,
            );
            points += OPEN_MATCH_JOIN_BONUS_POINTS;
          }
          await matchPlayers.update(matchPlayer.id, { pointsAwarded: points });
          awarded += 1;
        }
      } else if (bookerPlayerId !== null && bookerAttended(booking)) {
        await recordPointsMovement(bookerPlayerId, ATTENDANCE_POINTS, "bonus", ATTENDANCE_POINTS_REASON, booking.id);
        awarded += 1;
      }

      await bookings.update(booking.id, { bookingState: BookingState.FINISHED });

      // Terminado el partido abierto, se invita a calificar a los compañeros (HU-36).
      if (booking.match) {
        await notifyReviewInvite(booking.id);
      }
    }

    return { success: true, data: awarded };
  } catch (error) {
    console.error("awardAttendancePoints", error);
    return { success: false, error: "No se pudieron acreditar los puntos por asistencia." };
  }
}
