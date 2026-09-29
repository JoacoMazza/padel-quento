// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const { refresh, updateBooking, closeMatch, leaveMatch } = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateBooking: vi.fn(),
  closeMatch: vi.fn(),
  leaveMatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));
vi.mock("@/src/actions/booking", () => ({ updateBooking }));
vi.mock("@/src/actions/match", () => ({ closeMatch, leaveMatch }));

import { BookingState } from "@/src/domain/enums";
import { PENALTY_POINTS } from "@/src/domain/constants";
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

    it("advierte que se descontarán puntos si faltan menos de 3 horas para el turno", () => {
      render(<BookingRow booking={booking({ fromDateTime: new Date("2026-10-01T12:00:00") })} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));

      expect(screen.getByRole("alert").textContent).toBe(
        `Faltan menos de 3 horas para el turno: si cancelás se te descontarán ${PENALTY_POINTS} puntos.`,
      );
    });

    it("no muestra la advertencia de penalización si faltan 3 horas o más", () => {
      render(<BookingRow booking={booking({ fromDateTime: new Date("2026-10-01T13:00:00") })} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Cancelar turno" }));

      expect(screen.getByText("¿Cancelar turno?")).toBeTruthy();
      expect(screen.queryByRole("alert")).toBeNull();
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

  describe("darse de baja de un partido ajeno", () => {
    const joinedMatch = (overrides: Partial<MyBookingItem> = {}) =>
      booking({ matchId: 3, needPlayers: true, confirmedPlayers: 3, joinedAsParticipant: true, ...overrides });

    it("da de baja al jugador del partido y refresca cuando sale bien", async () => {
      leaveMatch.mockResolvedValueOnce({ success: true, data: null });
      render(<BookingRow booking={joinedMatch()} now={NOW} playerId={5} />);

      fireEvent.click(screen.getByRole("button", { name: "Darme de baja del partido" }));
      expect(screen.getByText("¿Darte de baja del partido?")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Sí, darme de baja" }));

      await waitFor(() => expect(refresh).toHaveBeenCalled());
      expect(leaveMatch).toHaveBeenCalledWith(3, 5);
    });

    it("muestra el error cuando falla", async () => {
      leaveMatch.mockResolvedValueOnce({ success: false, error: "No se pudo dar de baja del partido." });
      render(<BookingRow booking={joinedMatch()} now={NOW} playerId={5} />);

      fireEvent.click(screen.getByRole("button", { name: "Darme de baja del partido" }));
      fireEvent.click(screen.getByRole("button", { name: "Sí, darme de baja" }));

      await waitFor(() => expect(screen.getByText("No se pudo dar de baja del partido.")).toBeTruthy());
      expect(refresh).not.toHaveBeenCalled();
    });

    it("advierte que se descontarán puntos si faltan menos de 3 horas para el turno", () => {
      render(
        <BookingRow booking={joinedMatch({ fromDateTime: new Date("2026-10-01T12:00:00") })} now={NOW} playerId={5} />,
      );

      fireEvent.click(screen.getByRole("button", { name: "Darme de baja del partido" }));

      expect(screen.getByRole("alert").textContent).toBe(
        `Faltan menos de 3 horas para el turno: si te das de baja se te descontarán ${PENALTY_POINTS} puntos.`,
      );
    });

    it("no muestra la advertencia de penalización si faltan 3 horas o más", () => {
      render(<BookingRow booking={joinedMatch()} now={NOW} playerId={5} />);

      fireEvent.click(screen.getByRole("button", { name: "Darme de baja del partido" }));

      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("no ofrece darse de baja a quien creó el partido", () => {
      render(<BookingRow booking={joinedMatch({ joinedAsParticipant: false })} now={NOW} playerId={5} />);

      expect(screen.queryByRole("button", { name: "Darme de baja del partido" })).toBeNull();
    });

    it("no ofrece darse de baja de un turno cancelado", () => {
      render(
        <BookingRow booking={joinedMatch({ bookingState: BookingState.CANCELLED })} now={NOW} playerId={5} />,
      );

      expect(screen.queryByRole("button", { name: "Darme de baja del partido" })).toBeNull();
    });
  });
});
