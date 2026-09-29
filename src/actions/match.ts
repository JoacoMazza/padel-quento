"use server";

import "reflect-metadata";
import { Booking } from "@/src/entities/Booking";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { BookingState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS, OPEN_MATCH_MIN_HOURS_BEFORE_START, PENALTY_POINTS } from "@/src/domain/constants";
import { isLateCancellation } from "@/src/domain/late-cancellation";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { recordPointsMovement } from "@/src/actions/profile";

const NOT_OPEN_MESSAGE = "Este partido ya no está buscando jugadores.";
const INVALID_PLAYERS_TO_CLOSE_MESSAGE = `El cierre manual solo está disponible con entre 1 y ${OPEN_MATCH_MAX_PLAYERS - 1} jugadores confirmados.`;
const CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE = "No se pudieron cancelar los partidos abiertos vencidos.";
const NOT_A_MATCH_PLAYER_MESSAGE = "No formás parte de este partido.";
const CREATOR_CANNOT_LEAVE_MESSAGE = "Creaste este partido: para darte de baja tenés que cancelar el turno.";
const BOOKING_ALREADY_CANCELLED_MESSAGE = "El turno ya fue cancelado.";
const LATE_LEAVE_REASON = "Baja de un partido con menos de 3 horas de anticipación";

class NotOpenError extends Error {}
class InvalidPlayersToCloseError extends Error {}
class NotAMatchPlayerError extends Error {}
class CreatorCannotLeaveError extends Error {}
class BookingAlreadyCancelledError extends Error {}

/**
 * Cierre manual de la convocatoria de un partido abierto: quien lo creó ya
 * consiguió al resto de los jugadores por fuera de la app y asegura la cancha
 * dejando de buscar jugadores. Solo aplica con 1, 2 o 3 jugadores confirmados;
 * con el cupo completo el partido ya se cierra solo al sumarse el último jugador.
 */
export async function closeMatch(matchId: number): Promise<ActionResult<Match>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      // Entity by name, not by class: see hasOverlappingBooking in
      // src/actions/booking.ts for why (avoids EntityMetadataNotFoundError).
      const matches = manager.getRepository<Match>("Match");
      const match = await matches.findOne({
        where: { id: matchId },
        relations: { matchPlayers: true },
      });
      if (!match) {
        throw new Error("NOT_FOUND");
      }
      if (!match.needPlayers) {
        throw new NotOpenError();
      }

      const confirmedPlayers = (match.matchPlayers ?? []).reduce(
        (sum, p) => sum + (p.playersCount ?? 1),
        0,
      );
      if (confirmedPlayers < 1 || confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS) {
        throw new InvalidPlayersToCloseError();
      }

      // Update() en vez de save(match): el match trae precargado el array
      // matchPlayers, y guardar el objeto completo puede hacer que TypeORM
      // reconcile esa relación y borre filas que no figuren ahí. update()
      // solo toca la columna indicada.
      await matches.update(match.id, { needPlayers: false });
      match.needPlayers = false;
      return match;
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof NotOpenError) {
      return { success: false, error: NOT_OPEN_MESSAGE };
    }
    if (error instanceof InvalidPlayersToCloseError) {
      return { success: false, error: INVALID_PLAYERS_TO_CLOSE_MESSAGE };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "El partido no existe." };
    }
    console.error("closeMatch", error);
    return { success: false, error: "No se pudo cerrar el partido." };
  }
}

/**
 * Baja de un jugador que se sumó al partido abierto de otro. Si faltan menos
 * de 3 horas para el turno se lo penaliza (RN-03) y el partido queda como
 * está; si no, se libera su lugar y el partido vuelve a buscar jugadores. Quien
 * creó el partido no se da de baja: cancela el turno (ver updateBooking).
 */
export async function leaveMatch(matchId: number, playerId: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();

    const late = await dataSource.transaction(async (manager) => {
      const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
      const matchPlayer = await matchPlayers.findOne({
        where: { match: { id: matchId }, player: { id: playerId } },
        relations: { match: { booking: { player: true } } },
      });
      if (!matchPlayer) {
        throw new NotAMatchPlayerError();
      }

      const booking = matchPlayer.match.booking;
      if (booking.player.id === playerId) {
        throw new CreatorCannotLeaveError();
      }
      if (booking.bookingState === BookingState.CANCELLED) {
        throw new BookingAlreadyCancelledError();
      }

      await matchPlayers.delete(matchPlayer.id);

      const isLate = isLateCancellation(booking.fromDateTime);
      if (!isLate) {
        await manager.getRepository<Match>("Match").update(matchId, { needPlayers: true });
      }
      return isLate;
    });

    // Fuera de la transacción, igual que en updateBooking: solo se penaliza si
    // la baja efectivamente se guardó.
    if (late) {
      await recordPointsMovement(playerId, PENALTY_POINTS, "penalty", LATE_LEAVE_REASON);
    }

    return { success: true, data: null };
  } catch (error) {
    if (error instanceof NotAMatchPlayerError) {
      return { success: false, error: NOT_A_MATCH_PLAYER_MESSAGE };
    }
    if (error instanceof CreatorCannotLeaveError) {
      return { success: false, error: CREATOR_CANNOT_LEAVE_MESSAGE };
    }
    if (error instanceof BookingAlreadyCancelledError) {
      return { success: false, error: BOOKING_ALREADY_CANCELLED_MESSAGE };
    }
    console.error("leaveMatch", error);
    return { success: false, error: "No se pudo dar de baja del partido." };
  }
}

/**
 * Cancelación automática de partidos abiertos que no llegaron a completar el
 * cupo a horas de su inicio: pensada para correr periódicamente desde un
 * proceso en segundo plano (ver src/jobs/open-match-expiration.ts). Cancela el
 * turno asociado para liberar la cancha y marca el partido como cerrado, sin
 * penalizar a nadie: la cancelación no la pidió ningún jugador. Los
 * cerrados manualmente ya tienen needPlayers en false y no los toca esta consulta.
 */
export async function cancelExpiredMatches(): Promise<ActionResult<number>> {
  try {
    const dataSource = await getDataSource();
    const matches = dataSource.getRepository<Match>("Match");
    const bookings = dataSource.getRepository<Booking>("Booking");

    const threshold = new Date(Date.now() + OPEN_MATCH_MIN_HOURS_BEFORE_START * 60 * 60_000);
    const openMatches = await matches.find({
      where: { needPlayers: true },
      relations: { matchPlayers: true, booking: true },
    });

    const toCancel = openMatches.filter((match) => {
      if (match.booking.bookingState === BookingState.CANCELLED) return false;
      if (match.booking.fromDateTime.getTime() > threshold.getTime()) return false;
      const confirmedPlayers = (match.matchPlayers ?? []).reduce(
        (sum, p) => sum + (p.playersCount ?? 1),
        0,
      );
      return confirmedPlayers < OPEN_MATCH_MAX_PLAYERS;
    });

    if (toCancel.length > 0) {
      // Update() por id en vez de save() de las entidades completas: los matches
      // traen precargada la relación matchPlayers, y guardar el objeto entero
      // puede hacer que TypeORM reconcile esa relación y borre filas.
      await bookings.update(
        toCancel.map((match) => match.booking.id),
        { bookingState: BookingState.CANCELLED },
      );
      await matches.update(
        toCancel.map((match) => match.id),
        { needPlayers: false },
      );
    }

    return { success: true, data: toCancel.length };
  } catch (error) {
    console.error("cancelExpiredMatches", error);
    return { success: false, error: CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE };
  }
}
