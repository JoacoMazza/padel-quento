// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { setBookingAttendance, setMatchPlayerAttendance } = vi.hoisted(() => ({
  setBookingAttendance: vi.fn(),
  setMatchPlayerAttendance: vi.fn(),
}));

vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance, setMatchPlayerAttendance }));

import { AttendanceModal } from "@/app/admin/attendance-modal";
import { BookingState } from "@/src/domain/enums";
import type { AdminBookingProp } from "@/app/admin/types";

function simpleBooking(overrides: Partial<AdminBookingProp> = {}): AdminBookingProp {
  return {
    id: 10,
    fromDateTime: new Date("2026-10-05T18:00:00"),
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    price: 10000,
    needPlayers: false,
    courtId: 1,
    confirmedPlayers: 4,
    playerId: 1,
    playerName: "Ana Gomez",
    attended: true,
    matchPlayers: [],
    ...overrides,
  };
}

function openMatchBooking(overrides: Partial<AdminBookingProp> = {}): AdminBookingProp {
  return simpleBooking({
    needPlayers: false,
    confirmedPlayers: 4,
    matchPlayers: [
      { id: 100, playerId: 1, playerName: "Ana Gomez", attended: true },
      { id: 101, playerId: 2, playerName: "Luis Pérez", attended: true },
    ],
    ...overrides,
  });
}

describe("AttendanceModal", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it("muestra al jugador de un turno simple como presente por defecto", () => {
    render(<AttendanceModal booking={simpleBooking()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    expect(screen.getByText("Ana Gomez")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Presente" })).toBeTruthy();
  });

  it("marca al jugador como ausente y avisa al padre", async () => {
    setBookingAttendance.mockResolvedValueOnce({ success: true, data: { id: 10, attended: false } });
    const onUpdated = vi.fn();
    render(<AttendanceModal booking={simpleBooking()} onClose={vi.fn()} onUpdated={onUpdated} />);

    fireEvent.click(screen.getByRole("button", { name: "Presente" }));

    await waitFor(() => expect(setBookingAttendance).toHaveBeenCalledWith(10, false));
    expect(onUpdated).toHaveBeenCalledWith(expect.objectContaining({ id: 10, attended: false }));
  });

  it("muestra el error si falla al marcar la asistencia", async () => {
    setBookingAttendance.mockResolvedValueOnce({ success: false, error: "No se pudo actualizar la asistencia." });
    render(<AttendanceModal booking={simpleBooking()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Presente" }));

    await waitFor(() =>
      expect(screen.getByText("No se pudo actualizar la asistencia.")).toBeTruthy(),
    );
  });

  it("lista a cada jugador del partido abierto con su propio control", () => {
    render(<AttendanceModal booking={openMatchBooking()} onClose={vi.fn()} onUpdated={vi.fn()} />);

    expect(screen.getByText("Ana Gomez")).toBeTruthy();
    expect(screen.getByText("Luis Pérez")).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Presente" })).toHaveLength(2);
  });

  it("marca la ausencia de un jugador puntual del partido sin tocar al resto", async () => {
    setMatchPlayerAttendance.mockResolvedValueOnce({ success: true, data: { id: 101, attended: false } });
    const onUpdated = vi.fn();
    render(<AttendanceModal booking={openMatchBooking()} onClose={vi.fn()} onUpdated={onUpdated} />);

    const buttons = screen.getAllByRole("button", { name: "Presente" });
    fireEvent.click(buttons[1]);

    await waitFor(() => expect(setMatchPlayerAttendance).toHaveBeenCalledWith(101, false));
    expect(onUpdated).toHaveBeenCalledWith(
      expect.objectContaining({
        matchPlayers: [
          { id: 100, playerId: 1, playerName: "Ana Gomez", attended: true },
          { id: 101, playerId: 2, playerName: "Luis Pérez", attended: false },
        ],
      }),
    );
  });

  it("llama a onClose al hacer click en cerrar", () => {
    const onClose = vi.fn();
    render(<AttendanceModal booking={simpleBooking()} onClose={onClose} onUpdated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    expect(onClose).toHaveBeenCalled();
  });
});
