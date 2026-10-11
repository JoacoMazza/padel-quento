import "reflect-metadata";
import type { Booker } from "@/src/entities/Booker";
import type { Booking } from "@/src/entities/Booking";
import type { Match } from "@/src/entities/Match";
import type { Player } from "@/src/entities/Player";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import {
  courtUnavailableNotice,
  matchCancelledByCreatorNotice,
  matchClosedNotice,
  matchExpiredNotice,
  playerJoinedNotice,
  playerLeftLateNotice,
  playerLeftNotice,
  type NoticeBooking,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/src/domain/notifications";
import { getDataSource } from "@/src/lib/db";
import { notify } from "@/src/lib/notifications";

// Los avisos se mandan después de guardar los cambios y nunca deben hacer fallar
// la operación que los originó: cualquier error al armarlos se registra y listo.

const MATCH_PLAYERS_RELATIONS = { matchPlayers: { player: { account: true } } } as const;
const BOOKING_RELATIONS = { court: true, booker: true, match: MATCH_PLAYERS_RELATIONS } as const;

function toRecipient(person: Booker | Player): NotificationRecipient {
  const account = (person as Player).account;
  return { names: person.names, email: account?.email ?? null, phoneNumber: person.phoneNumber };
}

function fullName(person: Booker): string {
  return `${person.names} ${person.lastnames}`;
}

function freeSpots(match: Match): number {
  const taken = match.matchPlayers.reduce((sum, mp) => sum + (mp.playersCount ?? 1), 0);
  return Math.max(OPEN_MATCH_MAX_PLAYERS - taken, 0);
}

function noticeBookingOf(booking: Booking): NoticeBooking {
  return { fromDateTime: booking.fromDateTime, courtNumber: booking.court.number };
}

function allPlayers(match: Match): NotificationRecipient[] {
  return match.matchPlayers.map((mp) => toRecipient(mp.player));
}

/** Jugadores de un partido, salvo el que provocó el cambio. */
function otherPlayers(match: Match, playerId: number): NotificationRecipient[] {
  return match.matchPlayers.filter((mp) => mp.player.id !== playerId).map((mp) => toRecipient(mp.player));
}

async function send(
  recipients: NotificationRecipient[],
  buildMessage: (recipient: NotificationRecipient) => NotificationMessage,
) {
  if (recipients.length > 0) {
    await notify(recipients, buildMessage);
  }
}

async function findBooking(bookingId: number) {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Booking>("Booking").findOne({ where: { id: bookingId }, relations: BOOKING_RELATIONS });
}

/** Avisa a los demás jugadores del partido que alguien se sumó. */
export async function notifyPlayerJoined(bookingId: number, playerId: number): Promise<void> {
  try {
    const booking = await findBooking(bookingId);
    const joined = booking?.match?.matchPlayers.find((mp) => mp.player.id === playerId)?.player;
    if (!booking?.match || !joined) return;

    const spots = freeSpots(booking.match);
    await send(otherPlayers(booking.match, playerId), (recipient) =>
      playerJoinedNotice(recipient.names, fullName(joined), noticeBookingOf(booking), spots),
    );
  } catch (error) {
    console.error("notifyPlayerJoined", error);
  }
}

/**
 * Avisa a los jugadores que quedan en el partido que alguien se bajó. Si se bajó
 * tarde el partido no vuelve a buscar jugadores, así que no se ofrecen lugares.
 */
export async function notifyPlayerLeft(matchId: number, playerId: number, late: boolean): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const match = await dataSource.getRepository<Match>("Match").findOne({
      where: { id: matchId },
      relations: { booking: { court: true }, ...MATCH_PLAYERS_RELATIONS },
    });
    const left = await dataSource.getRepository<Player>("Player").findOne({ where: { id: playerId } });
    if (!match || !left) return;

    const booking = noticeBookingOf(match.booking);
    const spots = freeSpots(match);
    await send(otherPlayers(match, playerId), (recipient) =>
      late
        ? playerLeftLateNotice(recipient.names, fullName(left), booking)
        : playerLeftNotice(recipient.names, fullName(left), booking, spots),
    );
  } catch (error) {
    console.error("notifyPlayerLeft", error);
  }
}

/** Avisa a los demás jugadores que quien armó el partido canceló el turno (HU-19). */
export async function notifyMatchCancelledByCreator(bookingId: number): Promise<void> {
  try {
    const booking = await findBooking(bookingId);
    if (!booking?.match || !booking.booker) return;

    const creator = booking.booker;
    await send(otherPlayers(booking.match, creator.id), (recipient) =>
      matchCancelledByCreatorNotice(recipient.names, fullName(creator), noticeBookingOf(booking)),
    );
  } catch (error) {
    console.error("notifyMatchCancelledByCreator", error);
  }
}

/** Avisa a los demás jugadores que quien armó el partido lo cerró. */
export async function notifyMatchClosed(matchId: number): Promise<void> {
  try {
    const dataSource = await getDataSource();
    const match = await dataSource.getRepository<Match>("Match").findOne({
      where: { id: matchId },
      relations: { booking: { court: true, booker: true }, ...MATCH_PLAYERS_RELATIONS },
    });
    if (!match?.booking.booker) return;

    await send(otherPlayers(match, match.booking.booker.id), (recipient) =>
      matchClosedNotice(recipient.names, noticeBookingOf(match.booking)),
    );
  } catch (error) {
    console.error("notifyMatchClosed", error);
  }
}

/** Avisa a todos los jugadores de cada partido cancelado por no completar el cupo. */
export async function notifyMatchesExpired(bookingIds: number[]): Promise<void> {
  try {
    for (const bookingId of bookingIds) {
      const booking = await findBooking(bookingId);
      if (!booking?.match) continue;

      await send(allPlayers(booking.match), (recipient) =>
        matchExpiredNotice(recipient.names, noticeBookingOf(booking)),
      );
    }
  } catch (error) {
    console.error("notifyMatchesExpired", error);
  }
}

/**
 * Avisa a todos los jugadores de cada turno cancelado porque la cancha no va a
 * estar disponible (bloqueo o baja): los del partido si el turno era un partido
 * abierto, o quien lo reservó si no.
 */
export async function notifyCourtUnavailable(bookingIds: number[]): Promise<void> {
  try {
    const dataSource = await getDataSource();
    for (const bookingId of bookingIds) {
      const booking = await findBooking(bookingId);
      if (!booking) continue;

      let recipients: NotificationRecipient[];
      if (booking.match) {
        recipients = allPlayers(booking.match);
      } else {
        // El booker se carga sin la cuenta; si es un jugador, se busca para tener su correo.
        const player = await dataSource
          .getRepository<Player>("Player")
          .findOne({ where: { id: booking.booker.id }, relations: { account: true } });
        recipients = [toRecipient(player ?? booking.booker)];
      }

      await send(recipients, (recipient) => courtUnavailableNotice(recipient.names, noticeBookingOf(booking)));
    }
  } catch (error) {
    console.error("notifyCourtUnavailable", error);
  }
}
