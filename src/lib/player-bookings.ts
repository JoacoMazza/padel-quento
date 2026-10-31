import "reflect-metadata";
import { In } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import { BookingState } from "@/src/domain/enums";
import { MY_BOOKINGS_PAST_LIMIT, REVIEW_WINDOW_HOURS } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";

const BOOKING_RELATIONS = {
  booker: true,
  court: { complex: true },
  classStudents: { player: true },
  match: { matchPlayers: { player: true }, chat: true },
} as const;

/**
 * Turnos del jugador para Mis turnos: los que reservó, los partidos de otros a
 * los que se sumó y las clases en las que un profesor lo registró (HU-47).
 * Trae todos los próximos (o en curso), los últimos MY_BOOKINGS_PAST_LIMIT que
 * ya terminaron y, aunque no estén entre esos, los partidos que todavía puede
 * calificar (issue #77: no cancelados, asistió y terminaron hace menos de
 * REVIEW_WINDOW_HOURS). Sin cargar los turnos del resto del club.
 */
export async function getPlayerBookings(playerId: number, now: Date = new Date()): Promise<Booking[]> {
  const dataSource = await getDataSource();
  const mine = () =>
    dataSource
      .createQueryBuilder<Booking>("Booking", "booking")
      .select("booking.id", "id")
      .leftJoin("booking.booker", "booker")
      .where(
        `(booker.id = :playerId OR EXISTS (
          SELECT 1 FROM "match_players" "mp" INNER JOIN "matches" "m" ON "m"."id" = "mp"."match_id"
          WHERE "m"."booking_id" = booking.id AND "mp"."player_id" = :playerId
        ) OR EXISTS (
          SELECT 1 FROM "class_students" "cs" WHERE "cs"."booking_id" = booking.id AND "cs"."player_id" = :playerId
        ))`,
        { playerId },
      );
  const end = 'booking."datetime" + make_interval(mins => booking."duration_minutes")';
  const reviewWindowStart = new Date(now.getTime() - REVIEW_WINDOW_HOURS * 60 * 60_000);

  const [upcoming, past, reviewable] = await Promise.all([
    mine().andWhere(`${end} >= :now`, { now }).getRawMany<{ id: number }>(),
    mine()
      .andWhere(`${end} < :now`, { now })
      .orderBy('booking."datetime"', "DESC")
      .limit(MY_BOOKINGS_PAST_LIMIT)
      .getRawMany<{ id: number }>(),
    // Si se puede calificar o no lo termina de decidir canReviewMatch (también exige
    // que haya asistido algún compañero); acá solo se trae lo que podría serlo.
    mine()
      .andWhere(`${end} < :now`, { now })
      .andWhere(`${end} >= :reviewWindowStart`, { reviewWindowStart })
      .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
      .andWhere(
        `EXISTS (
          SELECT 1 FROM "match_players" "rmp" INNER JOIN "matches" "rm" ON "rm"."id" = "rmp"."match_id"
          WHERE "rm"."booking_id" = booking.id AND "rmp"."player_id" = :playerId AND "rmp"."attended" = true
        )`,
        { playerId },
      )
      .getRawMany<{ id: number }>(),
  ]);

  const ids = [...new Set([...upcoming, ...past, ...reviewable].map((row) => row.id))];
  if (ids.length === 0) return [];
  return dataSource.getRepository<Booking>("Booking").find({ where: { id: In(ids) }, relations: BOOKING_RELATIONS });
}
