// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const { getScheduleBoardData, getCourts, getPlayersAdmin } = vi.hoisted(() => ({
  getScheduleBoardData: vi.fn(),
  getCourts: vi.fn(),
  getPlayersAdmin: vi.fn(),
}));

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));
vi.mock("@/src/actions/scheduleBoard", () => ({ getScheduleBoardData }));
vi.mock("@/src/actions/court", () => ({ getCourts, updateCourt: vi.fn(), setCourtOutOfService: vi.fn() }));
vi.mock("@/src/actions/player", () => ({ getPlayersAdmin, blockPlayer: vi.fn(), unblockPlayer: vi.fn() }));
vi.mock("@/src/actions/attendance", () => ({ setBookingAttendance: vi.fn(), setMatchPlayerAttendance: vi.fn() }));

import { CourtState, PlayerCategory } from "@/src/domain/enums";
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
    expect(getPlayersAdmin).not.toHaveBeenCalled();
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
