// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const {
  getScheduleBoardData,
  getCourts,
  getOutOfServices,
  getPlayersAdmin,
  getOccupancyReportData,
  getFixedBookingsAdmin,
  createFixedBooking,
} = vi.hoisted(
  () => ({
    createFixedBooking: vi.fn(),
    getScheduleBoardData: vi.fn(),
    getCourts: vi.fn(),
    getOutOfServices: vi.fn(),
    getPlayersAdmin: vi.fn(),
    getOccupancyReportData: vi.fn(),
    getFixedBookingsAdmin: vi.fn(),
  }),
);

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/court", () => ({ getCourts, updateCourt: vi.fn(), updateAllCourtsPrice: vi.fn() }));
vi.mock("@/src/actions/outOfService", () => ({
  getOutOfServices,
  createOutOfService: vi.fn(),
  endOutOfService: vi.fn(),
}));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin, blockPlayer: vi.fn(), unblockPlayer: vi.fn() }));
vi.mock("@/src/actions/metrics", () => ({ getOccupancyReportData }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));
vi.mock("@/src/actions/fixedBooking", () => ({
  getFixedBookingsAdmin,
  createFixedBooking,
  releaseFixedBookingDate: vi.fn(),
  restoreFixedBookingDate: vi.fn(),
  cancelFixedBooking: vi.fn(),
}));

import { CourtState, OutOfServiceReason, PlayerCategory } from "@/src/domain/enums";
import { AdminPanel } from "@/app/admin/admin-panel";

const EMPTY_BOARD = {
  success: true,
  data: { courts: [], schedules: [], bookings: [], outOfServices: [], fixedBookingDates: [] },
};

// Deja que se resuelvan las promesas de las Server Actions mockeadas y se apliquen los setState.
async function flush() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

function openSection(label: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
}

describe("AdminPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    getScheduleBoardData.mockResolvedValue(EMPTY_BOARD);
    getCourts.mockResolvedValue({
      success: true,
      data: [{ id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 }],
    });
    getOutOfServices.mockResolvedValue({ success: true, data: [] });
    getFixedBookingsAdmin.mockResolvedValue({ success: true, data: [] });
    getOccupancyReportData.mockResolvedValue({
      success: true,
      data: { courts: [], schedules: [], bookings: [], outOfServices: [] },
    });
    getPlayersAdmin.mockResolvedValue({
      success: true,
      data: [
        {
          id: 7,
          names: "Ana",
          lastnames: "Gómez",
          email: "ana@test.com",
          phoneNumber: "2215550101",
          category: PlayerCategory.FOURTH,
          scoring: 0,
          isBlocked: false,
        },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("al entrar solo pide los datos de la Turnera Global y de sus turnos fijos", async () => {
    render(<AdminPanel />);
    await flush();

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
    // Turnos fijos, y las canchas y jugadores que ofrece su alta.
    expect(getFixedBookingsAdmin).toHaveBeenCalledTimes(1);
    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(getOutOfServices).not.toHaveBeenCalled();
    expect(getOccupancyReportData).not.toHaveBeenCalled();
  });

  it("los turnos fijos están en la Turnera Global, debajo de la grilla, y no en una sección aparte", async () => {
    render(<AdminPanel />);
    await flush();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.queryByRole("button", { name: "Turnos Fijos" })).toBeNull();
    expect(screen.getByRole("heading", { name: "Turnos fijos" })).toBeTruthy();
    expect(screen.getByText("Todavía no hay turnos fijos.")).toBeTruthy();
  });

  it("el botón Registrar turno fijo está junto a Actualizar y abre el alta", async () => {
    render(<AdminPanel />);
    await flush();

    const refreshButton = screen.getByRole("button", { name: "Actualizar turnera" });
    const registerButton = screen.getByRole("button", { name: "Registrar turno fijo" });
    expect(registerButton.parentElement).toBe(refreshButton.parentElement);

    fireEvent.click(registerButton);
    expect(screen.getByRole("heading", { name: "Nuevo turno fijo" })).toBeTruthy();
  });

  it("al crear un turno fijo actualiza la grilla para que aparezcan sus fechas", async () => {
    createFixedBooking.mockResolvedValue({ success: true, data: { id: 2, conflicts: [] } });
    render(<AdminPanel />);
    await flush();

    fireEvent.click(screen.getByRole("button", { name: "Registrar turno fijo" }));
    fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-10-20" } });
    fireEvent.change(screen.getByLabelText("Jugador"), { target: { value: "7" } });
    fireEvent.click(screen.getByRole("button", { name: "Crear turno fijo" }));
    await flush();

    expect(createFixedBooking).toHaveBeenCalledTimes(1);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Turno fijo creado.")).toBeTruthy();
  });

  it("pide las métricas de ocupación recién al abrir su sección", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Métricas del Complejo");
    await flush();

    expect(getOccupancyReportData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Métricas del Complejo" })).toBeTruthy();
  });

  it("el menú tiene una sola sección de canchas, sin el Bloqueo de Canchas obsoleto", async () => {
    render(<AdminPanel />);
    await flush();

    const nav = within(screen.getByRole("navigation"));
    expect(nav.getByRole("button", { name: "Canchas" })).toBeTruthy();
    expect(nav.queryByText("Estado de Canchas")).toBeNull();
    expect(nav.queryByText("Bloqueo de Canchas")).toBeNull();
  });

  it("pide las canchas recién al abrir su sección y las muestra", async () => {
    render(<AdminPanel />);
    await flush();

    getCourts.mockClear();
    getPlayersAdmin.mockClear();
    openSection("Canchas");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cancha 3")).toBeTruthy();
    expect(getPlayersAdmin).not.toHaveBeenCalled();
  });

  it("muestra fuera de servicio la cancha con un bloqueo activo, pero no por uno programado o vencido", async () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00"));
    getCourts.mockResolvedValue({
      success: true,
      data: [
        { id: 1, number: 3, state: CourtState.AVAILABLE, price: 10000 },
        { id: 2, number: 4, state: CourtState.AVAILABLE, price: 10000 },
      ],
    });
    getOutOfServices.mockResolvedValueOnce({
      success: true,
      data: [
        {
          id: 20,
          fromDateTime: new Date("2026-10-01T09:00:00"),
          toDateTime: new Date("2026-10-01T12:00:00"),
          reason: OutOfServiceReason.MAINTENANCE,
          court: { id: 1 },
        },
        {
          id: 21,
          fromDateTime: new Date("2026-10-02T09:00:00"),
          toDateTime: new Date("2026-10-02T12:00:00"),
          reason: OutOfServiceReason.CLEANING,
          court: { id: 2 },
        },
        {
          id: 22,
          fromDateTime: new Date("2026-09-30T09:00:00"),
          toDateTime: new Date("2026-09-30T12:00:00"),
          reason: OutOfServiceReason.OTHER,
          court: { id: 2 },
        },
      ],
    });
    render(<AdminPanel />);
    await flush();

    openSection("Canchas");
    await flush();

    const row = (courtLabel: string) => within(screen.getByText(courtLabel).closest("tr")!);
    expect(row("Cancha 3").getByText("Fuera de Servicio (Mantenimiento)")).toBeTruthy();
    expect(row("Cancha 4").getByText("Disponible")).toBeTruthy();
  });

  it("pide los usuarios recién al abrir su sección y los muestra", async () => {
    render(<AdminPanel />);
    await flush();

    getCourts.mockClear();
    getPlayersAdmin.mockClear();
    openSection("Gestión de Usuarios");
    await flush();

    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Ana/)).toBeTruthy();
    expect(getCourts).not.toHaveBeenCalled();
  });

  it("mantiene en memoria lo ya obtenido al volver a una sección visitada", async () => {
    render(<AdminPanel />);
    await flush();
    getCourts.mockClear();
    getPlayersAdmin.mockClear();

    openSection("Canchas");
    await flush();
    openSection("Gestión de Usuarios");
    await flush();
    openSection("Canchas");
    await flush();
    openSection("Turnera Global");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  it("muestra el error si no se pudieron obtener las canchas", async () => {
    render(<AdminPanel />);
    await flush();
    getCourts.mockResolvedValueOnce({ success: false, error: "No se pudieron obtener las canchas." });

    openSection("Canchas");
    await flush();

    expect(screen.getByText("No se pudieron obtener las canchas.")).toBeTruthy();
  });

  it("pausa el refresco en vivo de la turnera mientras no está visible", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Canchas");
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });
});
