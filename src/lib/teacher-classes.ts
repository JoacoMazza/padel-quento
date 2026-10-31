import "reflect-metadata";
import { In, IsNull, MoreThan, Not } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";

/**
 * Cancela las clases futuras de un profesor (al desactivarlo o quitarle el rol,
 * HU-42) y devuelve sus ids para avisar a los alumnos. Solo para el servidor:
 * la usan las acciones del administrador.
 */
export async function cancelFutureClassesOf(teacherPlayerId: number): Promise<number[]> {
  const dataSource = await getDataSource();
  const bookings = dataSource.getRepository<Booking>("Booking");
  const future = await bookings.find({
    select: { id: true },
    where: {
      booker: { id: teacherPlayerId },
      classCapacity: Not(IsNull()),
      bookingState: Not(BookingState.CANCELLED),
      fromDateTime: MoreThan(new Date()),
    },
  });
  const ids = future.map((booking) => booking.id);
  if (ids.length > 0) {
    await bookings.update({ id: In(ids) }, { bookingState: BookingState.CANCELLED });
  }
  return ids;
}
