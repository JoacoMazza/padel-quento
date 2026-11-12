// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getTeacherLessons, searchStudents, addLessonStudent, removeLessonStudent } = vi.hoisted(() => ({
  getTeacherLessons: vi.fn(),
  searchStudents: vi.fn(),
  addLessonStudent: vi.fn(),
  removeLessonStudent: vi.fn(),
}));

vi.mock("@/src/actions/teacherClass", () => ({ getTeacherLessons, searchStudents, addLessonStudent, removeLessonStudent }));

import { DayOfWeek } from "@/src/domain/enums";
import type { LessonItem } from "@/src/actions/teacherClass";
import { TeacherLessonsBoard } from "@/app/teacher/teacher-lessons-board";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };
const bruno = { id: 22, names: "Bruno", lastnames: "Alumno", email: "bruno@test.com" };

function lesson(overrides: Partial<LessonItem> = {}): LessonItem {
  return {
    id: 7,
    teacherId: 10,
    teacherName: "Lucía Profe",
    classCapacity: 2,
    price: 15000,
    fromDate: "2026-10-05",
    toDate: "2026-10-31",
    isActive: true,
    schedules: [{ courtId: 3, courtNumber: 3, dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
    students: [ana],
    ...overrides,
  };
}

function lessonCard() {
  return screen.getByRole("article", { name: /Martes 10:00–11:30 · Cancha 3/ });
}

describe("TeacherLessonsBoard (HU-44)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeacherLessons.mockResolvedValue({ success: true, data: [lesson()] });
  });

  afterEach(() => {
    cleanup();
  });

  it("sin clases, lo dice", () => {
    render(<TeacherLessonsBoard lessons={[]} />);

    expect(screen.getByText("No tenés clases activas.")).toBeTruthy();
  });

  it("muestra cada clase con sus horarios, fechas, alumnos y lugares libres", () => {
    render(<TeacherLessonsBoard lessons={[lesson()]} />);

    const card = lessonCard();
    expect(within(card).getByText("Del 05/10/2026 al 31/10/2026")).toBeTruthy();
    expect(within(card).getByText("1/2 alumnos · 1 lugar libre")).toBeTruthy();
    expect(within(card).getByText("Ana Alumna")).toBeTruthy();
  });

  it("busca jugadores e inscribe a uno en la clase", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [bruno] });
    addLessonStudent.mockResolvedValue({ success: true, data: null });
    getTeacherLessons.mockResolvedValue({ success: true, data: [lesson({ students: [ana, bruno] })] });
    const onChanged = vi.fn();
    render(<TeacherLessonsBoard lessons={[lesson()]} onChanged={onChanged} />);

    fireEvent.change(within(lessonCard()).getByLabelText("Buscar alumno"), { target: { value: "bru" } });
    fireEvent.click(await within(lessonCard()).findByRole("button", { name: "Agregar a Bruno Alumno" }));

    await waitFor(() => expect(addLessonStudent).toHaveBeenCalledWith(7, 22));
    expect(await within(lessonCard()).findByText("2/2 alumnos · completa")).toBeTruthy();
    expect(searchStudents).toHaveBeenCalledWith("bru");
    expect(onChanged).toHaveBeenCalled();
  });

  it("si una búsqueda vieja responde después de una nueva, muestra los resultados de la última", async () => {
    let answerOld: (value: unknown) => void = () => {};
    searchStudents
      .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
      .mockResolvedValueOnce({ success: true, data: [bruno] });
    render(<TeacherLessonsBoard lessons={[lesson()]} />);
    const input = within(lessonCard()).getByLabelText("Buscar alumno");

    fireEvent.change(input, { target: { value: "an" } });
    fireEvent.change(input, { target: { value: "bru" } });
    expect(await within(lessonCard()).findByRole("button", { name: "Agregar a Bruno Alumno" })).toBeTruthy();
    answerOld({ success: true, data: [{ ...ana, id: 99, names: "Andrés" }] });

    await waitFor(() => expect(searchStudents).toHaveBeenCalledTimes(2));
    expect(within(lessonCard()).queryByRole("button", { name: /Andrés/ })).toBeNull();
  });

  it("no busca con menos de 2 letras", () => {
    render(<TeacherLessonsBoard lessons={[lesson()]} />);

    fireEvent.change(within(lessonCard()).getByLabelText("Buscar alumno"), { target: { value: "b" } });

    expect(searchStudents).not.toHaveBeenCalled();
  });

  it("en los resultados no ofrece a los que ya están en la clase", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [ana, bruno] });
    render(<TeacherLessonsBoard lessons={[lesson()]} />);

    fireEvent.change(within(lessonCard()).getByLabelText("Buscar alumno"), { target: { value: "alum" } });

    expect(await within(lessonCard()).findByRole("button", { name: "Agregar a Bruno Alumno" })).toBeTruthy();
    expect(within(lessonCard()).queryByRole("button", { name: "Agregar a Ana Alumna" })).toBeNull();
  });

  it("con la clase completa no deja buscar más alumnos", () => {
    render(<TeacherLessonsBoard lessons={[lesson({ students: [ana, bruno] })]} />);

    expect(within(lessonCard()).queryByLabelText("Buscar alumno")).toBeNull();
    expect(within(lessonCard()).getByText("2/2 alumnos · completa")).toBeTruthy();
  });

  it("quita a un alumno de la clase", async () => {
    removeLessonStudent.mockResolvedValue({ success: true, data: null });
    getTeacherLessons.mockResolvedValue({ success: true, data: [lesson({ students: [] })] });
    render(<TeacherLessonsBoard lessons={[lesson()]} />);

    fireEvent.click(within(lessonCard()).getByRole("button", { name: "Quitar a Ana Alumna de la clase" }));

    await waitFor(() => expect(removeLessonStudent).toHaveBeenCalledWith(7, 21));
    expect(await within(lessonCard()).findByText("0/2 alumnos · 2 lugares libres")).toBeTruthy();
  });

  it("muestra el error si no se pudo agregar", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [bruno] });
    addLessonStudent.mockResolvedValue({ success: false, error: "La clase ya está completa." });
    render(<TeacherLessonsBoard lessons={[lesson()]} />);

    fireEvent.change(within(lessonCard()).getByLabelText("Buscar alumno"), { target: { value: "bru" } });
    fireEvent.click(await within(lessonCard()).findByRole("button", { name: "Agregar a Bruno Alumno" }));

    expect(await within(lessonCard()).findByText("La clase ya está completa.")).toBeTruthy();
  });
});
