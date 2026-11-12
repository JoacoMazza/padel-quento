"use server";

import "reflect-metadata";
import { IsNull, type EntityManager } from "typeorm";
import type { Booking } from "@/src/entities/Booking";
import type { Court } from "@/src/entities/Court";
import type { Lesson } from "@/src/entities/Lesson";
import type { LessonSchedule } from "@/src/entities/LessonSchedule";
import type { Player } from "@/src/entities/Player";
import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import { occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import {
  lessonEndDate,
  lessonInputProblem,
  lessonOccurrenceDates,
  scheduleDurationMinutes,
  slotStartTimes,
} from "@/src/domain/lesson";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";
import { getSessionPlayerId } from "@/src/lib/session-player";
import { isSlotTaken, isWithinSchedule, lockCourt } from "@/src/lib/court-booking";
import { notifyLessonCancelled } from "@/src/lib/match-notifications";
import {
  LESSON_NOT_FOUND_MESSAGE,
  LESSON_RELATIONS,
  LessonRuleError,
  cancelFutureSessionsOf,
  enrollStudent,
  findAgenda,
  findLesson,
  notFinishedYet,
  toLessonItem,
  unenrollStudent,
  type LessonItem,
  type TeacherClassItem,
} from "@/src/lib/lessons";

export type { LessonItem, LessonScheduleItem, StudentItem, TeacherClassItem } from "@/src/lib/lessons";

export type LessonScheduleInput = {
  courtId: number;
  dayOfWeek: DayOfWeek;
  /** "HH:MM" */
  startTime: string;
  endTime: string;
};

export type CreateLessonInput = {
  /** Jugador registrado que da la clase. */
  teacherId: number;
  classCapacity: number;
  price: number;
  /** Primera y última fecha de la clase ("YYYY-MM-DD"), ambas incluidas; sin la última, no tiene fin. */
  fromDate: string;
  toDate: string | null;
  schedules: LessonScheduleInput[];
};

/** Clase como la ve un jugador: sin la lista de alumnos, con su ocupación. */
export type AvailableLessonItem = Omit<LessonItem, "students"> & {
  studentsCount: number;
  /** El jugador de la sesión está inscripto. */
  isEnrolled: boolean;
  /** El jugador de la sesión es quien la da. */
  isOwn: boolean;
};

const LOGIN_REQUIRED_MESSAGE = "Tenés que iniciar sesión.";

/** Errores de permisos y de reglas de la clase: se muestran tal cual. */
function knownErrorMessage(error: unknown): string | null {
  return error instanceof ForbiddenError || error instanceof UnauthorizedError || error instanceof LessonRuleError
    ? error.message
    : null;
}

function failure(error: unknown, context: string, fallback: string): { success: false; error: string } {
  const known = knownErrorMessage(error);
  if (known) return { success: false, error: known };
  console.error(context, error);
  return { success: false, error: fallback };
}

/** "DD/MM" de una fecha "YYYY-MM-DD". */
function shortDate(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}

/** Reserva un turno de la clase a nombre del profesor, al precio de la cancha. */
async function reserveSession(
  manager: EntityManager,
  lessonId: number,
  teacher: Player,
  court: Court,
  start: Date,
  durationMinutes: number,
) {
  const bookings = manager.getRepository<Booking>("Booking");
  await bookings.save(
    bookings.create({
      fromDateTime: start,
      durationMinutes,
      bookingState: BookingState.RESERVED,
      price: court.price,
      booker: { id: teacher.id, phoneNumber: teacher.phoneNumber },
      court: { id: court.id },
      lesson: { id: lessonId },
      // Las clases no mueven puntos: el job de asistencia las da por procesadas.
      pointsAwarded: true,
    }),
  );
}

/** Lista todas las clases, las más nuevas primero. Cualquier administrador. */
export async function getLessonsAdmin(): Promise<ActionResult<LessonItem[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const lessons = await dataSource
      .getRepository<Lesson>("Lesson")
      .find({ relations: LESSON_RELATIONS, order: { createdAt: "DESC", id: "DESC" } });
    return { success: true, data: toPlain(lessons.map(toLessonItem)) };
  } catch (error) {
    return failure(error, "getLessonsAdmin", "No se pudieron obtener las clases.");
  }
}

/**
 * Inicios ("HH:MM") de los turnos de la grilla de la cancha ese día de la
 * semana, para elegir el horario de una clase como en las reservas. Sin
 * horario ese día, o con la cancha dada de baja, no hay ninguno.
 */
export async function getLessonSlotsAdmin(input: {
  courtId: number;
  dayOfWeek: DayOfWeek;
}): Promise<ActionResult<string[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const court = await dataSource
      .getRepository<Court>("Court")
      .findOne({ where: { id: input.courtId }, relations: { schedules: true } });
    const schedule = court?.schedules.find((s) => s.dayOfWeek === input.dayOfWeek);
    if (!court || court.state === CourtState.CLOSED_DOWN || !schedule) return { success: true, data: [] };
    return { success: true, data: slotStartTimes(String(schedule.openingTime), String(schedule.closingTime)) };
  } catch (error) {
    return failure(error, "getLessonSlotsAdmin", "No se pudieron obtener los horarios.");
  }
}

/**
 * Alta de una clase, para cualquier administrador: asigna a un jugador
 * registrado como profesor (no se le crea una cuenta) y reserva a su nombre,
 * al precio de la cancha, cada fecha de sus horarios semanales entre la fecha
 * de inicio y la de fin (sin fecha de fin, hasta el horizonte de 6 meses; las
 * siguientes las va reservando extendLessons). Si alguna fecha ya está ocupada
 * no se crea nada.
 */
export async function createLesson(input: CreateLessonInput): Promise<ActionResult<LessonItem>> {
  try {
    await requireAdmin();
    const problem = lessonInputProblem(input, todayISO());
    if (problem) return { success: false, error: problem };

    const now = new Date();
    const until = lessonEndDate(input.toDate, todayISO(now));
    const dataSource = await getDataSource();
    const lessonId = await dataSource.transaction(async (manager) => {
      const teacher = await manager.getRepository<Player>("Player").findOne({ where: { id: input.teacherId } });
      if (!teacher) throw new LessonRuleError("El jugador no existe.");

      const courtIds = [...new Set(input.schedules.map((slot) => slot.courtId))].sort((a, b) => a - b);
      const courts = new Map<number, Court>();
      for (const courtId of courtIds) {
        const court = await manager
          .getRepository<Court>("Court")
          .findOne({ where: { id: courtId }, relations: { schedules: true } });
        if (!court) throw new LessonRuleError("La cancha no existe.");
        if (court.state === CourtState.CLOSED_DOWN) throw new LessonRuleError("La cancha está dada de baja.");
        courts.set(courtId, court);
      }

      // Cada fecha de cada horario, ya ordenadas, con su cancha.
      const sessions = input.schedules
        .flatMap((slot) =>
          lessonOccurrenceDates(slot.dayOfWeek, input.fromDate, until).map((date) => ({
            slot,
            date,
            court: courts.get(slot.courtId)!,
            start: occurrenceStart(date, slot.startTime),
            durationMinutes: scheduleDurationMinutes(slot),
          })),
        )
        .sort((a, b) => a.start.getTime() - b.start.getTime());
      if (sessions.some((s) => !isWithinSchedule(s.court.schedules, s.date, s.slot.startTime, s.durationMinutes))) {
        throw new LessonRuleError("La cancha no está abierta en uno de los horarios de la clase.");
      }

      for (const courtId of courtIds) await lockCourt(manager, courtId);

      const lessons = manager.getRepository<Lesson>("Lesson");
      const lesson = await lessons.save(
        lessons.create({
          teacher: { id: teacher.id },
          classCapacity: input.classCapacity,
          price: input.price,
          isActive: true,
          fromLocalDatetime: occurrenceStart(input.fromDate, "00:00"),
          toLocalDatetime: input.toDate ? occurrenceStart(input.toDate, "23:59") : null,
        }),
      );
      const schedules = manager.getRepository<LessonSchedule>("LessonSchedule");
      await schedules.save(
        input.schedules.map((slot) =>
          schedules.create({
            lesson: { id: lesson.id },
            court: { id: slot.courtId },
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
          }),
        ),
      );

      for (const session of sessions) {
        if (session.start <= now) continue;
        if (await isSlotTaken(manager, session.court.id, session.start, session.durationMinutes)) {
          throw new LessonRuleError(
            `El horario del ${shortDate(session.date)} a las ${session.slot.startTime} en la cancha ${session.court.number} ya está ocupado.`,
          );
        }
        await reserveSession(manager, lesson.id, teacher, session.court, session.start, session.durationMinutes);
      }
      return lesson.id;
    });

    return { success: true, data: toPlain(toLessonItem((await findLesson(lessonId))!)) };
  } catch (error) {
    return failure(error, "createLesson", "No se pudo crear la clase.");
  }
}

/**
 * Da de baja una clase: cancela sus turnos que todavía no empezaron y avisa a
 * los alumnos. Su profesor deja de serlo si no tiene otra clase activa.
 * Cualquier administrador.
 */
export async function deactivateLesson(id: number): Promise<ActionResult<LessonItem>> {
  try {
    await requireAdmin();
    const lesson = await findLesson(id);
    if (!lesson) return { success: false, error: LESSON_NOT_FOUND_MESSAGE };

    const dataSource = await getDataSource();
    await dataSource.getRepository<Lesson>("Lesson").update(id, { isActive: false });
    const cancelled = await cancelFutureSessionsOf(id);
    if (cancelled.length > 0) {
      await notifyLessonCancelled(id);
    }
    return { success: true, data: toPlain(toLessonItem({ ...lesson, isActive: false })) };
  } catch (error) {
    return failure(error, "deactivateLesson", "No se pudo dar de baja la clase.");
  }
}

/** Turnos de una clase (próximos y finalizados recientes) para supervisarlos (HU-48). Cualquier administrador. */
export async function getLessonClassesAdmin(id: number): Promise<ActionResult<TeacherClassItem[]>> {
  try {
    await requireAdmin();
    if (!(await findLesson(id))) return { success: false, error: LESSON_NOT_FOUND_MESSAGE };
    return { success: true, data: toPlain(await findAgenda({ lessonId: id })) };
  } catch (error) {
    return failure(error, "getLessonClassesAdmin", "No se pudieron obtener los turnos de la clase.");
  }
}

/** Inscribe a un jugador en una clase, desde el panel. Cualquier administrador. */
export async function addLessonStudentAdmin(lessonId: number, playerId: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await enrollStudent(lessonId, playerId);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "addLessonStudentAdmin", "No se pudo inscribir al alumno.");
  }
}

/** Da de baja a un alumno de una clase, desde el panel. Cualquier administrador. */
export async function removeLessonStudentAdmin(lessonId: number, playerId: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    await unenrollStudent(lessonId, playerId, "Ese alumno no está inscripto en la clase.");
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "removeLessonStudentAdmin", "No se pudo dar de baja al alumno.");
  }
}

/** Clases activas que todavía no terminaron, para que un jugador se inscriba. */
export async function getAvailableLessons(): Promise<ActionResult<AvailableLessonItem[]>> {
  try {
    const playerId = await getSessionPlayerId();
    const dataSource = await getDataSource();
    const lessons = await dataSource.getRepository<Lesson>("Lesson").find({
      where: { isActive: true, toLocalDatetime: notFinishedYet() },
      relations: LESSON_RELATIONS,
      order: { fromLocalDatetime: "ASC", id: "ASC" },
    });
    const data = lessons.map((lesson): AvailableLessonItem => {
      const { students, ...item } = toLessonItem(lesson);
      return {
        ...item,
        studentsCount: students.length,
        isEnrolled: students.some((student) => student.id === playerId),
        isOwn: item.teacherId === playerId,
      };
    });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    return failure(error, "getAvailableLessons", "No se pudieron obtener las clases.");
  }
}

/** El jugador de la sesión se inscribe en una clase. */
export async function enrollInLesson(lessonId: number): Promise<ActionResult<null>> {
  try {
    const playerId = await getSessionPlayerId();
    if (playerId === null) return { success: false, error: LOGIN_REQUIRED_MESSAGE };
    await enrollStudent(lessonId, playerId);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "enrollInLesson", "No se pudo inscribirte en la clase.");
  }
}

/** El jugador de la sesión se da de baja de una clase (HU-47). */
export async function leaveLesson(lessonId: number): Promise<ActionResult<null>> {
  try {
    const playerId = await getSessionPlayerId();
    if (playerId === null) return { success: false, error: LOGIN_REQUIRED_MESSAGE };
    await unenrollStudent(lessonId, playerId, "No estás inscripto en esa clase.");
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "leaveLesson", "No se pudo darte de baja de la clase.");
  }
}

/**
 * Reserva los turnos nuevos de las clases activas sin fecha de fin a medida
 * que entran en el horizonte de 6 meses (como extendFixedBookings). Las fechas
 * que ya tienen turno, aunque se haya cancelado, no se tocan, así que se puede
 * correr las veces que haga falta; las que están ocupadas o fuera del horario
 * de la cancha se saltean. Pensada para el proceso en segundo plano
 * (src/jobs/lesson-extension.ts). Devuelve cuántos turnos reservó.
 */
export async function extendLessons(): Promise<ActionResult<number>> {
  try {
    const now = new Date();
    const today = todayISO(now);
    const until = lessonEndDate(null, today);
    const dataSource = await getDataSource();
    const lessons = await dataSource.getRepository<Lesson>("Lesson").find({
      where: { isActive: true, toLocalDatetime: IsNull() },
      relations: { teacher: true, schedules: { court: { schedules: true } }, bookings: true },
    });

    let total = 0;
    for (const lesson of lessons) {
      const fromDate = todayISO(new Date(lesson.fromLocalDatetime));
      const registered = new Set(lesson.bookings.map((booking) => new Date(booking.fromDateTime).getTime()));
      total += await dataSource.transaction(async (manager) => {
        let created = 0;
        for (const schedule of lesson.schedules) {
          const court = schedule.court;
          if (court.state === CourtState.CLOSED_DOWN) continue;
          const startTime = schedule.startTime.slice(0, 5);
          const durationMinutes = scheduleDurationMinutes(schedule);
          await lockCourt(manager, court.id);
          for (const date of lessonOccurrenceDates(schedule.dayOfWeek, fromDate > today ? fromDate : today, until)) {
            const start = occurrenceStart(date, startTime);
            if (start <= now || registered.has(start.getTime())) continue;
            if (!isWithinSchedule(court.schedules, date, startTime, durationMinutes)) continue;
            if (await isSlotTaken(manager, court.id, start, durationMinutes)) continue;
            await reserveSession(manager, lesson.id, lesson.teacher, court, start, durationMinutes);
            created += 1;
          }
        }
        return created;
      });
    }
    return { success: true, data: total };
  } catch (error) {
    console.error("extendLessons", error);
    return { success: false, error: "No se pudieron reservar los turnos nuevos de las clases." };
  }
}
