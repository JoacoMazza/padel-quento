// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getTeacherClasses, searchStudents, addClassStudent, removeClassStudent } = vi.hoisted(() => ({
  getTeacherClasses: vi.fn(),
  searchStudents: vi.fn(),
  addClassStudent: vi.fn(),
  removeClassStudent: vi.fn(),
}));

vi.mock("@/src/actions/teacherClass", () => ({ getTeacherClasses, searchStudents, addClassStudent, removeClassStudent }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

import { TeacherClassesBoard } from "@/app/teacher/teacher-classes-board";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };
const bruno = { id: 22, names: "Bruno", lastnames: "Alumno", email: "bruno@test.com" };

function lesson(overrides = {}) {
  return {
    id: 7,
    fromDateTime: new Date(2026, 9, 14, 18, 0),
    durationMinutes: 90,
    courtNumber: 3,
    classCapacity: 2,
    students: [ana],
    ...overrides,
  };
}

function classCard() {
  return screen.getByRole("article", { name: /Cancha 3/ });
}

describe("TeacherClassesBoard (HU-44)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getTeacherClasses.mockResolvedValue({ success: true, data: [lesson()] });
  });

  afterEach(() => {
    cleanup();
  });

  it("sin clases, invita a reservar una", () => {
    render(<TeacherClassesBoard classes={[]} />);

    expect(screen.getByText("Todavía no tenés turnos de clase.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Reservar clase" }).getAttribute("href")).toBe("/teacher/book");
  });

  it("muestra cada turno de clase con día, horario, cancha, alumnos registrados y lugares libres", () => {
    render(<TeacherClassesBoard classes={[lesson()]} />);

    const card = classCard();
    expect(within(card).getByText(/miércoles, 14 de octubre/i)).toBeTruthy();
    expect(within(card).getByText("18:00 – 19:30")).toBeTruthy();
    expect(within(card).getByText("1/2 alumnos · 1 lugar libre")).toBeTruthy();
    expect(within(card).getByText("Ana Alumna")).toBeTruthy();
  });

  it("busca jugadores y agrega uno a la clase", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [bruno] });
    addClassStudent.mockResolvedValue({ success: true, data: null });
    getTeacherClasses.mockResolvedValue({ success: true, data: [lesson({ students: [ana, bruno] })] });
    render(<TeacherClassesBoard classes={[lesson()]} />);

    fireEvent.change(within(classCard()).getByLabelText("Buscar alumno"), { target: { value: "bru" } });
    fireEvent.click(await within(classCard()).findByRole("button", { name: "Agregar a Bruno Alumno" }));

    await waitFor(() => expect(addClassStudent).toHaveBeenCalledWith(7, 22));
    expect(await within(classCard()).findByText("2/2 alumnos · completa")).toBeTruthy();
    expect(searchStudents).toHaveBeenCalledWith("bru");
  });

  it("si una búsqueda vieja responde después de una nueva, muestra los resultados de la última", async () => {
    let answerOld: (value: unknown) => void = () => {};
    searchStudents
      .mockImplementationOnce(() => new Promise((resolve) => (answerOld = resolve)))
      .mockResolvedValueOnce({ success: true, data: [bruno] });
    render(<TeacherClassesBoard classes={[lesson()]} />);
    const input = within(classCard()).getByLabelText("Buscar alumno");

    fireEvent.change(input, { target: { value: "an" } });
    fireEvent.change(input, { target: { value: "bru" } });
    expect(await within(classCard()).findByRole("button", { name: "Agregar a Bruno Alumno" })).toBeTruthy();
    answerOld({ success: true, data: [{ ...ana, id: 99, names: "Andrés" }] });

    await waitFor(() => expect(searchStudents).toHaveBeenCalledTimes(2));
    expect(within(classCard()).queryByRole("button", { name: /Andrés/ })).toBeNull();
  });

  it("después de agregar a un alumno, una búsqueda que responde tarde no vuelve a mostrar resultados", async () => {
    let answerLate: (value: unknown) => void = () => {};
    searchStudents
      .mockResolvedValueOnce({ success: true, data: [bruno] })
      .mockImplementationOnce(() => new Promise((resolve) => (answerLate = resolve)));
    addClassStudent.mockResolvedValue({ success: true, data: null });
    render(<TeacherClassesBoard classes={[lesson()]} />);
    const input = within(classCard()).getByLabelText("Buscar alumno");

    fireEvent.change(input, { target: { value: "bru" } });
    const add = await within(classCard()).findByRole("button", { name: "Agregar a Bruno Alumno" });
    fireEvent.change(input, { target: { value: "brun" } });
    fireEvent.click(add);
    await waitFor(() => expect(addClassStudent).toHaveBeenCalled());
    await waitFor(() => expect((input as HTMLInputElement).value).toBe(""));
    answerLate({ success: true, data: [bruno] });

    await waitFor(() => expect(searchStudents).toHaveBeenCalledTimes(2));
    expect(within(classCard()).queryByRole("button", { name: "Agregar a Bruno Alumno" })).toBeNull();
  });

  it("no busca con menos de 2 letras", () => {
    render(<TeacherClassesBoard classes={[lesson()]} />);

    fireEvent.change(within(classCard()).getByLabelText("Buscar alumno"), { target: { value: "b" } });

    expect(searchStudents).not.toHaveBeenCalled();
  });

  it("en los resultados no ofrece a los que ya están en la clase", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [ana, bruno] });
    render(<TeacherClassesBoard classes={[lesson()]} />);

    fireEvent.change(within(classCard()).getByLabelText("Buscar alumno"), { target: { value: "alum" } });

    expect(await within(classCard()).findByRole("button", { name: "Agregar a Bruno Alumno" })).toBeTruthy();
    expect(within(classCard()).queryByRole("button", { name: "Agregar a Ana Alumna" })).toBeNull();
  });

  it("con la clase completa no deja buscar más alumnos", () => {
    render(<TeacherClassesBoard classes={[lesson({ students: [ana, bruno] })]} />);

    expect(within(classCard()).queryByLabelText("Buscar alumno")).toBeNull();
    expect(within(classCard()).getByText("2/2 alumnos · completa")).toBeTruthy();
  });

  it("quita a un alumno", async () => {
    removeClassStudent.mockResolvedValue({ success: true, data: null });
    getTeacherClasses.mockResolvedValue({ success: true, data: [lesson({ students: [] })] });
    render(<TeacherClassesBoard classes={[lesson()]} />);

    fireEvent.click(within(classCard()).getByRole("button", { name: "Quitar a Ana Alumna de la clase" }));

    await waitFor(() => expect(removeClassStudent).toHaveBeenCalledWith(7, 21));
    expect(await within(classCard()).findByText("0/2 alumnos · 2 lugares libres")).toBeTruthy();
  });

  it("muestra el error si no se pudo agregar", async () => {
    searchStudents.mockResolvedValue({ success: true, data: [bruno] });
    addClassStudent.mockResolvedValue({ success: false, error: "La clase ya está completa." });
    render(<TeacherClassesBoard classes={[lesson()]} />);

    fireEvent.change(within(classCard()).getByLabelText("Buscar alumno"), { target: { value: "bru" } });
    fireEvent.click(await within(classCard()).findByRole("button", { name: "Agregar a Bruno Alumno" }));

    expect(await within(classCard()).findByText("La clase ya está completa.")).toBeTruthy();
  });
});
