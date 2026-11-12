// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const {
  getLessonsAdmin,
  createLesson,
  deactivateLesson,
  getLessonClassesAdmin,
  addLessonStudentAdmin,
  removeLessonStudentAdmin,
  getPlayersAdmin,
  getCourts,
} = vi.hoisted(() => ({
  getLessonsAdmin: vi.fn(),
  createLesson: vi.fn(),
  deactivateLesson: vi.fn(),
  getLessonClassesAdmin: vi.fn(),
  addLessonStudentAdmin: vi.fn(),
  removeLessonStudentAdmin: vi.fn(),
  getPlayersAdmin: vi.fn(),
  getCourts: vi.fn(),
}));

vi.mock("@/src/actions/lesson", () => ({
  getLessonsAdmin,
  createLesson,
  deactivateLesson,
  getLessonClassesAdmin,
  addLessonStudentAdmin,
  removeLessonStudentAdmin,
}));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin }));
vi.mock("@/src/actions/court", () => ({ getCourts }));

import { CourtState, DayOfWeek, PlayerCategory } from "@/src/domain/enums";
import type { LessonItem } from "@/src/actions/lesson";
import { LessonsPanel } from "@/app/admin/lessons-panel";

const ana = { id: 21, names: "Ana", lastnames: "Alumna", email: "ana@test.com" };

const lucia: LessonItem = {
  id: 1,
  teacherId: 10,
  teacherName: "Lucía Profe",
  classCapacity: 4,
  price: 15000,
  fromDate: "2026-10-05",
  toDate: "2026-10-31",
  isActive: true,
  schedules: [{ courtId: 3, courtNumber: 3, dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
  students: [ana],
};
const pablo: LessonItem = { ...lucia, id: 2, teacherId: 11, teacherName: "Pablo Profe", isActive: false, students: [] };

function player(id: number, names: string, email: string) {
  return {
    id,
    names,
    lastnames: "Jugador",
    email,
    phoneNumber: `22155500${id}`,
    category: PlayerCategory.FOURTH,
    scoring: 0,
    isBlocked: false,
  };
}

function rowOf(name: string) {
  return screen.getByText(name).closest("tr")!;
}

describe("LessonsPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getLessonsAdmin.mockResolvedValue({ success: true, data: [lucia, pablo] });
    getPlayersAdmin.mockResolvedValue({
      success: true,
      data: [player(20, "Martina", "martina@test.com"), player(22, "Mateo", "mateo@test.com")],
    });
    getCourts.mockResolvedValue({
      success: true,
      data: [
        { id: 3, number: 3, state: CourtState.AVAILABLE },
        { id: 4, number: 4, state: CourtState.CLOSED_DOWN },
      ],
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("lista las clases con su profesor, horarios, fechas, alumnos y estado", () => {
    render(<LessonsPanel lessons={[lucia, pablo]} />);

    const row = within(rowOf("Lucía Profe"));
    expect(row.getByText("Martes 10:00–11:30 · Cancha 3")).toBeTruthy();
    expect(row.getByText("05/10/2026 – 31/10/2026")).toBeTruthy();
    expect(row.getByText("1/4")).toBeTruthy();
    expect(row.getByText("Activa")).toBeTruthy();
    expect(within(rowOf("Pablo Profe")).getByText("Dada de baja")).toBeTruthy();
  });

  it("sin clases, lo dice", () => {
    render(<LessonsPanel lessons={[]} />);

    expect(screen.getByText("Todavía no hay clases.")).toBeTruthy();
  });

  it("da de alta una clase asignando a un jugador registrado como profesor", async () => {
    createLesson.mockResolvedValue({ success: true, data: lucia });
    render(<LessonsPanel lessons={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva clase" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva clase" });
    fireEvent.change(await within(dialog).findByLabelText("Buscar profesor"), { target: { value: "mar" } });
    expect(within(dialog).queryByText(/Mateo/)).toBeNull();
    fireEvent.click(within(dialog).getByRole("button", { name: "Elegir a Martina Jugador" }));
    expect(within(dialog).getByText("Profesor: Martina Jugador")).toBeTruthy();

    fireEvent.change(within(dialog).getByLabelText("Cupo de alumnos"), { target: { value: "4" } });
    fireEvent.change(within(dialog).getByLabelText("Precio"), { target: { value: "15000" } });
    fireEvent.change(within(dialog).getByLabelText("Desde"), { target: { value: "2026-10-05" } });
    fireEvent.change(within(dialog).getByLabelText("Hasta"), { target: { value: "2026-10-31" } });
    const courtSelect = await within(dialog).findByLabelText("Cancha del horario 1");
    expect(within(courtSelect).queryByText("Cancha 4")).toBeNull();
    fireEvent.change(courtSelect, { target: { value: "3" } });
    fireEvent.change(within(dialog).getByLabelText("Día del horario 1"), { target: { value: DayOfWeek.TUESDAY } });
    fireEvent.change(within(dialog).getByLabelText("Inicio del horario 1"), { target: { value: "10:00" } });
    fireEvent.change(within(dialog).getByLabelText("Fin del horario 1"), { target: { value: "11:30" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear clase" }));

    await waitFor(() =>
      expect(createLesson).toHaveBeenCalledWith({
        teacherId: 20,
        classCapacity: 4,
        price: 15000,
        fromDate: "2026-10-05",
        toDate: "2026-10-31",
        schedules: [{ courtId: 3, dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(getLessonsAdmin).toHaveBeenCalled();
  });

  it("suma y quita horarios de la clase", async () => {
    render(<LessonsPanel lessons={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva clase" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva clase" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Agregar horario" }));
    expect(within(dialog).getByLabelText("Día del horario 2")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Quitar el horario 2" }));
    expect(within(dialog).queryByLabelText("Día del horario 2")).toBeNull();
  });

  it("si el alta falla, muestra el error y deja el formulario abierto", async () => {
    createLesson.mockResolvedValue({ success: false, error: "Elegí al profesor de la clase." });
    render(<LessonsPanel lessons={[]} />);

    fireEvent.click(screen.getByRole("button", { name: "Nueva clase" }));
    const dialog = screen.getByRole("dialog", { name: "Nueva clase" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Crear clase" }));

    expect(await within(dialog).findByText("Elegí al profesor de la clase.")).toBeTruthy();
  });

  it("da de baja una clase después de confirmar", async () => {
    deactivateLesson.mockResolvedValue({ success: true, data: { ...lucia, isActive: false } });
    render(<LessonsPanel lessons={[lucia]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Dar de baja la clase de Lucía Profe" }));
    expect(deactivateLesson).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Sí, dar de baja" }));

    await waitFor(() => expect(deactivateLesson).toHaveBeenCalledWith(1));
    await waitFor(() => expect(getLessonsAdmin).toHaveBeenCalled());
  });

  it("una clase dada de baja no se puede volver a dar de baja", () => {
    render(<LessonsPanel lessons={[pablo]} />);

    expect(within(rowOf("Pablo Profe")).queryByRole("button", { name: /Dar de baja/ })).toBeNull();
  });

  it("inscribe y da de baja alumnos de una clase", async () => {
    addLessonStudentAdmin.mockResolvedValue({ success: true, data: null });
    removeLessonStudentAdmin.mockResolvedValue({ success: true, data: null });
    render(<LessonsPanel lessons={[lucia]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Alumnos de la clase de Lucía Profe" }));
    const dialog = screen.getByRole("dialog", { name: "Alumnos de la clase de Lucía Profe" });
    expect(within(dialog).getByText("Ana Alumna")).toBeTruthy();

    fireEvent.click(within(dialog).getByRole("button", { name: "Dar de baja a Ana Alumna" }));
    await waitFor(() => expect(removeLessonStudentAdmin).toHaveBeenCalledWith(1, 21));

    fireEvent.change(await within(dialog).findByLabelText("Buscar alumno"), { target: { value: "mateo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Inscribir a Mateo Jugador" }));
    await waitFor(() => expect(addLessonStudentAdmin).toHaveBeenCalledWith(1, 22));
  });

  it("muestra los turnos de una clase con sus alumnos (HU-48)", async () => {
    getLessonClassesAdmin.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          lessonId: 1,
          fromDateTime: new Date(2099, 9, 13, 10, 0),
          durationMinutes: 90,
          courtNumber: 3,
          classCapacity: 4,
          isFinished: false,
          students: [ana],
        },
      ],
    });
    render(<LessonsPanel lessons={[lucia]} />);

    fireEvent.click(within(rowOf("Lucía Profe")).getByRole("button", { name: "Ver los turnos de la clase de Lucía Profe" }));

    const dialog = await screen.findByRole("dialog", { name: "Turnos de la clase de Lucía Profe" });
    expect(await within(dialog).findByText(/Cancha 3 · .* · 10:00 – 11:30/)).toBeTruthy();
    expect(within(dialog).getByText("1/4 alumnos")).toBeTruthy();
    expect(within(dialog).getByText("Ana Alumna")).toBeTruthy();
    expect(getLessonClassesAdmin).toHaveBeenCalledWith(1);
  });
});
