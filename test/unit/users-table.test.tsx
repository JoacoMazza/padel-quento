// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getPlayerRecordAdmin, blockPlayer, unblockPlayer } = vi.hoisted(() => ({
  getPlayerRecordAdmin: vi.fn(),
  blockPlayer: vi.fn(),
  unblockPlayer: vi.fn(),
}));

vi.mock("@/src/actions/player", () => ({ getPlayerRecordAdmin, blockPlayer, unblockPlayer }));

import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { UsersTable } from "@/app/admin/users-table";
import type { PlayerAdminItem } from "@/src/actions/player";

const player: PlayerAdminItem = {
  id: 7,
  names: "Ana",
  lastnames: "Gómez",
  email: "ana@test.com",
  phoneNumber: "2215550101",
  category: PlayerCategory.FOURTH,
  scoring: 15,
  isBlocked: false,
};

const record = {
  ...player,
  noShows: 1,
  bookings: [
    {
      id: 1,
      fromDateTime: "2026-10-01T13:00:00.000Z",
      durationMinutes: 90,
      courtNumber: 3,
      bookingState: BookingState.RESERVED,
      isOpenMatch: false,
      attended: false,
    },
  ],
  movements: [
    { id: 9, amount: -5, description: "Inasistencia a turno reservado", createdAt: "2026-10-02T00:00:00.000Z" },
  ],
};

async function openRecord() {
  fireEvent.click(screen.getByRole("button", { name: "Ver ficha de Ana" }));
  return screen.findByRole("dialog", { name: "Ficha de Ana Gómez" });
}

describe("UsersTable - ficha del jugador", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPlayerRecordAdmin.mockResolvedValue({ success: true, data: record });
  });

  afterEach(() => {
    cleanup();
  });

  it("al abrir la ficha pide los datos del jugador y muestra historial, inasistencias y puntos", async () => {
    render(<UsersTable players={[player]} />);
    const dialog = await openRecord();

    expect(getPlayerRecordAdmin).toHaveBeenCalledWith(7);
    await within(dialog).findByText("Inasistencia a turno reservado");
    expect(within(dialog).getByText("Cancha 3")).toBeTruthy();
    expect(within(dialog).getByText("Ausente")).toBeTruthy();
    expect(within(dialog).getByTestId("no-shows").textContent).toBe("1");
    expect(within(dialog).getByTestId("scoring").textContent).toBe("15");
    expect(within(dialog).getByText("-5 pts")).toBeTruthy();
  });

  it("ofrece contacto directo por WhatsApp y email", async () => {
    render(<UsersTable players={[player]} />);
    const dialog = await openRecord();

    const whatsapp = await within(dialog).findByRole("link", { name: /whatsapp/i });
    expect(whatsapp.getAttribute("href")).toBe("https://wa.me/5492215550101");
    expect(within(dialog).getByRole("link", { name: /email/i }).getAttribute("href")).toBe("mailto:ana@test.com");
  });

  it("permite bloquear al jugador desde la ficha y refleja el nuevo estado en la tabla", async () => {
    blockPlayer.mockResolvedValueOnce({ success: true, data: null });
    render(<UsersTable players={[player]} />);
    const dialog = await openRecord();
    await within(dialog).findByText("Cancha 3");

    fireEvent.click(within(dialog).getByRole("button", { name: "Bloquear a Ana" }));

    await waitFor(() => expect(blockPlayer).toHaveBeenCalledWith(7));
    await within(dialog).findByRole("button", { name: "Desbloquear a Ana" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cerrar" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Bloqueado")).toBeTruthy();
  });

  it("muestra el error si no se pudo obtener la ficha", async () => {
    getPlayerRecordAdmin.mockResolvedValueOnce({ success: false, error: "No se pudo obtener la ficha del jugador." });
    render(<UsersTable players={[player]} />);
    const dialog = await openRecord();

    expect(await within(dialog).findByText("No se pudo obtener la ficha del jugador.")).toBeTruthy();
  });
});
