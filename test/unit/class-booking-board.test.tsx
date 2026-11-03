// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { push, createClassBooking } = vi.hoisted(() => ({ push: vi.fn(), createClassBooking: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/src/actions/teacherClass", () => ({ createClassBooking }));

import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import { ClassBookingBoard } from "@/app/teacher/book/class-booking-board";

const location = {
  name: "Quento Club",
  address: "Cam. Centenario 8907",
  city: "Villa Elisa",
  mapsUrl: "https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA",
};
const courts = [{ id: 1, number: 1, state: CourtState.AVAILABLE, price: 18000, location }];
const schedules = [{ id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "18:00:00", closingTime: "21:00:00", courtId: 1 }];
const openMatch = {
  id: 50,
  fromDateTime: new Date(2026, 9, 12, 19, 30),
  durationMinutes: 90,
  bookingState: BookingState.RESERVED,
  price: 18000,
  needPlayers: true,
  courtId: 1,
  confirmedPlayers: 2,
  matchPlayerIds: [],
};

function renderBoard() {
  return render(<ClassBookingBoard courts={courts} schedules={schedules} bookings={[openMatch]} outOfServices={[]} />);
}

describe("ClassBookingBoard (HU-43)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // Lunes 12/10/2026 a las 10:00.
    vi.setSystemTime(new Date(2026, 9, 12, 10, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("muestra la disponibilidad del día en la grilla", () => {
    renderBoard();

    expect(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" })).toBeTruthy();
  });

  it("al elegir un turno libre muestra el resumen de la clase, con la cancha, el complejo y el precio de la cancha", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    const summary = screen.getByRole("complementary", { name: "Tu turno de clase" });
    expect(within(summary).getByText("Cancha 1")).toBeTruthy();
    expect(within(summary).getByRole("link", { name: "Quento Club · Cam. Centenario 8907, Villa Elisa" })).toBeTruthy();
    expect(within(summary).getByText(/18\.000/)).toBeTruthy();
  });

  it("el cupo de alumnos va de 1 a 8 y arranca en 4", () => {
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    const capacity = screen.getByLabelText("Cupo de alumnos") as HTMLSelectElement;
    expect(capacity.value).toBe("4");
    expect([...capacity.options].map((o) => o.value)).toEqual(["1", "2", "3", "4", "5", "6", "7", "8"]);
  });

  it("reserva la clase con el cupo elegido y lleva a Mis clases", async () => {
    createClassBooking.mockResolvedValue({ success: true, data: { id: 9 } });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));
    fireEvent.change(screen.getByLabelText("Cupo de alumnos"), { target: { value: "6" } });

    fireEvent.click(screen.getByRole("button", { name: /Reservar clase/ }));

    await waitFor(() =>
      expect(createClassBooking).toHaveBeenCalledWith({
        courtId: 1,
        fromDateTime: new Date(2026, 9, 12, 18, 0),
        classCapacity: 6,
      }),
    );
    await waitFor(() => expect(push).toHaveBeenCalledWith("/teacher"));
  });

  it("si no se pudo reservar, muestra el error", async () => {
    createClassBooking.mockResolvedValue({ success: false, error: "La cancha ya está reservada en ese horario." });
    renderBoard();
    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 18:00, disponible" }));

    fireEvent.click(screen.getByRole("button", { name: /Reservar clase/ }));

    expect(await screen.findByText("La cancha ya está reservada en ese horario.")).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });

  it("un turno con partido abierto no se puede elegir para una clase", () => {
    renderBoard();

    fireEvent.click(screen.getByRole("button", { name: "Cancha 1, 19:30, partido abierto" }));

    expect(screen.queryByRole("complementary", { name: "Tu turno de clase" })).toBeNull();
  });
});
