// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, within } from "@testing-library/react";
import { TeacherClassesBoard } from "@/app/teacher/teacher-classes-board";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };

function session(overrides = {}) {
  return {
    id: 7,
    lessonId: 1,
    fromDateTime: new Date(2026, 9, 14, 18, 0),
    durationMinutes: 90,
    courtNumber: 3,
    classCapacity: 2,
    isFinished: false,
    students: [ana],
    ...overrides,
  };
}

function classCard() {
  return screen.getByRole("article", { name: /Cancha 3/ });
}

describe("TeacherClassesBoard (agenda, HU-46)", () => {
  afterEach(() => {
    cleanup();
  });

  it("sin turnos, explica que el club le asigna las clases", () => {
    render(<TeacherClassesBoard classes={[]} />);

    expect(screen.getByText("Todavía no tenés turnos de clase. El club te asigna las clases desde el panel.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Reservar clase" })).toBeNull();
  });

  it("muestra cada turno con día, horario, cancha, alumnos inscriptos y lugares libres", () => {
    render(<TeacherClassesBoard classes={[session()]} />);

    const card = classCard();
    expect(within(card).getByText(/miércoles, 14 de octubre/i)).toBeTruthy();
    expect(within(card).getByText("18:00 – 19:30")).toBeTruthy();
    expect(within(card).getByText("1/2 alumnos · 1 lugar libre")).toBeTruthy();
    expect(within(card).getByText("Ana Alumna")).toBeTruthy();
  });

  it("los alumnos se manejan desde la clase: la agenda no los cambia", () => {
    render(<TeacherClassesBoard classes={[session()]} />);

    expect(within(classCard()).queryByLabelText("Buscar alumno")).toBeNull();
    expect(within(classCard()).queryByRole("button", { name: /Quitar/ })).toBeNull();
  });

  it("muestra los turnos que ya terminaron aparte, como Finalizado (HU-46)", () => {
    const finished = session({ id: 5, courtNumber: 1, fromDateTime: new Date(2026, 9, 10, 18, 0), isFinished: true });
    render(<TeacherClassesBoard classes={[finished, session()]} />);

    const upcoming = screen.getByRole("region", { name: "Próximas clases" });
    const done = screen.getByRole("region", { name: "Finalizadas" });
    expect(within(upcoming).getByRole("article", { name: /Cancha 3/ })).toBeTruthy();
    const card = within(done).getByRole("article", { name: /Cancha 1/ });
    expect(within(card).getByText("Finalizado")).toBeTruthy();
    expect(within(card).getByText("Ana Alumna")).toBeTruthy();
  });

  it("sin turnos próximos pero con finalizados, lo dice y muestra los finalizados", () => {
    render(<TeacherClassesBoard classes={[session({ isFinished: true })]} />);

    expect(screen.getByText("No tenés próximos turnos de clase.")).toBeTruthy();
    expect(within(screen.getByRole("region", { name: "Finalizadas" })).getByText("Finalizado")).toBeTruthy();
  });
});
