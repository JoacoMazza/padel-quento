"use server";

import "reflect-metadata";
import { Brackets, IsNull, Not } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { ClassStudent } from "@/src/entities/ClassStudent";
import type { Player } from "@/src/entities/Player";
import { BookingState } from "@/src/domain/enums";
import { FINISHED_CLASSES_DAYS, MAX_CLASS_CAPACITY, MIN_CLASS_CAPACITY } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { ForbiddenError, UnauthorizedError, requireTeacher } from "@/src/lib/rbac";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_LIMIT = 10;

export type CreateClassBookingInput = { courtId: number; fromDateTime: Date; classCapacity: number };

/** Jugador como lo ve el profesor al buscar o listar alumnos: nombre y email. */
export type StudentItem = { id: number; names: string; lastnames: string; email: string };

/** Alumno en el listado del profesor (HU-45): contacto, clases que ya tuvo con él y la última. */
export type TeacherStudentItem = StudentItem & {
  phoneNumber: string;
  classesCount: number;
  lastClassAt: Date | null;
};

/** Turno de clase del profesor con sus alumnos. */
export type TeacherClassItem = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  courtNumber: number;
  classCapacity: number;
  /** Ya terminó (la agenda la muestra como "Finalizado"). */
  isFinished: boolean;
  students: StudentItem[];
};

const CLASS_NOT_FOUND = "La clase no existe.";

class ClassActionError extends Error {}

/** Errores de permisos y de reglas de la clase: se muestran tal cual. */
function knownErrorMessage(error: unknown): string | null {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError || error instanceof ClassActionError
    ? error.message
    : null;
}

function toStudent(player: Player): StudentItem {
  return { id: player.id, names: player.names, lastnames: player.lastnames, email: player.account.email };
}

/**
 * Reserva un turno de clase (HU-43) a nombre del profesor de la sesión, con
 * las mismas reglas de disponibilidad que cualquier reserva y al precio de la
 * cancha. Queda marcado como clase con su cupo de alumnos (de 1 a 8).
 */
export async function createClassBooking(input: CreateClassBookingInput): Promise<ActionResult<Booking>> {
  try {
    const { playerId } = await requireTeacher();
    if (
      !Number.isInteger(input.classCapacity) ||
      input.classCapacity < MIN_CLASS_CAPACITY ||
      input.classCapacity > MAX_CLASS_CAPACITY
    ) {
      return {
        success: false,
        error: `El cupo de la clase tiene que ser de ${MIN_CLASS_CAPACITY} a ${MAX_CLASS_CAPACITY} alumnos.`,
      };
    }
    return createBookingForPlayer({
      fromDateTime: input.fromDateTime,
      courtId: input.courtId,
      bookerId: playerId,
      classCapacity: input.classCapacity,
    });
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("createClassBooking", error);
    return { success: false, error: "No se pudo reservar el turno de clase." };
  }
}

/**
 * Agenda del profesor (HU-46): sus turnos de clase por fecha, con sus alumnos.
 * Trae los que todavía no terminaron y los que terminaron en los últimos
 * FINISHED_CLASSES_DAYS días, marcados como finalizados. Sin los cancelados.
 */
export async function getTeacherClasses(): Promise<ActionResult<TeacherClassItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    const dataSource = await getDataSource();
    const now = new Date();
    const classes = await dataSource
      .createQueryBuilder<Booking>("Booking", "booking")
      .leftJoinAndSelect("booking.court", "court")
      .leftJoinAndSelect("booking.classStudents", "student")
      .leftJoinAndSelect("student.player", "player")
      .leftJoinAndSelect("player.account", "account")
      .leftJoin("booking.booker", "booker")
      .where("booker.id = :playerId", { playerId })
      .andWhere('booking."class_capacity" IS NOT NULL')
      .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
      .andWhere('booking."datetime" + make_interval(mins => booking."duration_minutes") > :since', {
        since: new Date(now.getTime() - FINISHED_CLASSES_DAYS * 24 * 60 * 60_000),
      })
      .orderBy('booking."datetime"', "ASC")
      .addOrderBy("student.id", "ASC")
      .getMany();

    const data: TeacherClassItem[] = classes.map((booking) => ({
      id: booking.id,
      fromDateTime: booking.fromDateTime,
      durationMinutes: booking.durationMinutes,
      courtNumber: booking.court.number,
      classCapacity: booking.classCapacity!,
      isFinished: new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000 <= now.getTime(),
      students: booking.classStudents.map((student) => toStudent(student.player)),
    }));
    return { success: true, data: toPlain(data) };
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("getTeacherClasses", error);
    return { success: false, error: "No se pudieron obtener tus clases." };
  }
}

/**
 * Alumnos que el profesor registró alguna vez (HU-45), sin contar las clases
 * canceladas: su contacto, cuántas clases ya terminadas tuvo con él y la fecha
 * de la última. Ordenados por nombre.
 */
export async function getTeacherStudents(): Promise<ActionResult<TeacherStudentItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    const dataSource = await getDataSource();
    const end = 'booking."datetime" + make_interval(mins => booking."duration_minutes")';
    const rows = await dataSource
      .createQueryBuilder<ClassStudent>("ClassStudent", "student")
      .innerJoin("student.booking", "booking")
      .innerJoin("booking.booker", "booker")
      .innerJoin("student.player", "player")
      .innerJoin("player.account", "account")
      .select("player.id", "id")
      .addSelect("player.names", "names")
      .addSelect("player.lastnames", "lastnames")
      .addSelect("account.email", "email")
      .addSelect("player.phoneNumber", "phoneNumber")
      .addSelect(`COUNT(*) FILTER (WHERE ${end} <= :now)`, "classesCount")
      .addSelect(`MAX(booking."datetime") FILTER (WHERE ${end} <= :now)`, "lastClassAt")
      .where("booker.id = :playerId", { playerId })
      .andWhere('booking."class_capacity" IS NOT NULL')
      .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
      .setParameter("now", new Date())
      .groupBy("player.id")
      .addGroupBy("account.email")
      .orderBy("player.names", "ASC")
      .addOrderBy("player.lastnames", "ASC")
      .getRawMany<{
        id: number;
        names: string;
        lastnames: string;
        email: string;
        phoneNumber: string;
        classesCount: string;
        lastClassAt: Date | null;
      }>();

    const data: TeacherStudentItem[] = rows.map((row) => ({
      id: row.id,
      names: row.names,
      lastnames: row.lastnames,
      email: row.email,
      phoneNumber: row.phoneNumber,
      classesCount: Number(row.classesCount),
      lastClassAt: row.lastClassAt ? new Date(row.lastClassAt) : null,
    }));
    return { success: true, data: toPlain(data) };
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("getTeacherStudents", error);
    return { success: false, error: "No se pudieron obtener tus alumnos." };
  }
}

/** Busca jugadores registrados por nombre, apellido o email para sumarlos a una clase (sin el propio profesor). */
export async function searchStudents(term: string): Promise<ActionResult<StudentItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    const text = term.trim();
    if (text.length < MIN_SEARCH_LENGTH) {
      return { success: true, data: [] };
    }

    const dataSource = await getDataSource();
    const like = `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
    const players = await dataSource
      .createQueryBuilder<Player>("Player", "player")
      .innerJoinAndSelect("player.account", "account")
      .where("player.id != :playerId", { playerId })
      .andWhere(
        new Brackets((qb) =>
          qb
            .where("player.names ILIKE :like", { like })
            .orWhere("player.lastnames ILIKE :like", { like })
            .orWhere("account.email ILIKE :like", { like })
            .orWhere("(player.names || ' ' || player.lastnames) ILIKE :like", { like }),
        ),
      )
      .orderBy("player.names", "ASC")
      .addOrderBy("player.lastnames", "ASC")
      .limit(SEARCH_LIMIT)
      .getMany();
    return { success: true, data: players.map(toStudent) };
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("searchStudents", error);
    return { success: false, error: "No se pudieron buscar jugadores." };
  }
}

/**
 * Clase del profesor que se puede editar: suya, no cancelada y que todavía no
 * empezó. Cualquier otro turno se trata como inexistente.
 */
async function findEditableClass(bookingId: number, teacherPlayerId: number): Promise<Booking> {
  const dataSource = await getDataSource();
  const booking = await dataSource.getRepository<Booking>("Booking").findOne({
    where: { id: bookingId, booker: { id: teacherPlayerId }, classCapacity: Not(IsNull()) },
    relations: { classStudents: { player: true } },
  });
  if (!booking) throw new ClassActionError(CLASS_NOT_FOUND);
  if (booking.bookingState === BookingState.CANCELLED) throw new ClassActionError("La clase fue cancelada.");
  if (new Date(booking.fromDateTime).getTime() <= Date.now()) {
    throw new ClassActionError("La clase ya empezó: no se pueden cambiar los alumnos.");
  }
  return booking;
}

/** Registra a un jugador como alumno de una clase del profesor (HU-44), hasta el cupo. */
export async function addClassStudent(bookingId: number, studentId: number): Promise<ActionResult<null>> {
  try {
    const { playerId } = await requireTeacher();
    const dataSource = await getDataSource();
    // Serializa los cambios de alumnos de la misma clase para que el cupo no se pase.
    await dataSource.transaction(async (manager) => {
      await manager.query("SELECT pg_advisory_xact_lock(43, $1)", [bookingId]);
      const booking = await findEditableClass(bookingId, playerId);
      if (studentId === playerId) {
        throw new ClassActionError("No podés registrarte como alumno de tu propia clase.");
      }
      const student = await manager.getRepository<Player>("Player").findOne({ where: { id: studentId } });
      if (!student) throw new ClassActionError("El alumno no existe.");
      if (booking.classStudents.some((s) => s.player.id === studentId)) {
        throw new ClassActionError("Ese alumno ya está registrado en la clase.");
      }
      if (booking.classStudents.length >= booking.classCapacity!) {
        throw new ClassActionError("La clase ya está completa.");
      }
      const students = manager.getRepository<ClassStudent>("ClassStudent");
      await students.save(students.create({ booking: { id: bookingId }, player: { id: studentId } }));
    });
    return { success: true, data: null };
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("addClassStudent", error);
    return { success: false, error: "No se pudo registrar al alumno." };
  }
}

/** Quita a un alumno de una clase del profesor, mientras no haya empezado (HU-44). */
export async function removeClassStudent(bookingId: number, studentId: number): Promise<ActionResult<null>> {
  try {
    const { playerId } = await requireTeacher();
    await findEditableClass(bookingId, playerId);
    const dataSource = await getDataSource();
    await dataSource
      .getRepository<ClassStudent>("ClassStudent")
      .delete({ booking: { id: bookingId }, player: { id: studentId } });
    return { success: true, data: null };
  } catch (error) {
    const known = knownErrorMessage(error);
    if (known) return { success: false, error: known };
    console.error("removeClassStudent", error);
    return { success: false, error: "No se pudo quitar al alumno." };
  }
}
