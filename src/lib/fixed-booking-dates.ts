import "reflect-metadata";
import { In } from "typeorm";
import type { FixedBookingDate } from "@/src/entities/FixedBookingDate";
import { FixedBookingDateState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";

/**
 * De los turnos indicados, los que son una fecha reservada de un turno fijo
 * (HU-41): devuelve, por id de turno, el id de su fecha de turno fijo.
 */
export async function findFixedBookingDates(bookingIds: number[]): Promise<Map<number, number>> {
  if (bookingIds.length === 0) return new Map();

  const dataSource = await getDataSource();
  const dates = await dataSource.getRepository<FixedBookingDate>("FixedBookingDate").find({
    where: { booking: { id: In(bookingIds) }, state: FixedBookingDateState.BOOKED },
    relations: { booking: true },
  });
  return new Map(dates.map((date) => [date.booking!.id, date.id]));
}
