"use server";

import "reflect-metadata";
import { Brackets, MoreThan } from "typeorm";
import type { Inscription } from "@/src/entities/Inscription";
import type { Lesson } from "@/src/entities/Lesson";
import type { Player } from "@/src/entities/Player";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireTeacher } from "@/src/lib/rbac";
import {
  LESSON_NOT_FOUND_MESSAGE,
  LESSON_RELATIONS,
  LessonRuleError,
  enrollStudent,
  findAgenda,
  findLesson,
  toLessonItem,
  toStudent,
  unenrollStudent,
  type LessonItem,
  type StudentItem,
  type TeacherClassItem,
} from "@/src/lib/lessons";

export type { LessonItem, StudentItem, TeacherClassItem } from "@/src/lib/lessons";

const MIN_SEARCH_LENGTH = 2;
const SEARCH_LIMIT = 10;

/** Alumno en el listado del profesor (HU-45): contacto, clases que ya tuvo con él y la última. */
export type TeacherStudentItem = StudentItem & {
  phoneNumber: string;
  classesCount: number;
  lastClassAt: Date | null;
};

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

/** Clase del profesor de la sesión; cualquier otra se trata como inexistente. */
async function requireOwnLesson(lessonId: number, teacherId: number) {
  if (!(await findLesson(lessonId, { teacherId }))) throw new LessonRuleError(LESSON_NOT_FOUND_MESSAGE);
}

/** Clases activas del profesor que todavía no terminaron, con sus alumnos. */
export async function getTeacherLessons(): Promise<ActionResult<LessonItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    const dataSource = await getDataSource();
    const lessons = await dataSource.getRepository<Lesson>("Lesson").find({
      where: { teacher: { id: playerId }, isActive: true, toLocalDatetime: MoreThan(new Date()) },
      relations: LESSON_RELATIONS,
      order: { fromLocalDatetime: "ASC", id: "ASC" },
    });
    return { success: true, data: toPlain(lessons.map(toLessonItem)) };
  } catch (error) {
    return failure(error, "getTeacherLessons", "No se pudieron obtener tus clases.");
  }
}

/**
 * Agenda del profesor (HU-46): los turnos de sus clases por fecha, con los
 * alumnos. Trae los que todavía no terminaron y los que terminaron en los
 * últimos días, marcados como finalizados. Sin los cancelados.
 */
export async function getTeacherClasses(): Promise<ActionResult<TeacherClassItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    return { success: true, data: toPlain(await findAgenda({ teacherId: playerId })) };
  } catch (error) {
    return failure(error, "getTeacherClasses", "No se pudieron obtener tus clases.");
  }
}

/**
 * Alumnos inscriptos en las clases del profesor (HU-45): su contacto, cuántos
 * turnos de esas clases ya terminaron (sin los cancelados) y la fecha del
 * último. Ordenados por nombre.
 */
export async function getTeacherStudents(): Promise<ActionResult<TeacherStudentItem[]>> {
  try {
    const { playerId } = await requireTeacher();
    const dataSource = await getDataSource();
    const rows = await dataSource
      .createQueryBuilder<Inscription>("Inscription", "inscription")
      .innerJoin("inscription.lesson", "lesson")
      .innerJoin("lesson.teacher", "teacher")
      .innerJoin("inscription.player", "player")
      .innerJoin("player.account", "account")
      .leftJoin(
        "lesson.bookings",
        "booking",
        'booking."booking_state" != :cancelled AND booking."datetime" + make_interval(mins => booking."duration_minutes") <= :now',
        { cancelled: BookingState.CANCELLED, now: new Date() },
      )
      .select("player.id", "id")
      .addSelect("player.names", "names")
      .addSelect("player.lastnames", "lastnames")
      .addSelect("account.email", "email")
      .addSelect("player.phoneNumber", "phoneNumber")
      .addSelect("COUNT(DISTINCT booking.id)", "classesCount")
      .addSelect('MAX(booking."datetime")', "lastClassAt")
      .where("teacher.id = :playerId", { playerId })
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
    return failure(error, "getTeacherStudents", "No se pudieron obtener tus alumnos.");
  }
}

/** Busca jugadores registrados por nombre, apellido o email para inscribirlos (sin el propio profesor). */
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
    return failure(error, "searchStudents", "No se pudieron buscar jugadores.");
  }
}

/** Inscribe a un jugador en una clase del profesor (HU-44), hasta el cupo. */
export async function addLessonStudent(lessonId: number, studentId: number): Promise<ActionResult<null>> {
  try {
    const { playerId } = await requireTeacher();
    await requireOwnLesson(lessonId, playerId);
    await enrollStudent(lessonId, studentId);
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "addLessonStudent", "No se pudo inscribir al alumno.");
  }
}

/** Da de baja a un alumno de una clase del profesor (HU-44). */
export async function removeLessonStudent(lessonId: number, studentId: number): Promise<ActionResult<null>> {
  try {
    const { playerId } = await requireTeacher();
    await requireOwnLesson(lessonId, playerId);
    await unenrollStudent(lessonId, studentId, "Ese alumno no está inscripto en la clase.");
    return { success: true, data: null };
  } catch (error) {
    return failure(error, "removeLessonStudent", "No se pudo quitar al alumno.");
  }
}
