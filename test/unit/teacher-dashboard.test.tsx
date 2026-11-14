// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getTeacherClasses, getTeacherLessons, getTeacherStudents, searchStudents, addLessonStudent, removeLessonStudent } =
  vi.hoisted(() => ({
    getTeacherClasses: vi.fn(),
    getTeacherLessons: vi.fn(),
    getTeacherStudents: vi.fn(),
    searchStudents: vi.fn(),
    addLessonStudent: vi.fn(),
    removeLessonStudent: vi.fn(),
  }));

vi.mock("@/src/actions/teacherClass", () => ({
  getTeacherClasses,
  getTeacherLessons,
  getTeacherStudents,
  searchStudents,
  addLessonStudent,
  removeLessonStudent,
}));

import { DayOfWeek } from "@/src/domain/enums";
import type { LessonItem } from "@/src/actions/teacherClass";
import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };
const bruno = { id: 22, names: "Bruno", lastnames: "Alumno", email: "bruno@test.com" };

const students = [
  { ...ana, phoneNumber: "2215550021", classesCount: 3, lastClassAt: new Date(2026, 9, 10, 18, 0) },
  { ...bruno, phoneNumber: "2215550022", classesCount: 0, lastClassAt: null },
];

function lesson(overrides: Partial<LessonItem> = {}): LessonItem {
  return {
    id: 7,
    teacherId: 10,
    teacherName: "Lucía Profe",
    classCapacity: 2,
    price: 15000,
    fromDate: "2099-10-05",
    toDate: "2099-10-31",
    isActive: true,
    schedules: [{ courtId: 3, courtNumber: 3, dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
    students: [bruno],
    ...overrides,
  };
}

function session(students = [bruno]) {
  return {
    id: 70,
    lessonId: 7,
    fromDateTime: new Date(2099, 9, 13, 10, 0),
    durationMinutes: 90,
    courtNumber: 3,
    classCapacity: 2,
    isFinished: false,
    students,
  };
}

function renderDashboard(lessons = [lesson()]) {
  return render(<TeacherDashboard classes={[session()]} lessons={lessons} students={students} />);
}

function studentsTab() {
  fireEvent.click(screen.getByRole("tab", { name: "Alumnos" }));
  return screen.getByRole("tabpanel", { name: "Alumnos" });
}

function rowOf(panel: HTMLElement, name: string) {
  return within(panel).getByText(name).closest("tr")!;
}

describe("TeacherDashboard (HU-45 y HU-46)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeacherClasses.mockResolvedValue({ success: true, data: [session([bruno, ana])] });
    getTeacherLessons.mockResolvedValue({ success: true, data: [lesson({ students: [bruno, ana] })] });
    getTeacherStudents.mockResolvedValue({ success: true, data: students });
  });

  afterEach(() => {
    cleanup();
  });

  it("tiene la pestaña Clases con las clases que da", () => {
    renderDashboard();

    fireEvent.click(screen.getByRole("tab", { name: "Clases" }));

    expect(within(screen.getByRole("tabpanel", { name: "Clases" })).getByRole("article", { name: /Martes 10:00–11:30/ })).toBeTruthy();
  });

  it("arranca en la agenda, y la pestaña Alumnos muestra el listado", () => {
    renderDashboard();

    expect(screen.getByRole("tab", { name: "Agenda" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel", { name: "Agenda" })).toBeTruthy();

    const panel = studentsTab();
    expect(screen.getByRole("tab", { name: "Alumnos" }).getAttribute("aria-selected")).toBe("true");
    expect(within(panel).getByText("Ana Alumna")).toBeTruthy();
  });

  it("lista cada alumno con su contacto, la cantidad de clases y la fecha de la última", () => {
    renderDashboard();
    const panel = studentsTab();

    const anaRow = rowOf(panel, "Ana Alumna");
    expect(within(anaRow).getByText("ana@test.com")).toBeTruthy();
    expect(within(anaRow).getByText("2215550021")).toBeTruthy();
    expect(within(anaRow).getByText("3")).toBeTruthy();
    expect(within(anaRow).getByText("10/10/2026")).toBeTruthy();
    expect(within(rowOf(panel, "Bruno Alumno")).getByText("Sin clases todavía")).toBeTruthy();
  });

  it("sin alumnos, lo dice", () => {
    render(<TeacherDashboard classes={[]} lessons={[]} students={[]} />);

    expect(within(studentsTab()).getByText("Todavía no registraste alumnos en tus clases.")).toBeTruthy();
  });

  it("inscribe rápido a un alumno en una clase con lugar, y actualiza la agenda", async () => {
    addLessonStudent.mockResolvedValue({ success: true, data: null });
    renderDashboard();
    const anaRow = rowOf(studentsTab(), "Ana Alumna");

    fireEvent.change(within(anaRow).getByLabelText("Clase para Ana Alumna"), { target: { value: "7" } });
    fireEvent.click(within(anaRow).getByRole("button", { name: "Agregar a Ana Alumna a la clase" }));

    await waitFor(() => expect(addLessonStudent).toHaveBeenCalledWith(7, 21));
    await waitFor(() => expect(getTeacherClasses).toHaveBeenCalled());
    expect(getTeacherLessons).toHaveBeenCalled();
    expect(getTeacherStudents).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(await within(screen.getByRole("tabpanel", { name: "Agenda" })).findByText("2/2 alumnos · completa")).toBeTruthy();
  });

  it("solo ofrece clases con lugar en las que el alumno no está", () => {
    const full = lesson({
      id: 8,
      classCapacity: 1,
      students: [bruno],
      schedules: [{ courtId: 4, courtNumber: 4, dayOfWeek: DayOfWeek.FRIDAY, startTime: "18:00", endTime: "19:00" }],
    });
    renderDashboard([lesson(), full]);
    const panel = studentsTab();

    const anaOptions = [...(within(rowOf(panel, "Ana Alumna")).getByLabelText("Clase para Ana Alumna") as HTMLSelectElement).options];
    expect(anaOptions.map((o) => o.value)).toEqual(["", "7"]);
    expect(anaOptions[1].textContent).toContain("Cancha 3");

    // Bruno ya está en la 7 y la 8 está completa: no hay clases para ofrecerle.
    expect(within(rowOf(panel, "Bruno Alumno")).queryByLabelText("Clase para Bruno Alumno")).toBeNull();
    expect(within(rowOf(panel, "Bruno Alumno")).getByText("Sin clases con lugar")).toBeTruthy();
  });

  it("un cambio en las clases también actualiza las que ofrece el listado", async () => {
    removeLessonStudent.mockResolvedValue({ success: true, data: null });
    getTeacherLessons.mockResolvedValue({ success: true, data: [lesson({ students: [bruno] })] });
    renderDashboard([lesson({ students: [bruno, ana] })]);

    fireEvent.click(screen.getByRole("tab", { name: "Clases" }));
    const lessonsPanel = screen.getByRole("tabpanel", { name: "Clases" });
    fireEvent.click(within(lessonsPanel).getByRole("button", { name: "Quitar a Ana Alumna de la clase" }));
    await waitFor(() => expect(getTeacherStudents).toHaveBeenCalled());

    const anaRow = rowOf(studentsTab(), "Ana Alumna");
    expect(await within(anaRow).findByLabelText("Clase para Ana Alumna")).toBeTruthy();
  });

  it("muestra el error si no se pudo agregar", async () => {
    addLessonStudent.mockResolvedValue({ success: false, error: "La clase ya está completa." });
    renderDashboard();
    const panel = studentsTab();
    const anaRow = rowOf(panel, "Ana Alumna");

    fireEvent.change(within(anaRow).getByLabelText("Clase para Ana Alumna"), { target: { value: "7" } });
    fireEvent.click(within(anaRow).getByRole("button", { name: "Agregar a Ana Alumna a la clase" }));

    expect(await within(panel).findByText("La clase ya está completa.")).toBeTruthy();
  });
});
