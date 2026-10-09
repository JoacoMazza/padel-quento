// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const { getScheduleBoardData } = vi.hoisted(() => ({ getScheduleBoardData: vi.fn() }));

vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));

import { CourtState, DayOfWeek } from "@/src/domain/enums";
import { ScheduleBoard } from "@/app/admin/schedule-board";

const BOARD = {
  success: true,
  data: {
    courts: [{ id: 1, number: 1, state: CourtState.AVAILABLE, price: 10000 }],
    schedules: [
      { id: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00", court: { id: 1 } },
    ],
    bookings: [],
    outOfServices: [],
  },
};

async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("ScheduleBoard - refresco", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Lunes 9:00: el turno en curso es el de 8:00 y el próximo arranca a las 9:30.
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    getScheduleBoardData.mockResolvedValue(BOARD);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("no vuelve a pedir los datos mientras no cambie el turno", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    await advance(29 * 60_000);

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  it("se actualiza solo cuando empieza el próximo turno", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    await advance(30 * 60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);

    // El siguiente cambio es a las 11:00, 90 minutos después.
    await advance(89 * 60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
    await advance(60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(3);
  });

  it("se actualiza al hacer click en Actualizar", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    fireEvent.click(screen.getByRole("button", { name: "Actualizar turnera" }));
    await advance(0);

    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
  });
  it("al volver a la sección se actualiza si mientras tanto cambió el turno", async () => {
    const { rerender } = render(<ScheduleBoard isActive />);
    await advance(0);

    rerender(<ScheduleBoard isActive={false} />);
    await advance(40 * 60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);

    rerender(<ScheduleBoard isActive />);
    await advance(0);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
  });

  it("al volver a la sección no se actualiza si sigue el mismo turno", async () => {
    const { rerender } = render(<ScheduleBoard isActive />);
    await advance(0);

    rerender(<ScheduleBoard isActive={false} />);
    await advance(20 * 60_000);
    rerender(<ScheduleBoard isActive />);
    await advance(0);

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  it("si falla el refresco no reintenta hasta el próximo cambio de turno", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    getScheduleBoardData.mockResolvedValueOnce({ success: false, error: "No se pudo actualizar la turnera." });
    await advance(30 * 60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);

    await advance(60_000);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
  });
});
