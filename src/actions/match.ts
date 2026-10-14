"use server";

import "reflect-metadata";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/src/lib/auth";
import { Booking } from "@/src/entities/Booking";
import { Chat } from "@/src/entities/Chat";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { Player } from "@/src/entities/Player";
import { BookingState, type PlayerCategory } from "@/src/domain/enums";
import {
  JOIN_MATCH_LOCK_CLASS,
  OPEN_MATCH_MAX_PLAYERS,
  OPEN_MATCH_MIN_HOURS_BEFORE_START,
  PENALTY_POINTS,
} from "@/src/domain/constants";
import { LATE_LEAVE_REASON, isLateCancellation } from "@/src/domain/late-cancellation";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import {
  notifyMatchClosed,
  notifyMatchesExpired,
  notifyPlayerJoined,
  notifyPlayerLeft,
} from "@/src/lib/match-notifications";
import { recordPointsMovement } from "@/src/actions/profile";

const NOT_OPEN_MESSAGE = "Este partido ya no está buscando jugadores.";
const INVALID_PLAYERS_TO_CLOSE_MESSAGE = `El cierre manual solo está disponible con entre 1 y ${OPEN_MATCH_MAX_PLAYERS - 1} jugadores confirmados.`;
const CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE = "No se pudieron cancelar los partidos abiertos vencidos.";
const NOT_A_MATCH_PLAYER_MESSAGE = "No formás parte de este partido.";
const CREATOR_CANNOT_LEAVE_MESSAGE = "Creaste este partido: para darte de baja tenés que cancelar el turno.";
const BOOKING_ALREADY_CANCELLED_MESSAGE = "El turno ya fue cancelado.";
const NOT_AUTHENTICATED_MESSAGE = "No estás autenticado.";
const EMPTY_IDENTIFIER_MESSAGE = "Ingresá el email o el teléfono del jugador.";
const BLOCKED_INVITER_MESSAGE = "El usuario se encuentra bloqueado y no puede sumar jugadores.";
const NOT_AN_OPEN_MATCH_MESSAGE = "Este turno no es un partido abierto.";
const MATCH_NOT_ACCEPTING_PLAYERS_MESSAGE = "El partido ya no admite jugadores: el turno fue cancelado o ya empezó.";
const PLAYER_NOT_FOUND_MESSAGE = "No encontramos un jugador registrado con ese email o teléfono.";
const BLOCKED_TARGET_MESSAGE = "Ese jugador se encuentra bloqueado y no puede sumarse a partidos.";
const ALREADY_IN_MATCH_MESSAGE = "Ese jugador ya forma parte del partido.";
const NO_SPOTS_MESSAGE = "No quedan lugares libres en el partido.";

class NotOpenError extends Error {}
class InvalidPlayersToCloseError extends Error {}
class NotAMatchPlayerError extends Error {}
class CreatorCannotLeaveError extends Error {}
class BookingAlreadyCancelledError extends Error {}
class AlreadyInMatchError extends Error {}
class NoSpotsError extends Error {}

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

    await notifyMatchClosed(matchId);

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
        relations: { match: { booking: { booker: true } } },
      });
      if (!matchPlayer) {
        throw new NotAMatchPlayerError();
      }

      const booking = matchPlayer.match.booking;
      // Player hereda de Booker: quien creó el partido es el booker con ese mismo id.
      if (booking.booker?.id === playerId) {
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

    await notifyPlayerLeft(matchId, playerId, late);

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

      await notifyMatchesExpired(toCancel.map((match) => match.booking.id));
    }

    return { success: true, data: toCancel.length };
  } catch (error) {
    console.error("cancelExpiredMatches", error);
    return { success: false, error: CANCEL_EXPIRED_MATCHES_ERROR_MESSAGE };
  }
}

/** Lo único que se devuelve del jugador agregado: nunca su email ni su teléfono. */
export type AddedPlayer = {
  id: number;
  names: string;
  lastnames: string;
  category: PlayerCategory;
};

/**
 * Un miembro de un partido abierto agrega a un jugador ya registrado, buscándolo
 * por email o teléfono exactos (así no se expone la lista de jugadores) (HU-40).
 * Quien agrega sale de la sesión y debe formar parte del partido; se verifica
 * antes de buscar al jugador, para que nadie ajeno pueda averiguar qué emails o
 * teléfonos están registrados. Si quien agrega se había anotado con acompañantes
 * sin cuenta, el agregado pasa a ocupar el lugar de uno de ellos (el total no
 * cambia); si no, ocupa un lugar libre. No depende de la sala de chat: se puede
 * usar desde que se crea el partido.
 */
export async function addPlayerToMatch(
  bookingId: number,
  identifier: string,
): Promise<ActionResult<AddedPlayer>> {
  try {
    const trimmed = typeof identifier === "string" ? identifier.trim() : "";
    if (trimmed.length === 0) {
      return { success: false, error: EMPTY_IDENTIFIER_MESSAGE };
    }

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return { success: false, error: NOT_AUTHENTICATED_MESSAGE };
    }

    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const inviter = await players.findOne({
      where: { account: { email: session.user.email } },
      relations: { account: true },
    });
    if (!inviter) {
      return { success: false, error: NOT_A_MATCH_PLAYER_MESSAGE };
    }
    if (inviter.account.isBlocked) {
      return { success: false, error: BLOCKED_INVITER_MESSAGE };
    }

    const booking = await dataSource
      .getRepository<Booking>("Booking")
      .findOne({ where: { id: bookingId }, relations: { match: { matchPlayers: true } } });
    if (!booking?.match) {
      return { success: false, error: NOT_AN_OPEN_MATCH_MESSAGE };
    }
    if (!booking.match.matchPlayers.some((mp) => mp.playerId === inviter.id)) {
      return { success: false, error: NOT_A_MATCH_PLAYER_MESSAGE };
    }
    if (booking.bookingState === BookingState.CANCELLED || booking.fromDateTime.getTime() <= Date.now()) {
      return { success: false, error: MATCH_NOT_ACCEPTING_PLAYERS_MESSAGE };
    }

    // Mismo formato con el que se guardan al registrarse (ver register-validation).
    const target = await players.findOne({
      where: trimmed.includes("@")
        ? { account: { email: trimmed.toLowerCase() } }
        : { phoneNumber: trimmed.replace(/[\s()-]/g, "") },
      relations: { account: true },
    });
    if (!target) {
      return { success: false, error: PLAYER_NOT_FOUND_MESSAGE };
    }
    if (target.account.isBlocked) {
      return { success: false, error: BLOCKED_TARGET_MESSAGE };
    }

    const matchId = booking.match.id;
    await dataSource.transaction(async (manager) => {
      // Mismo lock que joinOpenMatch: serializa las altas en este partido.
      await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [JOIN_MATCH_LOCK_CLASS, bookingId]);

      const matches = manager.getRepository<Match>("Match");
      const match = await matches.findOne({ where: { id: matchId }, relations: { matchPlayers: true, chat: true } });
      if (!match) {
        throw new NoSpotsError();
      }
      if (match.matchPlayers.some((mp) => mp.playerId === target.id)) {
        throw new AlreadyInMatchError();
      }

      const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
      const inviterParticipation = match.matchPlayers.find((mp) => mp.playerId === inviter.id);
      if (inviterParticipation && inviterParticipation.playersCount > 1) {
        await matchPlayers.update(inviterParticipation.id, {
          playersCount: inviterParticipation.playersCount - 1,
        });
      } else {
        const confirmedPlayers = match.matchPlayers.reduce((sum, mp) => sum + (mp.playersCount ?? 1), 0);
        if (!match.needPlayers || confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS) {
          throw new NoSpotsError();
        }
        // Update() en vez de save(match), igual que en joinOpenMatch: guardar el
        // match con su array matchPlayers precargado podría borrar filas.
        if (confirmedPlayers + 1 >= OPEN_MATCH_MAX_PLAYERS) {
          await matches.update(match.id, { needPlayers: false });
        }
      }

      await matchPlayers.save(
        matchPlayers.create({ match: { id: match.id }, player: { id: target.id }, playersCount: 1 }),
      );

      // Misma regla que joinOpenMatch: la sala de chat se crea cuando el partido
      // pasa a tener un segundo jugador con cuenta propia, si todavía no la tiene.
      if (!match.chat) {
        const chats = manager.getRepository<Chat>("Chat");
        await chats.save(chats.create({ match: { id: match.id } }));
      }
    });

    // Fuera de la transacción, igual que en joinOpenMatch: solo se avisa si el alta se guardó.
    await notifyPlayerJoined(bookingId, target.id);

    const added: AddedPlayer = {
      id: target.id,
      names: target.names,
      lastnames: target.lastnames,
      category: target.category,
    };
    return { success: true, data: toPlain(added) };
  } catch (error) {
    if (error instanceof AlreadyInMatchError) {
      return { success: false, error: ALREADY_IN_MATCH_MESSAGE };
    }
    if (error instanceof NoSpotsError) {
      return { success: false, error: NO_SPOTS_MESSAGE };
    }
    console.error("addPlayerToMatch", error);
    return { success: false, error: "No se pudo agregar al jugador." };
  }
}
