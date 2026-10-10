// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";

const { getScheduleBoardData, getCourts, getOutOfServices, getPlayersAdmin, getOccupancyReportData } = vi.hoisted(
  () => ({
    getScheduleBoardData: vi.fn(),
    getCourts: vi.fn(),
    getOutOfServices: vi.fn(),
    getPlayersAdmin: vi.fn(),
    getOccupancyReportData: vi.fn(),
  }),
);

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/court", () => ({ getCourts, updateCourt: vi.fn() }));
vi.mock("@/src/actions/outOfService", () => ({
  getOutOfServices,
  createOutOfService: vi.fn(),
  endOutOfService: vi.fn(),
}));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin, blockPlayer: vi.fn(), unblockPlayer: vi.fn() }));
vi.mock("@/src/actions/metrics", () => ({ getOccupancyReportData }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));

import { CourtState, OutOfServiceReason, PlayerCategory } from "@/src/domain/enums";
import { AdminPanel } from "@/app/admin/admin-panel";

const EMPTY_BOARD = { success: true, data: { courts: [], schedules: [], bookings: [], outOfServices: [] } };

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

  it("al entrar solo pide los datos de la sección inicial (Turnera Global)", async () => {
    render(<AdminPanel />);
    await flush();

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
    expect(getCourts).not.toHaveBeenCalled();
    expect(getOutOfServices).not.toHaveBeenCalled();
    expect(getPlayersAdmin).not.toHaveBeenCalled();
    expect(getOccupancyReportData).not.toHaveBeenCalled();
  });

  it("pide las métricas de ocupación recién al abrir su sección", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Métricas del Complejo");
    await flush();

    expect(getOccupancyReportData).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("heading", { name: "Métricas del Complejo" })).toBeTruthy();
  });

  it("pide las canchas recién al abrir su sección y las muestra", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Estado de Canchas");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Cancha 3")).toBeTruthy();
    expect(getPlayersAdmin).not.toHaveBeenCalled();
  });

  it("muestra fuera de servicio la cancha con un bloqueo activo, pero no por uno programado o vencido", async () => {
    vi.setSystemTime(new Date("2026-10-01T10:00:00"));
    getCourts.mockResolvedValueOnce({
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

    openSection("Estado de Canchas");
    await flush();

    const row = (courtLabel: string) => within(screen.getByText(courtLabel).closest("tr")!);
    expect(row("Cancha 3").getByText("Fuera de Servicio (Mantenimiento)")).toBeTruthy();
    expect(row("Cancha 4").getByText("Disponible")).toBeTruthy();
  });

  it("pide los usuarios recién al abrir su sección y los muestra", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Gestión de Usuarios");
    await flush();

    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Ana/)).toBeTruthy();
    expect(getCourts).not.toHaveBeenCalled();
  });

  it("mantiene en memoria lo ya obtenido al volver a una sección visitada", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Estado de Canchas");
    await flush();
    openSection("Gestión de Usuarios");
    await flush();
    openSection("Estado de Canchas");
    await flush();
    openSection("Turnera Global");
    await flush();

    expect(getCourts).toHaveBeenCalledTimes(1);
    expect(getPlayersAdmin).toHaveBeenCalledTimes(1);
    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });

  it("muestra el error si no se pudieron obtener las canchas", async () => {
    getCourts.mockResolvedValueOnce({ success: false, error: "No se pudieron obtener las canchas." });
    render(<AdminPanel />);
    await flush();

    openSection("Estado de Canchas");
    await flush();

    expect(screen.getByText("No se pudieron obtener las canchas.")).toBeTruthy();
  });

  it("pausa el refresco en vivo de la turnera mientras no está visible", async () => {
    render(<AdminPanel />);
    await flush();

    openSection("Estado de Canchas");
    await flush();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(60_000);
    });

    expect(getScheduleBoardData).toHaveBeenCalledTimes(1);
  });
});
