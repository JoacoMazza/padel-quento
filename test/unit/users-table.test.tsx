// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

const { getPlayerRecordAdmin, blockPlayer, unblockPlayer, changePlayerCategoryAdmin, deductPlayerPointsAdmin } =
  vi.hoisted(() => ({
    getPlayerRecordAdmin: vi.fn(),
    blockPlayer: vi.fn(),
    unblockPlayer: vi.fn(),
    changePlayerCategoryAdmin: vi.fn(),
    deductPlayerPointsAdmin: vi.fn(),
  }));

vi.mock("@/src/actions/player", () => ({
  getPlayerRecordAdmin,
  blockPlayer,
  unblockPlayer,
  changePlayerCategoryAdmin,
  deductPlayerPointsAdmin,
}));

import { BookingState, PlayerCategory, ReviewLevel } from "@/src/domain/enums";
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
  reputation: {
    reviews: 5,
    enough: true,
    onTimePct: 60,
    goodAttitudePct: 100,
    levelAsDeclaredPct: 80,
    levelLowerPct: 20,
    levelHigherPct: 0,
  },
  reputationAlerts: ["Puntualidad baja: 60%"],
  reviews: [
    {
      id: 1,
      reviewerName: "Bruno Díaz",
      createdAt: "2026-10-03T00:00:00.000Z",
      level: ReviewLevel.LOWER,
      goodAttitude: true,
      onTime: false,
      comment: "Llegó 20 minutos tarde",
    },
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

  describe("reputación (HU-36)", () => {
    it("muestra la reputación con sus alertas y las reseñas con quién las dejó", async () => {
      render(<UsersTable players={[player]} />);
      const dialog = await openRecord();

      const section = await within(dialog).findByRole("region", { name: "Reputación" });
      expect(within(section).getByText("Puntual 60%")).toBeTruthy();
      expect(within(section).getByText("Puntualidad baja: 60%")).toBeTruthy();
      expect(within(section).getByText("Llegó 20 minutos tarde")).toBeTruthy();
      expect(within(section).getByText(/Bruno Díaz/)).toBeTruthy();
      expect(within(section).getByText(/Llegó tarde · Buena actitud · Nivel más bajo/)).toBeTruthy();
    });

    it("cambia la categoría del jugador y actualiza la ficha", async () => {
      changePlayerCategoryAdmin.mockResolvedValue({ success: true, data: null });
      render(<UsersTable players={[player]} />);
      const dialog = await openRecord();
      await within(dialog).findByRole("region", { name: "Reputación" });

      fireEvent.change(within(dialog).getByLabelText("Categoría"), { target: { value: PlayerCategory.FIFTH } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Cambiar categoría" }));

      await waitFor(() => expect(getPlayerRecordAdmin).toHaveBeenCalledTimes(2));
      expect(changePlayerCategoryAdmin).toHaveBeenCalledWith(7, PlayerCategory.FIFTH);
    });

    it("descuenta puntos con un motivo", async () => {
      deductPlayerPointsAdmin.mockResolvedValue({ success: true, data: null });
      render(<UsersTable players={[player]} />);
      const dialog = await openRecord();
      await within(dialog).findByRole("region", { name: "Reputación" });

      fireEvent.change(within(dialog).getByLabelText("Puntos a descontar"), { target: { value: "10" } });
      fireEvent.change(within(dialog).getByLabelText("Motivo"), { target: { value: "Mala conducta" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Descontar puntos" }));

      await waitFor(() => expect(getPlayerRecordAdmin).toHaveBeenCalledTimes(2));
      expect(deductPlayerPointsAdmin).toHaveBeenCalledWith(7, 10, "Mala conducta");
    });

    it("muestra el error si no se pudieron descontar los puntos", async () => {
      deductPlayerPointsAdmin.mockResolvedValue({ success: false, error: "Indicá el motivo del descuento." });
      render(<UsersTable players={[player]} />);
      const dialog = await openRecord();
      await within(dialog).findByRole("region", { name: "Reputación" });

      fireEvent.change(within(dialog).getByLabelText("Puntos a descontar"), { target: { value: "10" } });
      fireEvent.click(within(dialog).getByRole("button", { name: "Descontar puntos" }));

      expect(await within(dialog).findByText("Indicá el motivo del descuento.")).toBeTruthy();
    });
  });
});
