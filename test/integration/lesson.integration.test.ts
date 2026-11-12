import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { AdminAccessLevel, BookingState, DayOfWeek, Role } from "@/src/domain/enums";
import { addDaysISO, dayOfWeekOfISO, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import type { Booking } from "@/src/entities/Booking";
import type { Inscription } from "@/src/entities/Inscription";
import type { Penalty } from "@/src/entities/Penalty";
import { getDataSource } from "@/src/lib/db";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { getPlayerBookings } from "@/src/lib/player-bookings";
import { ForbiddenError, requireTeacher } from "@/src/lib/rbac";
import { createPlayer } from "@/src/actions/player";
import { createSchedule } from "@/src/actions/schedule";
import { updateBooking } from "@/src/actions/booking";
import { awardAttendancePoints } from "@/src/actions/attendance";
import { getScheduleBoardData } from "@/src/actions/scheduleBoard";
import {
  addLessonStudentAdmin,
  createLesson,
  deactivateLesson,
  enrollInLesson,
  getAvailableLessons,
  getLessonClassesAdmin,
  getLessonsAdmin,
  leaveLesson,
  removeLessonStudentAdmin,
  type CreateLessonInput,
} from "@/src/actions/lesson";
import {
  addLessonStudent,
  getTeacherClasses,
  getTeacherLessons,
  getTeacherStudents,
  removeLessonStudent,
  searchStudents,
} from "@/src/actions/teacherClass";
import { createTestAdmin, createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const { notify } = vi.hoisted(() => ({ notify: vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

const HOUR = 60 * 60_000;
const ALL_DAYS = Object.values(DayOfWeek);

let seq = 0;
async function newPlayer(names: string) {
  seq += 1;
  const created = await createPlayer({
    names,
    lastnames: "Clase",
    email: `${names.toLowerCase()}.${Date.now()}.${seq}@test.com`,
    password: "secreto123",
    phoneNumber: uniquePhoneNumber(),
  });
  if (!created.success) throw new Error(created.error);
  return { id: created.data.id, email: created.data.account.email, names };
}

type TestPlayer = Awaited<ReturnType<typeof newPlayer>>;

function signInAs(email: string, role = Role.PLAYER) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email, role } } as never);
}

async function lessonBookings(lessonId: number) {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Booking>("Booking").find({
    where: { lesson: { id: lessonId } },
    relations: { booker: true, court: true },
    order: { fromDateTime: "ASC" },
  });
}

async function pointsMovementsOf(playerId: number) {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Penalty>("Penalty").count({ where: { player: { id: playerId } } });
}

describe("clases (lessons, integración con Postgres real)", () => {
  let staffEmail: string;
  let teacher: TestPlayer;
  let ana: TestPlayer;
  let bruno: TestPlayer;
  let carla: TestPlayer;

  // Desde mañana, para que ningún turno caiga en una hora de hoy que ya pasó.
  const fromDate = addDaysISO(todayISO(), 1);
  const toDate = addDaysISO(todayISO(), 14);
  // Un día que cae dos veces entre fromDate y toDate.
  const lessonDay = dayOfWeekOfISO(addDaysISO(todayISO(), 2));

  /** Cancha abierta todos los días de 9 a 23 (el horario lo carga un admin). */
  async function newCourt(price = 12000) {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price });
    signInAs(staffEmail, Role.ADMIN);
    for (const dayOfWeek of ALL_DAYS) {
      await createSchedule({
        dayOfWeek,
        openingTime: "09:00:00" as unknown as Date,
        closingTime: "23:00:00" as unknown as Date,
        courtId: court.data.id,
      });
    }
    return court.data;
  }

  async function lessonInput(overrides: Partial<CreateLessonInput> = {}): Promise<CreateLessonInput> {
    const court = await newCourt();
    return {
      teacherId: teacher.id,
      classCapacity: 2,
      price: 15000,
      fromDate,
      toDate,
      schedules: [{ courtId: court.id, dayOfWeek: lessonDay, startTime: "10:00", endTime: "11:30" }],
      ...overrides,
    };
  }

  /** Clase nueva de `teacher`, creada por el admin. Deja la sesión del admin. */
  async function newLesson(overrides: Partial<CreateLessonInput> = {}) {
    const input = await lessonInput(overrides);
    signInAs(staffEmail, Role.ADMIN);
    const created = await createLesson(input);
    if (!created.success) throw new Error(created.error);
    return created.data;
  }

  async function moveToPast(bookingId: number, hoursAgo = 3) {
    const dataSource = await getDataSource();
    await dataSource
      .getRepository<Booking>("Booking")
      .update(bookingId, { fromDateTime: new Date(Date.now() - hoursAgo * HOUR) });
  }

  beforeAll(async () => {
    // Cualquier administrador gestiona las clases, también un trabajador.
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
    teacher = await newPlayer("Profe");
    ana = await newPlayer("Ana");
    bruno = await newPlayer("Bruno");
    carla = await newPlayer("Carla");
  });

  beforeEach(() => {
    vi.clearAllMocks();
    signInAs(staffEmail, Role.ADMIN);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("alta de una clase desde el panel", () => {
    it("asigna a un jugador registrado como profesor y reserva a su nombre cada fecha de los horarios", async () => {
      const input = await lessonInput();
      signInAs(staffEmail, Role.ADMIN);

      const result = await createLesson(input);

      if (!result.success) throw new Error(result.error);
      expect(result.data).toMatchObject({
        teacherId: teacher.id,
        teacherName: "Profe Clase",
        classCapacity: 2,
        price: 15000,
        fromDate,
        toDate,
        isActive: true,
        schedules: [{ courtId: input.schedules[0].courtId, dayOfWeek: lessonDay, startTime: "10:00", endTime: "11:30" }],
        students: [],
      });

      const bookings = await lessonBookings(result.data.id);
      expect(bookings.map((b) => b.fromDateTime.getTime())).toEqual([
        occurrenceStart(addDaysISO(todayISO(), 2), "10:00").getTime(),
        occurrenceStart(addDaysISO(todayISO(), 9), "10:00").getTime(),
      ]);
      for (const booking of bookings) {
        expect(booking).toMatchObject({
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          price: 12000,
          booker: { id: teacher.id },
          court: { id: input.schedules[0].courtId },
        });
      }
    });

    it("el horario de la clase deja de estar disponible para otros jugadores", async () => {
      const lesson = await newLesson();
      const [first] = await lessonBookings(lesson.id);

      const attempt = await createBookingForPlayer({
        bookerId: ana.id,
        courtId: first.court.id,
        fromDateTime: first.fromDateTime,
      });

      expect(attempt).toEqual({ success: false, error: "Ese horario ya está reservado para esta cancha." });
    });

    it("si alguna fecha ya está ocupada no crea la clase ni ninguno de sus turnos", async () => {
      const input = await lessonInput();
      const taken = addDaysISO(todayISO(), 9);
      const booked = await createBookingForPlayer({
        bookerId: ana.id,
        courtId: input.schedules[0].courtId,
        fromDateTime: occurrenceStart(taken, "10:00"),
      });
      if (!booked.success) throw new Error(booked.error);
      signInAs(staffEmail, Role.ADMIN);

      const result = await createLesson(input);

      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.error).toMatch(/^El horario del \d{2}\/\d{2} a las 10:00 en la cancha \d+ ya está ocupado\.$/);
      const dataSource = await getDataSource();
      const created = await dataSource
        .getRepository<Booking>("Booking")
        .count({ where: { court: { id: input.schedules[0].courtId }, bookingState: BookingState.RESERVED } });
      expect(created).toBe(1);
    });

    it("valida el cupo, las fechas y los horarios", async () => {
      const input = await lessonInput({ classCapacity: 9 });
      signInAs(staffEmail, Role.ADMIN);

      expect(await createLesson(input)).toEqual({
        success: false,
        error: "El cupo de la clase tiene que ser de 1 a 8 alumnos.",
      });
    });

    it("la base también rechaza un cupo fuera de rango", async () => {
      const lesson = await newLesson();
      const dataSource = await getDataSource();

      await expect(dataSource.query(`UPDATE "lessons" SET "class_capacity" = 9 WHERE "id" = $1`, [lesson.id])).rejects.toThrow(
        QueryFailedError,
      );
    });

    it("rechaza un horario en el que la cancha no está abierta", async () => {
      const input = await lessonInput();
      input.schedules[0] = { ...input.schedules[0], startTime: "22:30", endTime: "23:30" };
      signInAs(staffEmail, Role.ADMIN);

      expect(await createLesson(input)).toEqual({
        success: false,
        error: "La cancha no está abierta en uno de los horarios de la clase.",
      });
    });

    it("devuelve error si el profesor no es un jugador registrado", async () => {
      const input = await lessonInput({ teacherId: 999_999 });
      signInAs(staffEmail, Role.ADMIN);

      expect(await createLesson(input)).toEqual({ success: false, error: "El jugador no existe." });
    });

    it("solo la da de alta un administrador", async () => {
      const input = await lessonInput();
      signInAs(ana.email);

      expect(await createLesson(input)).toEqual({
        success: false,
        error: "Acceso denegado: Se requieren permisos de Administrador",
      });
    });
  });

  describe("el rol de profesor", () => {
    it("un jugador es profesor mientras tenga una clase activa", async () => {
      const newTeacher = await newPlayer("Martina");
      signInAs(newTeacher.email);
      await expect(requireTeacher()).rejects.toBeInstanceOf(ForbiddenError);

      const lesson = await newLesson({ teacherId: newTeacher.id });
      signInAs(newTeacher.email);
      await expect(requireTeacher()).resolves.toMatchObject({ playerId: newTeacher.id });

      signInAs(staffEmail, Role.ADMIN);
      await deactivateLesson(lesson.id);
      signInAs(newTeacher.email);
      await expect(requireTeacher()).rejects.toBeInstanceOf(ForbiddenError);
    });

    it("un administrador no es profesor", async () => {
      signInAs(staffEmail, Role.ADMIN);

      await expect(requireTeacher()).rejects.toBeInstanceOf(ForbiddenError);
    });
  });

  describe("getLessonsAdmin", () => {
    it("lista las clases con su profesor, sus horarios y sus alumnos", async () => {
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, ana.id);

      const result = await getLessonsAdmin();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((l) => l.id === lesson.id)).toMatchObject({
        teacherName: "Profe Clase",
        schedules: [{ courtNumber: expect.any(Number), dayOfWeek: lessonDay }],
        students: [{ id: ana.id, names: "Ana" }],
      });
    });
  });

  describe("dar de baja una clase", () => {
    it("cancela sus turnos futuros, sin tocar los pasados, y avisa a los alumnos", async () => {
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, ana.id);
      const [past, future] = await lessonBookings(lesson.id);
      await moveToPast(past.id);
      notify.mockClear();

      const result = await deactivateLesson(lesson.id);

      expect(result).toMatchObject({ success: true, data: { isActive: false } });
      const bookings = await lessonBookings(lesson.id);
      expect(bookings.find((b) => b.id === past.id)?.bookingState).toBe(BookingState.RESERVED);
      expect(bookings.find((b) => b.id === future.id)?.bookingState).toBe(BookingState.CANCELLED);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify.mock.calls[0][0]).toEqual([expect.objectContaining({ names: "Ana" })]);
    });

    it("devuelve error si la clase no existe", async () => {
      expect(await deactivateLesson(999_999)).toEqual({ success: false, error: "La clase no existe." });
    });
  });

  describe("getLessonClassesAdmin (supervisión, HU-48)", () => {
    it("trae los turnos de la clase como la agenda del profesor", async () => {
      const lesson = await newLesson({ classCapacity: 3 });
      await addLessonStudentAdmin(lesson.id, ana.id);

      const result = await getLessonClassesAdmin(lesson.id);

      if (!result.success) throw new Error(result.error);
      expect(result.data).toHaveLength(2);
      expect(result.data[0]).toMatchObject({
        lessonId: lesson.id,
        classCapacity: 3,
        isFinished: false,
        students: [{ id: ana.id }],
      });
    });

    it("la grilla del admin trae cada turno de clase con su clase y sus alumnos", async () => {
      const lesson = await newLesson({ classCapacity: 3 });
      await addLessonStudentAdmin(lesson.id, ana.id);
      const [first] = await lessonBookings(lesson.id);

      const board = await getScheduleBoardData();

      if (!board.success) throw new Error(board.error);
      const booking = board.data.bookings.find((b) => b.id === first.id);
      expect(booking?.lesson).toMatchObject({ id: lesson.id, classCapacity: 3 });
      expect(booking?.lesson?.inscriptions.map((i) => i.player.names)).toEqual(["Ana"]);
    });
  });

  describe("inscripciones", () => {
    it("el admin inscribe y da de baja alumnos", async () => {
      const lesson = await newLesson();

      expect(await addLessonStudentAdmin(lesson.id, ana.id)).toEqual({ success: true, data: null });
      expect(await removeLessonStudentAdmin(lesson.id, ana.id)).toEqual({ success: true, data: null });

      const dataSource = await getDataSource();
      expect(await dataSource.getRepository<Inscription>("Inscription").count({ where: { lesson: { id: lesson.id } } })).toBe(0);
    });

    it("un jugador se inscribe solo, hasta el cupo de la clase", async () => {
      const lesson = await newLesson({ classCapacity: 2 });

      signInAs(ana.email);
      expect(await enrollInLesson(lesson.id)).toEqual({ success: true, data: null });
      signInAs(bruno.email);
      expect(await enrollInLesson(lesson.id)).toEqual({ success: true, data: null });
      signInAs(carla.email);
      expect(await enrollInLesson(lesson.id)).toEqual({ success: false, error: "La clase ya está completa." });
    });

    it("no inscribe dos veces al mismo alumno", async () => {
      const lesson = await newLesson();
      signInAs(ana.email);
      await enrollInLesson(lesson.id);

      expect(await enrollInLesson(lesson.id)).toEqual({ success: false, error: "Ya está inscripto en la clase." });
    });

    it("la base tampoco deja repetir un alumno en la misma clase", async () => {
      const lesson = await newLesson();
      const dataSource = await getDataSource();
      const inscriptions = dataSource.getRepository<Inscription>("Inscription");
      await inscriptions.save(inscriptions.create({ lesson: { id: lesson.id }, player: { id: ana.id } }));

      await expect(
        inscriptions.insert({ lesson: { id: lesson.id }, player: { id: ana.id } }),
      ).rejects.toThrow(QueryFailedError);
    });

    it("el profesor no es alumno de su propia clase", async () => {
      const lesson = await newLesson();
      signInAs(teacher.email);

      expect(await enrollInLesson(lesson.id)).toEqual({
        success: false,
        error: "El profesor no puede ser alumno de su propia clase.",
      });
    });

    it("no inscribe en una clase dada de baja", async () => {
      const lesson = await newLesson();
      await deactivateLesson(lesson.id);
      signInAs(ana.email);

      expect(await enrollInLesson(lesson.id)).toEqual({ success: false, error: "La clase fue dada de baja." });
    });

    it("el alumno se da de baja de la clase y libera su lugar", async () => {
      const lesson = await newLesson({ classCapacity: 1 });
      signInAs(ana.email);
      await enrollInLesson(lesson.id);

      expect(await leaveLesson(lesson.id)).toEqual({ success: true, data: null });
      signInAs(bruno.email);
      expect(await enrollInLesson(lesson.id)).toEqual({ success: true, data: null });
    });

    it("no se da de baja de una clase en la que no está", async () => {
      const lesson = await newLesson();
      signInAs(ana.email);

      expect(await leaveLesson(lesson.id)).toEqual({ success: false, error: "No estás inscripto en esa clase." });
    });

    it("sin sesión no se inscribe", async () => {
      const lesson = await newLesson();
      vi.mocked(getServerSession).mockResolvedValue(null);

      expect(await enrollInLesson(lesson.id)).toEqual({ success: false, error: "Tenés que iniciar sesión." });
    });

    it("getAvailableLessons lista las clases activas con su ocupación y si el jugador está inscripto", async () => {
      const lesson = await newLesson({ classCapacity: 3 });
      const inactive = await newLesson();
      await deactivateLesson(inactive.id);
      signInAs(ana.email);
      await enrollInLesson(lesson.id);

      const result = await getAvailableLessons();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((l) => l.id === lesson.id)).toMatchObject({
        teacherName: "Profe Clase",
        classCapacity: 3,
        studentsCount: 1,
        isEnrolled: true,
        isOwn: false,
      });
      expect(result.data.some((l) => l.id === inactive.id)).toBe(false);
    });
  });

  describe("el profesor y sus alumnos", () => {
    it("inscribe y quita alumnos de sus clases", async () => {
      const lesson = await newLesson();
      signInAs(teacher.email);

      expect(await addLessonStudent(lesson.id, ana.id)).toEqual({ success: true, data: null });
      expect(await removeLessonStudent(lesson.id, ana.id)).toEqual({ success: true, data: null });
    });

    it("no maneja los alumnos de la clase de otro profesor", async () => {
      const other = await newPlayer("Otro");
      const lesson = await newLesson({ teacherId: other.id });
      await newLesson();
      signInAs(teacher.email);

      expect(await addLessonStudent(lesson.id, ana.id)).toEqual({ success: false, error: "La clase no existe." });
    });

    it("solo un profesor maneja alumnos", async () => {
      const lesson = await newLesson();
      signInAs(ana.email);

      expect(await addLessonStudent(lesson.id, bruno.id)).toEqual({
        success: false,
        error: "Acceso denegado: Se requiere el rol de Profesor",
      });
    });

    it("busca jugadores registrados por nombre o email, sin incluirse", async () => {
      await newLesson();
      signInAs(teacher.email);

      const result = await searchStudents("ana");

      if (!result.success) throw new Error(result.error);
      expect(result.data.some((s) => s.id === ana.id)).toBe(true);
      expect(result.data.some((s) => s.id === teacher.id)).toBe(false);
    });

    it("getTeacherLessons trae sus clases activas con los alumnos", async () => {
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, ana.id);
      signInAs(teacher.email);

      const result = await getTeacherLessons();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((l) => l.id === lesson.id)).toMatchObject({ students: [{ id: ana.id }] });
    });

    it("getTeacherClasses trae los turnos de sus clases, por fecha, con los alumnos y el cupo", async () => {
      const lesson = await newLesson({ classCapacity: 4 });
      await addLessonStudentAdmin(lesson.id, ana.id);
      const bookings = await lessonBookings(lesson.id);
      signInAs(teacher.email);

      const result = await getTeacherClasses();

      if (!result.success) throw new Error(result.error);
      const mine = result.data.filter((c) => c.lessonId === lesson.id);
      expect(mine.map((c) => c.id)).toEqual(bookings.map((b) => b.id));
      expect(mine[0]).toMatchObject({ classCapacity: 4, isFinished: false, students: [{ id: ana.id }] });
    });

    it("getTeacherStudents lista a cada alumno con las clases que ya tuvo y la última", async () => {
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, carla.id);
      const [first] = await lessonBookings(lesson.id);
      await moveToPast(first.id);
      signInAs(teacher.email);

      const result = await getTeacherStudents();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((s) => s.id === carla.id)).toMatchObject({
        classesCount: expect.any(Number),
        lastClassAt: expect.any(Date),
      });
      expect(result.data.find((s) => s.id === carla.id)!.classesCount).toBeGreaterThanOrEqual(1);
    });
  });

  describe("los turnos de la clase en Mis turnos", () => {
    it("el alumno ve los turnos de las clases en las que está inscripto", async () => {
      const student = await newPlayer("Dana");
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, student.id);

      const bookings = await getPlayerBookings(student.id);

      expect(bookings.map((b) => b.lesson?.id)).toEqual([lesson.id, lesson.id]);
    });

    it("cuando el profesor cancela un turno se les avisa a los alumnos, sin penalizarlo", async () => {
      const lesson = await newLesson();
      await addLessonStudentAdmin(lesson.id, ana.id);
      const [first] = await lessonBookings(lesson.id);
      const dataSource = await getDataSource();
      await dataSource.getRepository<Booking>("Booking").update(first.id, { fromDateTime: new Date(Date.now() + HOUR) });
      const movementsBefore = await pointsMovementsOf(teacher.id);
      signInAs(teacher.email);
      notify.mockClear();

      const result = await updateBooking(first.id, { bookingState: BookingState.CANCELLED });

      expect(result.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      expect(notify.mock.calls[0][0]).toEqual([expect.objectContaining({ names: "Ana" })]);
      expect(await pointsMovementsOf(teacher.id)).toBe(movementsBefore);
    });

    it("al terminar, el job de asistencia no le mueve puntos al profesor", async () => {
      const lesson = await newLesson();
      const [first] = await lessonBookings(lesson.id);
      await moveToPast(first.id);
      const movementsBefore = await pointsMovementsOf(teacher.id);

      await awardAttendancePoints();

      expect(await pointsMovementsOf(teacher.id)).toBe(movementsBefore);
    });
  });
});
