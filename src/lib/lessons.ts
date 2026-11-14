/**
 * Lógica compartida de las clases (lessons): inscripciones, agenda de turnos y
 * baja de turnos futuros. Recibe los ids ya verificados, así que solo se usa
 * desde el servidor: las Server Actions de src/actions/lesson.ts y
 * src/actions/teacherClass.ts verifican antes quién llama.
 */
import "reflect-metadata";
import { In, IsNull, MoreThan, Not, Or } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Inscription } from "@/src/entities/Inscription";
import type { Lesson } from "@/src/entities/Lesson";
import type { Player } from "@/src/entities/Player";
import { BookingState, DayOfWeek } from "@/src/domain/enums";
import { FINISHED_CLASSES_DAYS } from "@/src/domain/constants";
import { todayISO } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";

/** Error de una regla de la clase: su mensaje se muestra tal cual. */
export class LessonRuleError extends Error {}

export const LESSON_NOT_FOUND_MESSAGE = "La clase no existe.";

/**
 * Clave del advisory lock (pg_advisory_xact_lock(clase, lessonId)) que serializa
 * las inscripciones de una misma clase para no pasarse del cupo.
 */
const LESSON_LOCK_CLASS = 43;

/** Jugador como se lo muestra en una clase: nombre y email. */
export type StudentItem = { id: number; names: string; lastnames: string; email: string };

export type LessonScheduleItem = {
  courtId: number;
  courtNumber: number;
  dayOfWeek: DayOfWeek;
  /** "HH:MM" */
  startTime: string;
  endTime: string;
};

/** Clase con su profesor, sus horarios y sus alumnos inscriptos. */
export type LessonItem = {
  id: number;
  teacherId: number;
  teacherName: string;
  classCapacity: number;
  price: number;
  /** Primera y última fecha ("YYYY-MM-DD"); null si no tiene fecha de fin. */
  fromDate: string;
  toDate: string | null;
  isActive: boolean;
  schedules: LessonScheduleItem[];
  students: StudentItem[];
};

/** Turno de una clase, como lo muestra la agenda: con los alumnos de la clase. */
export type TeacherClassItem = {
  id: number;
  lessonId: number;
  fromDateTime: Date;
  durationMinutes: number;
  courtNumber: number;
  classCapacity: number;
  /** Ya terminó (la agenda la muestra como "Finalizado"). */
  isFinished: boolean;
  students: StudentItem[];
};

/** Condición sobre toLocalDatetime de una clase que todavía no terminó: sin fecha de fin o con el fin por delante. */
export function notFinishedYet(now = new Date()) {
  return Or(IsNull(), MoreThan(now));
}

export const LESSON_RELATIONS = {
  teacher: true,
  schedules: { court: true },
  inscriptions: { player: { account: true } },
} as const;

const DAY_ORDER = [
  DayOfWeek.MONDAY,
  DayOfWeek.TUESDAY,
  DayOfWeek.WEDNESDAY,
  DayOfWeek.THURSDAY,
  DayOfWeek.FRIDAY,
  DayOfWeek.SATURDAY,
  DayOfWeek.SUNDAY,
];

export function toStudent(player: Player): StudentItem {
  return { id: player.id, names: player.names, lastnames: player.lastnames, email: player.account.email };
}

/** Alumnos de la clase, en el orden en que se inscribieron. */
function studentsOf(lesson: Lesson): StudentItem[] {
  return [...(lesson.inscriptions ?? [])].sort((a, b) => a.id - b.id).map((inscription) => toStudent(inscription.player));
}

export function toLessonItem(lesson: Lesson): LessonItem {
  return {
    id: lesson.id,
    teacherId: lesson.teacher.id,
    teacherName: `${lesson.teacher.names} ${lesson.teacher.lastnames}`,
    classCapacity: lesson.classCapacity,
    price: lesson.price,
    fromDate: todayISO(new Date(lesson.fromLocalDatetime)),
    toDate: lesson.toLocalDatetime ? todayISO(new Date(lesson.toLocalDatetime)) : null,
    isActive: lesson.isActive,
    schedules: [...(lesson.schedules ?? [])]
      .sort(
        (a, b) =>
          DAY_ORDER.indexOf(a.dayOfWeek) - DAY_ORDER.indexOf(b.dayOfWeek) || a.startTime.localeCompare(b.startTime),
      )
      .map((schedule) => ({
        courtId: schedule.court.id,
        courtNumber: schedule.court.number,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime.slice(0, 5),
        endTime: schedule.endTime.slice(0, 5),
      })),
    students: studentsOf(lesson),
  };
}

/** Clase con sus horarios y alumnos, o null si no existe. */
export async function findLesson(id: number, where: { teacherId?: number } = {}): Promise<Lesson | null> {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Lesson>("Lesson").findOne({
    where: { id, ...(where.teacherId !== undefined ? { teacher: { id: where.teacherId } } : {}) },
    relations: LESSON_RELATIONS,
  });
}

/**
 * Inscribe a un jugador en una clase activa que todavía no terminó, hasta el
 * cupo. El profesor no puede ser alumno de su propia clase.
 */
export async function enrollStudent(lessonId: number, playerId: number, now: Date = new Date()): Promise<void> {
  const dataSource = await getDataSource();
  await dataSource.transaction(async (manager) => {
    await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [LESSON_LOCK_CLASS, lessonId]);
    const lesson = await manager.getRepository<Lesson>("Lesson").findOne({
      where: { id: lessonId },
      relations: { teacher: true, inscriptions: { player: true } },
    });
    if (!lesson) throw new LessonRuleError(LESSON_NOT_FOUND_MESSAGE);
    if (!lesson.isActive) throw new LessonRuleError("La clase fue dada de baja.");
    if (lesson.toLocalDatetime && new Date(lesson.toLocalDatetime).getTime() <= now.getTime()) {
      throw new LessonRuleError("La clase ya terminó.");
    }

    const student = await manager.getRepository<Player>("Player").findOne({ where: { id: playerId } });
    if (!student) throw new LessonRuleError("El alumno no existe.");
    if (lesson.teacher.id === playerId) {
      throw new LessonRuleError("El profesor no puede ser alumno de su propia clase.");
    }
    if (lesson.inscriptions.some((inscription) => inscription.player.id === playerId)) {
      throw new LessonRuleError("Ya está inscripto en la clase.");
    }
    if (lesson.inscriptions.length >= lesson.classCapacity) throw new LessonRuleError("La clase ya está completa.");

    const inscriptions = manager.getRepository<Inscription>("Inscription");
    await inscriptions.save(inscriptions.create({ lesson: { id: lessonId }, player: { id: playerId } }));
  });
}

/** Da de baja a un alumno de una clase; `notEnrolledMessage` si no estaba inscripto. */
export async function unenrollStudent(lessonId: number, playerId: number, notEnrolledMessage: string): Promise<void> {
  const dataSource = await getDataSource();
  const inscriptions = dataSource.getRepository<Inscription>("Inscription");
  const inscription = await inscriptions.findOne({ where: { lesson: { id: lessonId }, player: { id: playerId } } });
  if (!inscription) throw new LessonRuleError(notEnrolledMessage);
  await inscriptions.delete(inscription.id);
}

/** Cancela los turnos todavía no empezados de una clase y devuelve sus ids. */
export async function cancelFutureSessionsOf(lessonId: number, now: Date = new Date()): Promise<number[]> {
  const dataSource = await getDataSource();
  const bookings = dataSource.getRepository<Booking>("Booking");
  const future = await bookings.find({
    select: { id: true },
    where: {
      lesson: { id: lessonId },
      bookingState: Not(BookingState.CANCELLED),
      fromDateTime: MoreThan(now),
    },
  });
  const ids = future.map((booking) => booking.id);
  if (ids.length > 0) {
    await bookings.update({ id: In(ids) }, { bookingState: BookingState.CANCELLED });
  }
  return ids;
}

/**
 * Agenda de turnos de clase (HU-46, y la ve el admin en HU-48): los de una
 * clase o los de todas las clases de un profesor, por fecha, con los alumnos de
 * la clase. Trae los que todavía no terminaron y los que terminaron en los
 * últimos FINISHED_CLASSES_DAYS días, marcados como finalizados. Sin los cancelados.
 */
export async function findAgenda(
  of: { lessonId: number } | { teacherId: number },
  now: Date = new Date(),
): Promise<TeacherClassItem[]> {
  const dataSource = await getDataSource();
  const query = dataSource
    .createQueryBuilder<Booking>("Booking", "booking")
    .innerJoinAndSelect("booking.lesson", "lesson")
    .innerJoin("lesson.teacher", "teacher")
    .leftJoinAndSelect("booking.court", "court")
    .leftJoinAndSelect("lesson.inscriptions", "inscription")
    .leftJoinAndSelect("inscription.player", "player")
    .leftJoinAndSelect("player.account", "account");
  if ("lessonId" in of) query.where("lesson.id = :lessonId", { lessonId: of.lessonId });
  else query.where("teacher.id = :teacherId", { teacherId: of.teacherId });

  const bookings = await query
    .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
    .andWhere('booking."datetime" + make_interval(mins => booking."duration_minutes") > :since', {
      since: new Date(now.getTime() - FINISHED_CLASSES_DAYS * 24 * 60 * 60_000),
    })
    .orderBy('booking."datetime"', "ASC")
    .addOrderBy("inscription.id", "ASC")
    .getMany();

  return bookings.map((booking) => ({
    id: booking.id,
    lessonId: booking.lesson!.id,
    fromDateTime: booking.fromDateTime,
    durationMinutes: booking.durationMinutes,
    courtNumber: booking.court.number,
    classCapacity: booking.lesson!.classCapacity,
    isFinished: new Date(booking.fromDateTime).getTime() + booking.durationMinutes * 60_000 <= now.getTime(),
    students: studentsOf(booking.lesson!),
  }));
}
