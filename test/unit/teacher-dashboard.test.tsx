// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getTeacherClasses, getTeacherStudents, searchStudents, addClassStudent, removeClassStudent } = vi.hoisted(() => ({
  getTeacherClasses: vi.fn(),
  getTeacherStudents: vi.fn(),
  searchStudents: vi.fn(),
  addClassStudent: vi.fn(),
  removeClassStudent: vi.fn(),
}));

vi.mock("@/src/actions/teacherClass", () => ({
  getTeacherClasses,
  getTeacherStudents,
  searchStudents,
  addClassStudent,
  removeClassStudent,
}));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { TeacherDashboard } from "@/app/teacher/teacher-dashboard";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };
const bruno = { id: 22, names: "Bruno", lastnames: "Alumno", email: "bruno@test.com" };

const students = [
  { ...ana, phoneNumber: "2215550021", classesCount: 3, lastClassAt: new Date(2026, 9, 10, 18, 0) },
  { ...bruno, phoneNumber: "2215550022", classesCount: 0, lastClassAt: null },
];

function lesson(overrides = {}) {
  return {
    id: 7,
    fromDateTime: new Date(2099, 9, 14, 18, 0),
    durationMinutes: 90,
    courtNumber: 3,
    classCapacity: 2,
    isFinished: false,
    students: [bruno],
    ...overrides,
  };
}

function renderDashboard(classes = [lesson()]) {
  return render(<TeacherDashboard classes={classes} students={students} />);
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
    getTeacherClasses.mockResolvedValue({ success: true, data: [lesson({ students: [bruno, ana] })] });
    getTeacherStudents.mockResolvedValue({ success: true, data: students });
  });

  afterEach(() => {
    cleanup();
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
    render(<TeacherDashboard classes={[]} students={[]} />);

    expect(within(studentsTab()).getByText("Todavía no registraste alumnos en tus clases.")).toBeTruthy();
  });

  it("agrega rápido a un alumno a un próximo turno de clase con lugar, y actualiza la agenda", async () => {
    addClassStudent.mockResolvedValue({ success: true, data: null });
    renderDashboard();
    const anaRow = rowOf(studentsTab(), "Ana Alumna");

    fireEvent.change(within(anaRow).getByLabelText("Clase para Ana Alumna"), { target: { value: "7" } });
    fireEvent.click(within(anaRow).getByRole("button", { name: "Agregar a Ana Alumna a la clase" }));

    await waitFor(() => expect(addClassStudent).toHaveBeenCalledWith(7, 21));
    await waitFor(() => expect(getTeacherClasses).toHaveBeenCalled());
    expect(getTeacherStudents).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("tab", { name: "Agenda" }));
    expect(await within(screen.getByRole("tabpanel", { name: "Agenda" })).findByText("2/2 alumnos · completa")).toBeTruthy();
  });

  it("solo ofrece próximas clases con lugar en las que el alumno no está", () => {
    const full = lesson({ id: 8, courtNumber: 4, classCapacity: 1, students: [bruno] });
    const finished = lesson({ id: 9, courtNumber: 5, isFinished: true, students: [] });
    renderDashboard([lesson(), full, finished]);
    const panel = studentsTab();

    const anaOptions = [...(within(rowOf(panel, "Ana Alumna")).getByLabelText("Clase para Ana Alumna") as HTMLSelectElement).options];
    expect(anaOptions.map((o) => o.value)).toEqual(["", "7"]);
    expect(anaOptions[1].textContent).toContain("Cancha 3");

    // Bruno ya está en la 7 y la 8 está completa: no hay clases para ofrecerle.
    expect(within(rowOf(panel, "Bruno Alumno")).queryByLabelText("Clase para Bruno Alumno")).toBeNull();
    expect(within(rowOf(panel, "Bruno Alumno")).getByText("Sin clases con lugar")).toBeTruthy();
  });

  it("un cambio en la agenda también actualiza las clases que ofrece el listado", async () => {
    removeClassStudent.mockResolvedValue({ success: true, data: null });
    getTeacherClasses.mockResolvedValue({ success: true, data: [lesson({ students: [bruno] })] });
    renderDashboard([lesson({ students: [bruno, ana] })]);

    const agenda = screen.getByRole("tabpanel", { name: "Agenda" });
    fireEvent.click(within(agenda).getByRole("button", { name: "Quitar a Ana Alumna de la clase" }));
    await waitFor(() => expect(getTeacherStudents).toHaveBeenCalled());

    const anaRow = rowOf(studentsTab(), "Ana Alumna");
    expect(await within(anaRow).findByLabelText("Clase para Ana Alumna")).toBeTruthy();
  });

  it("muestra el error si no se pudo agregar", async () => {
    addClassStudent.mockResolvedValue({ success: false, error: "La clase ya está completa." });
    renderDashboard();
    const panel = studentsTab();
    const anaRow = rowOf(panel, "Ana Alumna");

    fireEvent.change(within(anaRow).getByLabelText("Clase para Ana Alumna"), { target: { value: "7" } });
    fireEvent.click(within(anaRow).getByRole("button", { name: "Agregar a Ana Alumna a la clase" }));

    expect(await within(panel).findByText("La clase ya está completa.")).toBeTruthy();
  });
});
