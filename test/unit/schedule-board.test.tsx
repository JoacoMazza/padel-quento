// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const { getScheduleBoardData } = vi.hoisted(() => ({ getScheduleBoardData: vi.fn() }));

vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));

import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
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
    fixedBookingDates: [],
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

  it("muestra la hora de la última actualización con el cero adelante", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    expect(screen.getByText(/actualizado 09:00:00/)).toBeTruthy();
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

describe("ScheduleBoard - turnos fijos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function bookingAt(id: number, hour: number) {
    return {
      id,
      fromDateTime: new Date(2026, 9, 12, hour, 0),
      durationMinutes: 90,
      bookingState: BookingState.RESERVED,
      price: 10000,
      attended: true,
      court: { id: 1 },
      booker: { id: 3, names: "Grupo", lastnames: "Lunes" },
      match: null,
    };
  }

  it("marca como turno fijo las fechas de un turno fijo", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: { ...BOARD.data, bookings: [bookingAt(5, 18)], fixedBookingDates: [{ bookingId: 5, fixedBookingDateId: 9 }] },
    });

    render(<ScheduleBoard />);
    await advance(0);

    // El turno ocupa varias celdas de la grilla: todas lo muestran como turno fijo.
    expect(screen.getAllByText("Turno fijo").length).toBeGreaterThan(0);
  });

  it("distingue por color los turnos fijos de los comunes, con su referencia", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: {
        ...BOARD.data,
        bookings: [bookingAt(5, 18), bookingAt(6, 10)],
        fixedBookingDates: [{ bookingId: 5, fixedBookingDateId: 9 }],
      },
    });

    render(<ScheduleBoard />);
    await advance(0);

    const fixedCell = screen.getAllByText("Turno fijo").find((el) => el.getAttribute("role") === "button")!;
    const commonCell = screen.getAllByText("Reservado").find((el) => el.getAttribute("role") === "button")!;
    expect(fixedCell.dataset.state).toBe("fixed");
    expect(commonCell.dataset.state).toBe("reserved");
    expect(fixedCell.className).not.toBe(commonCell.className);
    // La referencia de colores de abajo de la grilla también lo incluye.
    expect(screen.getAllByText("Turno fijo").some((el) => el.getAttribute("role") !== "button")).toBe(true);
  });

  it("muestra como Finalizado un turno cuyo horario ya terminó, con un estilo propio", async () => {
    // A las 9:00 el turno de 7:00 a 8:30 ya terminó y el de 18:00 todavía no empezó.
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: {
        ...BOARD.data,
        schedules: [{ ...BOARD.data.schedules[0], openingTime: "07:00:00" }],
        bookings: [bookingAt(5, 7), bookingAt(6, 18)],
      },
    });

    render(<ScheduleBoard />);
    await advance(0);

    const finishedCell = screen.getAllByText("Finalizado").find((el) => el.getAttribute("role") === "button")!;
    const reservedCell = screen.getAllByText("Reservado").find((el) => el.getAttribute("role") === "button")!;
    expect(finishedCell.dataset.state).toBe("finished");
    expect(reservedCell.dataset.state).toBe("reserved");
    expect(finishedCell.className).not.toBe(reservedCell.className);
    // La referencia de colores también lo incluye.
    expect(screen.getAllByText("Finalizado").some((el) => el.getAttribute("role") !== "button")).toBe(true);
  });

  it("un turno en curso no se muestra como Finalizado", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: { ...BOARD.data, bookings: [bookingAt(5, 8)] },
    });

    render(<ScheduleBoard />);
    await advance(0);

    const cell = screen.getByText("08:00").closest("tr")!.querySelector("[data-state]") as HTMLElement;
    expect(cell.dataset.state).toBe("reserved");
  });

  it("un turno fijo que ya terminó también se muestra como Finalizado", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: {
        ...BOARD.data,
        schedules: [{ ...BOARD.data.schedules[0], openingTime: "07:00:00" }],
        bookings: [bookingAt(5, 7)],
        fixedBookingDates: [{ bookingId: 5, fixedBookingDateId: 9 }],
      },
    });

    render(<ScheduleBoard />);
    await advance(0);

    const cell = screen.getByText("07:00").closest("tr")!.querySelector("[data-state]") as HTMLElement;
    expect(cell.dataset.state).toBe("finished");
  });

  it("un turno cancelado que ya pasó no se marca como Finalizado", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: {
        ...BOARD.data,
        schedules: [{ ...BOARD.data.schedules[0], openingTime: "07:00:00" }],
        bookings: [{ ...bookingAt(5, 7), bookingState: BookingState.CANCELLED }],
      },
    });

    render(<ScheduleBoard />);
    await advance(0);

    const cell = screen.getByText("07:00").closest("tr")!.querySelector("[data-state]") as HTMLElement;
    expect(cell.dataset.state).not.toBe("finished");
  });

  it("muestra las acciones extra junto al botón Actualizar", async () => {
    getScheduleBoardData.mockResolvedValue(BOARD);
    render(<ScheduleBoard toolbarActions={<button type="button">Registrar turno fijo</button>} />);
    await advance(0);

    expect(screen.getByRole("button", { name: "Registrar turno fijo" }).parentElement).toBe(
      screen.getByRole("button", { name: "Actualizar turnera" }).parentElement,
    );
  });

  it("se actualiza cuando cambia refreshKey (por ejemplo, al crear un turno fijo)", async () => {
    getScheduleBoardData.mockResolvedValue(BOARD);
    const { rerender } = render(<ScheduleBoard refreshKey={0} />);
    await advance(0);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);

    rerender(<ScheduleBoard refreshKey={1} />);
    await advance(0);

    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
  });
});

describe("ScheduleBoard - agendar desde una celda libre", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    // Lunes 9:00: el turno de las 8:00 ya empezó y el de las 9:30 todavía no.
    vi.setSystemTime(new Date(2026, 9, 12, 9, 0));
    getScheduleBoardData.mockResolvedValue(BOARD);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  function cellAt(time: string) {
    const row = screen.getByText(time).closest("tr")!;
    return row.querySelector("[data-state]") as HTMLElement;
  }

  it("al hacer click en una celda disponible futura avisa la cancha, el día y la hora", async () => {
    const onAvailableSlotClick = vi.fn();
    render(<ScheduleBoard onAvailableSlotClick={onAvailableSlotClick} />);
    await advance(0);

    const cell = cellAt("09:30");
    expect(cell.getAttribute("role")).toBe("button");
    expect(cell.title).toBe("Agendar turno");
    // Al pasar el mouse, la celda indica que se puede agendar ahí.
    expect(cell.textContent).toContain("Agendar");
    fireEvent.click(cell);

    expect(onAvailableSlotClick).toHaveBeenCalledWith({ courtId: 1, date: "2026-10-12", startTime: "09:30" });
  });

  it("las celdas de horarios que ya empezaron no se pueden agendar", async () => {
    const onAvailableSlotClick = vi.fn();
    render(<ScheduleBoard onAvailableSlotClick={onAvailableSlotClick} />);
    await advance(0);

    const cell = cellAt("08:00");
    expect(cell.dataset.state).toBe("available");
    expect(cell.getAttribute("role")).toBeNull();
    expect(cell.textContent).toBe("Disponible");
    fireEvent.click(cell);
    expect(onAvailableSlotClick).not.toHaveBeenCalled();
  });

  it("los horarios que ya terminaron sin reservarse se muestran como No reservado, con un estilo propio", async () => {
    // A las 9:00 el turno de 7:00 a 8:30 ya terminó sin que nadie lo tome.
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: { ...BOARD.data, schedules: [{ ...BOARD.data.schedules[0], openingTime: "07:00:00" }] },
    });
    const onAvailableSlotClick = vi.fn();
    render(<ScheduleBoard onAvailableSlotClick={onAvailableSlotClick} />);
    await advance(0);

    const cell = cellAt("07:00");
    expect(cell.dataset.state).toBe("unbooked");
    expect(cell.textContent).toBe("No reservado");
    expect(cell.getAttribute("role")).toBeNull();
    expect(cell.className).not.toBe(cellAt("08:30").className);
    fireEvent.click(cell);
    expect(onAvailableSlotClick).not.toHaveBeenCalled();
    // La referencia de colores también lo incluye.
    expect(screen.getAllByText("No reservado").length).toBe(2);
  });

  it("un horario pasado con un turno cancelado se muestra como No reservado", async () => {
    getScheduleBoardData.mockResolvedValue({
      ...BOARD,
      data: {
        ...BOARD.data,
        schedules: [{ ...BOARD.data.schedules[0], openingTime: "07:00:00" }],
        bookings: [
          {
            id: 5,
            fromDateTime: new Date(2026, 9, 12, 7, 0),
            durationMinutes: 90,
            bookingState: BookingState.CANCELLED,
            price: 10000,
            attended: false,
            court: { id: 1 },
            booker: { id: 3, names: "Grupo", lastnames: "Lunes" },
            match: null,
          },
        ],
      },
    });
    render(<ScheduleBoard />);
    await advance(0);

    expect(cellAt("07:00").dataset.state).toBe("unbooked");
  });

  it("un horario en curso sin reservar sigue como Disponible", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    expect(cellAt("08:00").dataset.state).toBe("available");
  });

  it("sin onAvailableSlotClick las celdas disponibles no son clickeables", async () => {
    render(<ScheduleBoard />);
    await advance(0);

    expect(cellAt("09:30").getAttribute("role")).toBeNull();
  });
});
