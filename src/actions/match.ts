"use server";

import "reflect-metadata";
import { Booking } from "@/src/entities/Booking";
import { Match } from "@/src/entities/Match";
import { BookingState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS, OPEN_MATCH_MIN_HOURS_BEFORE_START } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

const NOT_OPEN_MESSAGE = "Este partido ya no está buscando jugadores.";
const INVALID_PLAYERS_TO_CLOSE_MESSAGE = `El cierre manual solo está disponible con entre 1 y ${OPEN_MATCH_MAX_PLAYERS - 1} jugadores confirmados.`;
const CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE = "No se pudieron cancelar los partidos abiertos vencidos.";

class NotOpenError extends Error {}
class InvalidPlayersToCloseError extends Error {}

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
 * Cancelación automática de partidos abiertos que no llegaron a completar el
 * cupo a horas de su inicio: pensada para correr periódicamente desde un
 * proceso en segundo plano (ver src/jobs/open-match-expiration.ts). Cancela el
 * turno asociado para liberar la cancha y marca el partido como cerrado; los
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
