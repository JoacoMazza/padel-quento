import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryFailedError } from "typeorm";
import { AdminAccessLevel, BookingState, Role } from "@/src/domain/enums";
import type { Booking } from "@/src/entities/Booking";
import type { ClassStudent } from "@/src/entities/ClassStudent";
import type { Teacher } from "@/src/entities/Teacher";
import { getDataSource } from "@/src/lib/db";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { getPlayerBookings } from "@/src/lib/player-bookings";
import { createPlayer } from "@/src/actions/player";
import { updateBooking } from "@/src/actions/booking";
import { awardAttendancePoints } from "@/src/actions/attendance";
import type { Penalty } from "@/src/entities/Penalty";
import { getTeacherClassesAdmin, removeTeacherRole, setTeacherActive } from "@/src/actions/teacher";
import { getScheduleBoardData } from "@/src/actions/scheduleBoard";
import {
  addClassStudent,
  createClassBooking,
  getTeacherClasses,
  getTeacherStudents,
  leaveClass,
  removeClassStudent,
  searchStudents,
} from "@/src/actions/teacherClass";
import { createTestAdmin, createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

const HOUR = 60 * 60_000;
const DAY = 24 * HOUR;

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

/** Movimientos de puntos del jugador: una falta queda registrada aunque no tenga saldo. */
async function pointsMovementsOf(playerId: number) {
  const dataSource = await getDataSource();
  return dataSource.getRepository<Penalty>("Penalty").count({ where: { player: { id: playerId } } });
}

function signInAs(email: string, role = Role.PLAYER) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email, role } } as never);
}

/** Turno a futuro, en una hora redonda, a `days` días. */
let slotOffset = 0;
function futureSlot(days = 3) {
  slotOffset += 1;
  const start = new Date(Date.now() + (days + slotOffset) * DAY);
  start.setHours(10, 0, 0, 0);
  return start;
}

describe("clases (HU-43 y HU-44, integración con Postgres real)", () => {
  let courtId: number;
  let teacher: Awaited<ReturnType<typeof newPlayer>>;
  let teacherId: number;
  let ana: Awaited<ReturnType<typeof newPlayer>>;
  let bruno: Awaited<ReturnType<typeof newPlayer>>;
  let carla: Awaited<ReturnType<typeof newPlayer>>;
  let staffEmail: string;

  async function makeTeacher(player: { id: number }) {
    const dataSource = await getDataSource();
    const teachers = dataSource.getRepository<Teacher>("Teacher");
    return teachers.save(teachers.create({ player: { id: player.id }, isActive: true }));
  }

  async function newClass(capacity = 2, start = futureSlot()) {
    signInAs(teacher.email);
    const created = await createClassBooking({ courtId, fromDateTime: start, classCapacity: capacity });
    if (!created.success) throw new Error(created.error);
    return created.data.id;
  }

  async function moveToPast(bookingId: number, hoursAgo = 3) {
    const dataSource = await getDataSource();
    await dataSource.getRepository<Booking>("Booking").update(bookingId, { fromDateTime: new Date(Date.now() - hoursAgo * HOUR) });
  }

  beforeAll(async () => {
    courtId = (await createTestCourt({ number: uniqueCourtNumber(), price: 12000 })).data.id;
    teacher = await newPlayer("Profe");
    teacherId = (await makeTeacher(teacher)).id;
    ana = await newPlayer("Ana");
    bruno = await newPlayer("Bruno");
    carla = await newPlayer("Carla");
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    signInAs(teacher.email);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("el turno de clase (HU-43)", () => {
    it("el profesor reserva el turno a su nombre, al precio de la cancha, marcado como clase con su cupo", async () => {
      const start = futureSlot();

      const result = await createClassBooking({ courtId, fromDateTime: start, classCapacity: 6 });

      expect(result).toMatchObject({ success: true, data: { classCapacity: 6, price: 12000 } });
      if (!result.success) return;
      const dataSource = await getDataSource();
      const saved = await dataSource
        .getRepository<Booking>("Booking")
        .findOneOrFail({ where: { id: result.data.id }, relations: { booker: true, match: true } });
      expect(saved.booker.id).toBe(teacher.id);
      expect(saved.bookingState).toBe(BookingState.RESERVED);
      expect(saved.match).toBeNull();
    });

    it("el horario deja de estar disponible para otros jugadores", async () => {
      const start = futureSlot();
      await newClass(4, start);

      const other = await createBookingForPlayer({ fromDateTime: start, courtId, bookerId: ana.id });

      expect(other.success).toBe(false);
    });

    it("sigue las mismas reglas de disponibilidad: no se puede reservar un horario ocupado", async () => {
      const start = futureSlot();
      const taken = await createBookingForPlayer({ fromDateTime: start, courtId, bookerId: ana.id });
      expect(taken.success).toBe(true);

      const result = await createClassBooking({ courtId, fromDateTime: start, classCapacity: 4 });

      expect(result.success).toBe(false);
    });

    it("el cupo va de 1 a 8 alumnos", async () => {
      for (const classCapacity of [0, 9, 2.5]) {
        expect(await createClassBooking({ courtId, fromDateTime: futureSlot(), classCapacity })).toEqual({
          success: false,
          error: "El cupo de la clase tiene que ser de 1 a 8 alumnos.",
        });
      }
    });

    it("la base también rechaza un cupo fuera de rango", async () => {
      const id = await newClass(2);
      const dataSource = await getDataSource();

      await expect(dataSource.getRepository<Booking>("Booking").update(id, { classCapacity: 9 })).rejects.toBeInstanceOf(
        QueryFailedError,
      );
    });

    it("solo un profesor activo reserva clases", async () => {
      signInAs(ana.email);

      expect(await createClassBooking({ courtId, fromDateTime: futureSlot(), classCapacity: 2 })).toEqual({
        success: false,
        error: "Acceso denegado: Se requiere el rol de Profesor",
      });
    });
  });

  describe("las clases no mueven puntos", () => {
    it("al terminar, el job de asistencia no le suma puntos al profesor", async () => {
      const id = await newClass(2);
      await moveToPast(id);
      const before = await pointsMovementsOf(teacher.id);

      await awardAttendancePoints();

      expect(await pointsMovementsOf(teacher.id)).toBe(before);
    });

    it("cancelarla a último momento no lo penaliza", async () => {
      const start = new Date(Date.now() + 2 * HOUR);
      start.setMinutes(0, 0, 0);
      const id = await newClass(2, start);
      const before = await pointsMovementsOf(teacher.id);

      const result = await updateBooking(id, { bookingState: BookingState.CANCELLED });

      expect(result.success).toBe(true);
      expect(await pointsMovementsOf(teacher.id)).toBe(before);
    });
  });

  describe("los alumnos (HU-44)", () => {
    it("el profesor busca jugadores registrados por nombre o email, sin incluirse", async () => {
      const result = await searchStudents("Clase");

      if (!result.success) throw new Error(result.error);
      const ids = result.data.map((p) => p.id);
      expect(ids).toEqual(expect.arrayContaining([ana.id, bruno.id]));
      expect(ids).not.toContain(teacher.id);
      expect(result.data.find((p) => p.id === ana.id)).toEqual({
        id: ana.id,
        names: "Ana",
        lastnames: "Clase",
        email: ana.email,
      });
    });

    it("una búsqueda de menos de 2 letras no trae nada", async () => {
      expect(await searchStudents("a")).toEqual({ success: true, data: [] });
    });

    it("agrega alumnos hasta el cupo de la clase", async () => {
      const id = await newClass(2);

      expect(await addClassStudent(id, ana.id)).toEqual({ success: true, data: null });
      expect(await addClassStudent(id, bruno.id)).toEqual({ success: true, data: null });
      expect(await addClassStudent(id, carla.id)).toEqual({ success: false, error: "La clase ya está completa." });
    });

    it("no registra dos veces al mismo alumno", async () => {
      const id = await newClass(4);
      await addClassStudent(id, ana.id);

      expect(await addClassStudent(id, ana.id)).toEqual({
        success: false,
        error: "Ese alumno ya está registrado en la clase.",
      });
    });

    it("la base tampoco deja repetir un alumno en la misma clase", async () => {
      const id = await newClass(4);
      await addClassStudent(id, ana.id);
      const dataSource = await getDataSource();
      const students = dataSource.getRepository<ClassStudent>("ClassStudent");

      await expect(
        students.save(students.create({ booking: { id }, player: { id: ana.id } })),
      ).rejects.toBeInstanceOf(QueryFailedError);
    });

    it("el profesor no se registra como alumno de su propia clase", async () => {
      const id = await newClass(4);

      expect(await addClassStudent(id, teacher.id)).toEqual({
        success: false,
        error: "No podés registrarte como alumno de tu propia clase.",
      });
    });

    it("quita alumnos mientras la clase no empezó, y libera su lugar", async () => {
      const id = await newClass(1);
      await addClassStudent(id, ana.id);

      expect(await removeClassStudent(id, ana.id)).toEqual({ success: true, data: null });
      expect(await addClassStudent(id, bruno.id)).toEqual({ success: true, data: null });
    });

    it("una vez empezada la clase ya no se agregan ni quitan alumnos", async () => {
      const id = await newClass(4);
      await addClassStudent(id, ana.id);
      await moveToPast(id, 1);

      const started = { success: false, error: "La clase ya empezó: no se pueden cambiar los alumnos." };
      expect(await addClassStudent(id, bruno.id)).toEqual(started);
      expect(await removeClassStudent(id, ana.id)).toEqual(started);
    });

    it("un profesor no maneja los alumnos de la clase de otro, ni de un turno que no es clase", async () => {
      const id = await newClass(4);
      const otherTeacher = await newPlayer("Otro");
      await makeTeacher(otherTeacher);
      signInAs(otherTeacher.email);

      expect(await addClassStudent(id, ana.id)).toEqual({ success: false, error: "La clase no existe." });

      signInAs(teacher.email);
      const regular = await createBookingForPlayer({ fromDateTime: futureSlot(), courtId, bookerId: teacher.id });
      if (!regular.success) throw new Error(regular.error);
      expect(await addClassStudent(regular.data.id, ana.id)).toEqual({ success: false, error: "La clase no existe." });
    });

    it("no se agregan alumnos a una clase cancelada", async () => {
      const id = await newClass(4);
      await updateBooking(id, { bookingState: BookingState.CANCELLED });

      expect(await addClassStudent(id, ana.id)).toEqual({ success: false, error: "La clase fue cancelada." });
    });

    it("devuelve error si el alumno no es un jugador registrado", async () => {
      const id = await newClass(4);

      expect(await addClassStudent(id, 999_999)).toEqual({ success: false, error: "El alumno no existe." });
    });
  });

  describe("getTeacherClasses", () => {
    it("trae los próximos turnos de clase del profesor, por fecha, con sus alumnos y el cupo", async () => {
      const later = await newClass(3, futureSlot(40));
      const sooner = await newClass(2, futureSlot(30));
      await addClassStudent(sooner, ana.id);

      const result = await getTeacherClasses();

      if (!result.success) throw new Error(result.error);
      const ids = result.data.map((c) => c.id);
      expect(ids.indexOf(sooner)).toBeLessThan(ids.indexOf(later));
      expect(result.data.find((c) => c.id === sooner)).toMatchObject({
        courtNumber: expect.any(Number),
        classCapacity: 2,
        durationMinutes: 90,
        isFinished: false,
        students: [{ id: ana.id, names: "Ana", lastnames: "Clase", email: ana.email }],
      });
    });

    it("trae como finalizadas las que terminaron en los últimos 7 días, pero no las más viejas (HU-46)", async () => {
      const recent = await newClass(2);
      await addClassStudent(recent, ana.id);
      await moveToPast(recent, 3);
      const old = await newClass(2);
      await moveToPast(old, 8 * 24 + 3);

      const result = await getTeacherClasses();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((c) => c.id === recent)).toMatchObject({ isFinished: true, students: [{ id: ana.id }] });
      expect(result.data.some((c) => c.id === old)).toBe(false);
    });

    it("una clase en curso todavía no está finalizada", async () => {
      const ongoing = await newClass(2);
      await moveToPast(ongoing, 1);

      const result = await getTeacherClasses();

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((c) => c.id === ongoing)).toMatchObject({ isFinished: false });
    });

    it("no trae las clases canceladas", async () => {
      const id = await newClass(2);
      await updateBooking(id, { bookingState: BookingState.CANCELLED });

      const result = await getTeacherClasses();

      if (!result.success) throw new Error(result.error);
      expect(result.data.some((c) => c.id === id)).toBe(false);
    });
  });

  describe("getTeacherStudents (HU-45)", () => {
    async function freshTeacher() {
      const profe = await newPlayer("Profe");
      await makeTeacher(profe);
      signInAs(profe.email);
      return profe;
    }

    async function classOf(capacity: number, start = futureSlot()) {
      const created = await createClassBooking({ courtId, fromDateTime: start, classCapacity: capacity });
      if (!created.success) throw new Error(created.error);
      return created.data.id;
    }

    it("lista a cada alumno una vez, con su contacto, la cantidad de clases que ya tuvo y la fecha de la última", async () => {
      await freshTeacher();
      const first = await classOf(4);
      const second = await classOf(4);
      const upcoming = await classOf(4);
      for (const id of [first, second]) await addClassStudent(id, ana.id);
      await addClassStudent(upcoming, ana.id);
      await addClassStudent(upcoming, bruno.id);
      await moveToPast(first, 50);
      await moveToPast(second, 3);
      const dataSource = await getDataSource();
      const secondStart = (await dataSource.getRepository<Booking>("Booking").findOneByOrFail({ id: second })).fromDateTime;

      const result = await getTeacherStudents();

      if (!result.success) throw new Error(result.error);
      expect(result.data).toEqual([
        {
          id: ana.id,
          names: "Ana",
          lastnames: "Clase",
          email: ana.email,
          phoneNumber: expect.any(String),
          classesCount: 2,
          lastClassAt: new Date(secondStart),
        },
        {
          id: bruno.id,
          names: "Bruno",
          lastnames: "Clase",
          email: bruno.email,
          phoneNumber: expect.any(String),
          classesCount: 0,
          lastClassAt: null,
        },
      ]);
    });

    it("no incluye a los alumnos de clases canceladas ni a los de otros profesores", async () => {
      const profe = await freshTeacher();
      const cancelled = await classOf(4);
      await addClassStudent(cancelled, carla.id);
      await updateBooking(cancelled, { bookingState: BookingState.CANCELLED });
      const kept = await classOf(4);
      await addClassStudent(kept, ana.id);
      await freshTeacher();
      const theirs = await classOf(4);
      await addClassStudent(theirs, bruno.id);
      signInAs(profe.email);

      const result = await getTeacherStudents();

      if (!result.success) throw new Error(result.error);
      expect(result.data.map((s) => s.id)).toEqual([ana.id]);
    });

    it("solo un profesor ve su listado", async () => {
      signInAs(ana.email);

      expect(await getTeacherStudents()).toEqual({
        success: false,
        error: "Acceso denegado: Se requiere el rol de Profesor",
      });
    });
  });

  describe("las clases del alumno (HU-47)", () => {
    it("Mis turnos del alumno trae las clases en las que está registrado, con el profesor", async () => {
      const id = await newClass(4);
      await addClassStudent(id, carla.id);

      const bookings = await getPlayerBookings(carla.id);

      const lesson = bookings.find((b) => b.id === id);
      expect(lesson).toMatchObject({ classCapacity: 4, booker: { id: teacher.id, names: "Profe" } });
      expect(lesson?.classStudents.map((s) => s.player.id)).toEqual([carla.id]);
    });

    it("el alumno sale de la clase mientras no empezó, y libera su lugar", async () => {
      const id = await newClass(1);
      await addClassStudent(id, carla.id);
      signInAs(carla.email);

      expect(await leaveClass(id)).toEqual({ success: true, data: null });

      expect((await getPlayerBookings(carla.id)).some((b) => b.id === id)).toBe(false);
      signInAs(teacher.email);
      expect(await addClassStudent(id, bruno.id)).toEqual({ success: true, data: null });
    });

    it("no sale de una clase que ya empezó, ni de una en la que no está", async () => {
      const started = await newClass(4);
      await addClassStudent(started, carla.id);
      await moveToPast(started, 1);
      const other = await newClass(4);
      signInAs(carla.email);

      expect(await leaveClass(started)).toEqual({ success: false, error: "La clase ya empezó: no podés salir." });
      expect(await leaveClass(other)).toEqual({ success: false, error: "No estás registrado en esa clase." });
    });

    it("sin sesión no puede salir de una clase", async () => {
      vi.mocked(getServerSession).mockResolvedValue(null);

      expect(await leaveClass(1)).toEqual({ success: false, error: "Tenés que iniciar sesión." });
    });
  });

  describe("supervisión desde el panel (HU-48)", () => {
    it("la grilla del admin trae cada clase con su cupo y sus alumnos", async () => {
      const id = await newClass(3);
      await addClassStudent(id, ana.id);
      signInAs(staffEmail, Role.ADMIN);

      const board = await getScheduleBoardData();

      if (!board.success) throw new Error(board.error);
      const lesson = board.data.bookings.find((b) => b.id === id);
      expect(lesson).toMatchObject({ classCapacity: 3, booker: { id: teacher.id } });
      expect(lesson?.classStudents.map((s) => s.player.names)).toEqual(["Ana"]);
    });

    it("el admin ve las clases de un profesor, como su agenda", async () => {
      const upcoming = await newClass(3);
      await addClassStudent(upcoming, ana.id);
      signInAs(staffEmail, Role.ADMIN);

      const result = await getTeacherClassesAdmin(teacherId);

      if (!result.success) throw new Error(result.error);
      expect(result.data.find((c) => c.id === upcoming)).toMatchObject({
        classCapacity: 3,
        isFinished: false,
        students: [{ id: ana.id }],
      });
    });

    it("un jugador no ve las clases de un profesor desde el panel", async () => {
      signInAs(ana.email);

      expect(await getTeacherClassesAdmin(teacherId)).toEqual({
        success: false,
        error: "Acceso denegado: Se requieren permisos de Administrador",
      });
    });

    it("devuelve error si el profesor no existe", async () => {
      signInAs(staffEmail, Role.ADMIN);

      expect(await getTeacherClassesAdmin(999_999)).toEqual({ success: false, error: "El profesor no existe." });
    });
  });

  describe("cuando el profesor cancela una clase desde Mis reservas", () => {
    it("se les avisa a los alumnos registrados", async () => {
      const id = await newClass(4);
      await addClassStudent(id, ana.id);
      await addClassStudent(id, bruno.id);
      vi.clearAllMocks();

      expect(await updateBooking(id, { bookingState: BookingState.CANCELLED })).toMatchObject({ success: true });

      const recipients = notify.mock.calls.flatMap((call) => (call as unknown[])[0] as { names: string }[]);
      expect(recipients.map((r) => r.names).sort()).toEqual(["Ana", "Bruno"]);
    });
  });

  describe("al desactivar al profesor o quitarle el rol", () => {
    async function newTeacherWithClass() {
      const profe = await newPlayer("Profe");
      const row = await makeTeacher(profe);
      signInAs(profe.email);
      const future = await createClassBooking({ courtId, fromDateTime: futureSlot(), classCapacity: 4 });
      const past = await createClassBooking({ courtId, fromDateTime: futureSlot(), classCapacity: 4 });
      if (!future.success || !past.success) throw new Error("no se pudieron crear las clases");
      await addClassStudent(future.data.id, ana.id);
      await addClassStudent(future.data.id, bruno.id);
      await moveToPast(past.data.id);
      vi.clearAllMocks();
      signInAs(staffEmail, Role.ADMIN);
      return { teacherId: row.id, futureId: future.data.id, pastId: past.data.id };
    }

    async function stateOf(id: number) {
      const dataSource = await getDataSource();
      return (await dataSource.getRepository<Booking>("Booking").findOneByOrFail({ id })).bookingState;
    }

    it("desactivarlo cancela sus clases futuras, sin tocar las pasadas, y avisa a los alumnos", async () => {
      const { teacherId: id, futureId, pastId } = await newTeacherWithClass();

      expect(await setTeacherActive(id, false)).toMatchObject({ success: true });

      expect(await stateOf(futureId)).toBe(BookingState.CANCELLED);
      expect(await stateOf(pastId)).toBe(BookingState.RESERVED);
      const recipients = notify.mock.calls.flatMap((call) => (call as unknown[])[0] as { names: string }[]);
      expect(recipients.map((r) => r.names).sort()).toEqual(["Ana", "Bruno"]);
    });

    it("quitarle el rol también cancela sus clases futuras", async () => {
      const { teacherId: id, futureId } = await newTeacherWithClass();

      expect(await removeTeacherRole(id)).toEqual({ success: true, data: null });

      expect(await stateOf(futureId)).toBe(BookingState.CANCELLED);
    });

    it("reactivarlo no cancela nada", async () => {
      const { teacherId: id, futureId } = await newTeacherWithClass();

      await setTeacherActive(id, true);

      expect(await stateOf(futureId)).toBe(BookingState.RESERVED);
      expect(notify).not.toHaveBeenCalled();
    });
  });

  it("el profesor de estos tests sigue activo", async () => {
    const dataSource = await getDataSource();
    expect((await dataSource.getRepository<Teacher>("Teacher").findOneByOrFail({ id: teacherId })).isActive).toBe(true);
  });
});
