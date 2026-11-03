import "reflect-metadata";
import { In, IsNull, MoreThan, Not } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { TeacherClassItem } from "@/src/actions/teacherClass";
import { BookingState } from "@/src/domain/enums";
import { FINISHED_CLASSES_DAYS } from "@/src/domain/constants";
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

/**
 * Agenda de clases de un profesor (HU-46, y la ve el admin en HU-48): sus
 * turnos de clase por fecha, con sus alumnos. Trae los que todavía no
 * terminaron y los que terminaron en los últimos FINISHED_CLASSES_DAYS días,
 * marcados como finalizados. Sin los cancelados.
 */
export async function findAgendaOf(teacherPlayerId: number, now: Date = new Date()): Promise<TeacherClassItem[]> {
  const dataSource = await getDataSource();
  const classes = await dataSource
    .createQueryBuilder<Booking>("Booking", "booking")
    .leftJoinAndSelect("booking.court", "court")
    .leftJoinAndSelect("booking.classStudents", "student")
    .leftJoinAndSelect("student.player", "player")
    .leftJoinAndSelect("player.account", "account")
    .leftJoin("booking.booker", "booker")
    .where("booker.id = :playerId", { playerId: teacherPlayerId })
    .andWhere('booking."class_capacity" IS NOT NULL')
    .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
    .andWhere('booking."datetime" + make_interval(mins => booking."duration_minutes") > :since', {
      since: new Date(now.getTime() - FINISHED_CLASSES_DAYS * 24 * 60 * 60_000),
    })
    .orderBy('booking."datetime"', "ASC")
    .addOrderBy("student.id", "ASC")
    .getMany();

  return classes.map((booking) => ({
    id: booking.id,
    fromDateTime: booking.fromDateTime,
    durationMinutes: booking.durationMinutes,
    courtNumber: booking.court.number,
    classCapacity: booking.classCapacity!,
    isFinished: new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000 <= now.getTime(),
    students: booking.classStudents.map((student) => ({
      id: student.player.id,
      names: student.player.names,
      lastnames: student.player.lastnames,
      email: student.player.account.email,
    })),
  }));
}
