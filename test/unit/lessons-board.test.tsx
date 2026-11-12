// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { refresh, enrollInLesson, leaveLesson } = vi.hoisted(() => ({
  refresh: vi.fn(),
  enrollInLesson: vi.fn(),
  leaveLesson: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/lesson", () => ({ enrollInLesson, leaveLesson }));

import { DayOfWeek } from "@/src/domain/enums";
import type { AvailableLessonItem } from "@/src/actions/lesson";
import { LessonsBoard } from "@/app/lessons/lessons-board";

function lesson(overrides: Partial<AvailableLessonItem> = {}): AvailableLessonItem {
  return {
    id: 7,
    teacherId: 10,
    teacherName: "Lucía Profe",
    classCapacity: 4,
    price: 15000,
    fromDate: "2026-10-05",
    toDate: "2026-10-31",
    isActive: true,
    schedules: [{ courtId: 3, courtNumber: 3, dayOfWeek: DayOfWeek.TUESDAY, startTime: "10:00", endTime: "11:30" }],
    studentsCount: 1,
    isEnrolled: false,
    isOwn: false,
    ...overrides,
  };
}

function card() {
  return screen.getByRole("article", { name: "Clase con Lucía Profe" });
}

describe("LessonsBoard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("sin clases, lo dice", () => {
    render(<LessonsBoard lessons={[]} isGuest={false} />);

    expect(screen.getByText("Por ahora no hay clases abiertas.")).toBeTruthy();
  });

  it("muestra cada clase con su profesor, horarios, fechas, precio y lugares", () => {
    render(<LessonsBoard lessons={[lesson()]} isGuest={false} />);

    expect(within(card()).getByText("Martes 10:00–11:30 · Cancha 3")).toBeTruthy();
    expect(within(card()).getByText("Del 05/10/2026 al 31/10/2026")).toBeTruthy();
    expect(within(card()).getByText(/15\.000/)).toBeTruthy();
    expect(within(card()).getByText("1/4 alumnos")).toBeTruthy();
  });

  it("el jugador se inscribe y se actualiza la página", async () => {
    enrollInLesson.mockResolvedValue({ success: true, data: null });
    render(<LessonsBoard lessons={[lesson()]} isGuest={false} />);

    fireEvent.click(within(card()).getByRole("button", { name: "Inscribirme" }));

    await waitFor(() => expect(enrollInLesson).toHaveBeenCalledWith(7));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("si está inscripto, se da de baja", async () => {
    leaveLesson.mockResolvedValue({ success: true, data: null });
    render(<LessonsBoard lessons={[lesson({ isEnrolled: true })]} isGuest={false} />);

    expect(within(card()).getByText("Estás inscripto")).toBeTruthy();
    fireEvent.click(within(card()).getByRole("button", { name: "Darme de baja" }));

    await waitFor(() => expect(leaveLesson).toHaveBeenCalledWith(7));
  });

  it("una clase completa no ofrece inscribirse", () => {
    render(<LessonsBoard lessons={[lesson({ studentsCount: 4 })]} isGuest={false} />);

    expect(within(card()).getByText("Completa")).toBeTruthy();
    expect(within(card()).queryByRole("button", { name: "Inscribirme" })).toBeNull();
  });

  it("el profesor ve la clase que da, sin inscribirse", () => {
    render(<LessonsBoard lessons={[lesson({ isOwn: true })]} isGuest={false} />);

    expect(within(card()).getByText("La das vos")).toBeTruthy();
    expect(within(card()).queryByRole("button", { name: "Inscribirme" })).toBeNull();
  });

  it("sin sesión, invita a iniciar sesión para inscribirse", () => {
    render(<LessonsBoard lessons={[lesson()]} isGuest />);

    expect(within(card()).getByRole("link", { name: "Iniciá sesión para inscribirte" }).getAttribute("href")).toBe(
      "/login?callbackUrl=%2Flessons",
    );
  });

  it("muestra el error si no se pudo inscribir", async () => {
    enrollInLesson.mockResolvedValue({ success: false, error: "La clase ya está completa." });
    render(<LessonsBoard lessons={[lesson()]} isGuest={false} />);

    fireEvent.click(within(card()).getByRole("button", { name: "Inscribirme" }));

    expect(await within(card()).findByText("La clase ya está completa.")).toBeTruthy();
  });
});
