import "reflect-metadata";
import { In } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import { MY_BOOKINGS_PAST_LIMIT } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";

const BOOKING_RELATIONS = {
  booker: true,
  court: true,
  match: { matchPlayers: { player: true }, chat: true },
} as const;

/**
 * Turnos del jugador para Mis turnos: los que reservó y los partidos de otros a
 * los que se sumó. Trae todos los próximos (o en curso) y solo los últimos
 * MY_BOOKINGS_PAST_LIMIT que ya terminaron, sin cargar los turnos del resto del club.
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
        ))`,
        { playerId },
      );
  const end = 'booking."datetime" + make_interval(mins => booking."duration_minutes")';

  const [upcoming, past] = await Promise.all([
    mine().andWhere(`${end} >= :now`, { now }).getRawMany<{ id: number }>(),
    mine()
      .andWhere(`${end} < :now`, { now })
      .orderBy('booking."datetime"', "DESC")
      .limit(MY_BOOKINGS_PAST_LIMIT)
      .getRawMany<{ id: number }>(),
  ]);

  const ids = [...upcoming, ...past].map((row) => row.id);
  if (ids.length === 0) return [];
  return dataSource.getRepository<Booking>("Booking").find({ where: { id: In(ids) }, relations: BOOKING_RELATIONS });
}
