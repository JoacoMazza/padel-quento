// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { refresh, updateBooking, closeMatch } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateBooking: vi.fn(),
  closeMatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/booking", () => ({ updateBooking }));
vi.mock("@/src/actions/match", () => ({ closeMatch }));

import { BookingState } from "@/src/domain/enums";
import { BookingRow } from "@/app/my-bookings/booking-row";
import type { MyBookingItem } from "@/app/my-bookings/types";

const NOW = new Date("2026-10-01T10:00:00");

function booking(overrides: Partial<MyBookingItem> = {}): MyBookingItem {
  return {
    id: 10,
    fromDateTime: new Date("2026-10-05T18:00:00"),
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    courtNumber: 2,
    price: 10000,
    matchId: null,
    needPlayers: false,
    confirmedPlayers: 4,
    chatId: null,
    joinedAsParticipant: false,
    ...overrides,
  };
}

describe("BookingRow", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  describe("cancelar turno", () => {
    it("cancela el turno y cierra la confirmación cuando sale bien", async () => {
      updateBooking.mockResolvedValueOnce({ success: true, data: {} });
      render(<BookingRow booking={booking()} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
      expect(screen.getByText("¿Cancelar turno?")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));

      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(updateBooking).toHaveBeenCalledWith(10, { bookingState: BookingState.CANCELLED });
      // La fila sigue montada (los turnos cancelados se siguen listando): no debe
      // quedar esperando otra confirmación.
      await waitFor(() => expect(screen.queryByText("¿Cancelar turno?")).toBeNull());
      expect(screen.queryByRole("button", { name: "Sí, cancelar" })).toBeNull();
    });

    it("muestra el error y cierra la confirmación cuando falla", async () => {
      updateBooking.mockResolvedValueOnce({ success: false, error: "No se pudo actualizar la reserva." });
      render(<BookingRow booking={booking()} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
      fireEvent.click(screen.getByRole("button", { name: "Sí, cancelar" }));

      await waitFor(() => expect(screen.getByText("No se pudo actualizar la reserva.")).toBeTruthy());
      expect(screen.queryByText("¿Cancelar turno?")).toBeNull();
      expect(refresh).not.toHaveBeenCalled();
    });

    it("permite volver atrás sin cancelar", () => {
      render(<BookingRow booking={booking()} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));
      fireEvent.click(screen.getByRole("button", { name: "Volver" }));

      expect(screen.queryByText("¿Cancelar turno?")).toBeNull();
      expect(updateBooking).not.toHaveBeenCalled();
    });
  });

  describe("cerrar búsqueda de jugadores", () => {
    const openMatch = () => booking({ matchId: 3, needPlayers: true, confirmedPlayers: 2 });

    it("cierra la búsqueda y la confirmación cuando sale bien", async () => {
      closeMatch.mockResolvedValueOnce({ success: true, data: {} });
      render(<BookingRow booking={openMatch()} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cerrar búsqueda de jugadores" }));
      expect(screen.getByText("¿Cerrar búsqueda de jugadores?")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Sí, cerrar" }));

      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(closeMatch).toHaveBeenCalledWith(3);
      await waitFor(() => expect(screen.queryByText("¿Cerrar búsqueda de jugadores?")).toBeNull());
    });
  });
});
