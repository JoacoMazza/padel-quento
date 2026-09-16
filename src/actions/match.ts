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
      const matches = manager.getRepository(Match);
      const match = await matches.findOne({
        where: { id: matchId },
        relations: { players: true },
      });
      if (!match) {
        throw new Error("NOT_FOUND");
      }
      if (!match.needPlayers) {
        throw new NotOpenError();
      }

      const confirmedPlayers = (match.players ?? []).reduce(
        (sum, p) => sum + (p.playersCount ?? 1),
        0,
      );
      if (confirmedPlayers < 1 || confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS) {
        throw new InvalidPlayersToCloseError();
      }

      match.needPlayers = false;
      return matches.save(match);
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
      relations: { players: true, booking: true },
    });

    const toCancel = openMatches.filter((match) => {
      if (match.booking.bookingState === BookingState.CANCELLED) return false;
      if (match.booking.fromDateTime.getTime() > threshold.getTime()) return false;
      const confirmedPlayers = (match.players ?? []).reduce((sum, p) => sum + (p.playersCount ?? 1), 0);
      return confirmedPlayers < OPEN_MATCH_MAX_PLAYERS;
    });

    for (const match of toCancel) {
      match.booking.bookingState = BookingState.CANCELLED;
      match.needPlayers = false;
    }
    if (toCancel.length > 0) {
      await bookings.save(toCancel.map((match) => match.booking));
      await matches.save(toCancel);
    }

    return { success: true, data: toCancel.length };
  } catch (error) {
    console.error("cancelExpiredMatches", error);
    return { success: false, error: CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE };
  }
}
