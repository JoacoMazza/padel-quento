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
vi.mock("@/src/actions/match", () => ({ closeMatch, leaveMatch, addPlayerToMatch: vi.fn() }));
vi.mock("@/app/my-bookings/review-teammates-modal", () => ({
  ReviewTeammatesModal: ({ matchId }: { matchId: number }) => <div role="dialog">Calificando el partido {matchId}</div>,
}));

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
    canReview: false,
    isFixed: false,
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

  describe("turno fijo", () => {
    it("lo marca como turno fijo y no permite cancelarlo desde la app", () => {
      render(<BookingRow booking={booking({ isFixed: true })} now={NOW} />);

      expect(screen.getByText("Turno fijo")).toBeTruthy();
      expect(screen.queryByRole("button", { name: "Cancelar turno" })).toBeNull();
      expect(screen.getByText("Para no ir a esta fecha, avisale al club.")).toBeTruthy();
    });
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
        `Faltan menos de 3 horas para el turno: si cancelás se te descontarán 20 puntos.`,
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
        `Faltan menos de 3 horas para el turno: si te das de baja se te descontarán 20 puntos.`,
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

  describe("calificar compañeros", () => {
    it("en un partido terminado que se puede calificar ofrece calificar a los compañeros", () => {
      render(<BookingRow booking={booking({ matchId: 7, canReview: true })} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: "Calificar compañeros" }));

      expect(screen.getByRole("dialog").textContent).toBe("Calificando el partido 7");
    });

    it("abre el modal fuera de la fila, que en un partido terminado se ve apagada", () => {
      // Partido ya jugado: la fila se muestra con opacidad reducida.
      const played = booking({ matchId: 7, canReview: true, fromDateTime: new Date("2026-09-30T18:00:00") });
      const { container } = render(<BookingRow booking={played} now={NOW} />);
      expect(container.querySelector(".opacity-75")).toBeTruthy();

      fireEvent.click(screen.getByRole("button", { name: "Calificar compañeros" }));

      // Si quedara adentro heredaría la opacidad y se vería lo de atrás a través del modal.
      const dialog = screen.getByRole("dialog");
      expect(container.contains(dialog)).toBe(false);
      expect(dialog.closest(".opacity-75")).toBeNull();
    });

    it("no lo ofrece si el partido no se puede calificar", () => {
      render(<BookingRow booking={booking({ matchId: 7, canReview: false })} now={NOW} />);

      expect(screen.queryByRole("button", { name: "Calificar compañeros" })).toBeNull();
    });
  });

  describe("share link (HU-40)", () => {
    /** Open match just created: only its creator, no chat room yet. */
    function newOpenMatch(overrides: Partial<MyBookingItem> = {}) {
      return booking({ matchId: 5, needPlayers: true, confirmedPlayers: 1, chatId: null, ...overrides });
    }

    it("offers the open match link right after creating it, before the chat room exists", async () => {
      const writeText = vi.fn(async () => undefined);
      Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
      render(<BookingRow booking={newOpenMatch()} now={NOW} />);

      fireEvent.click(screen.getByRole("button", { name: /Compartir link/ }));

      await waitFor(() => expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/open-matches/10`));
    });

    it("also offers it to players who joined someone else's open match", () => {
      render(<BookingRow booking={newOpenMatch({ joinedAsParticipant: true, chatId: 3 })} now={NOW} playerId={5} />);

      expect(screen.getByRole("button", { name: /Compartir link/ })).toBeTruthy();
    });

    it("does not offer it once the match stops looking for players", () => {
      render(<BookingRow booking={newOpenMatch({ needPlayers: false, confirmedPlayers: 4 })} now={NOW} />);

      expect(screen.queryByRole("button", { name: /Compartir link/ })).toBeNull();
    });

    it("does not offer it for a cancelled match", () => {
      render(<BookingRow booking={newOpenMatch({ bookingState: BookingState.CANCELLED })} now={NOW} />);

      expect(screen.queryByRole("button", { name: /Compartir link/ })).toBeNull();
    });

    it("does not offer it for a regular booking without an open match", () => {
      render(<BookingRow booking={booking()} now={NOW} />);

      expect(screen.queryByRole("button", { name: /Compartir link/ })).toBeNull();
    });
  });

  describe("add player (HU-40)", () => {
    function openMatch(overrides: Partial<MyBookingItem> = {}) {
      return booking({ matchId: 5, needPlayers: true, confirmedPlayers: 1, chatId: null, ...overrides });
    }

    it("lets a member of an open match add a registered player, even before the chat room exists", () => {
      render(<BookingRow booking={openMatch()} now={NOW} />);

      expect(screen.queryByLabelText("Email o teléfono del jugador")).toBeNull();
      fireEvent.click(screen.getByRole("button", { name: "Agregar jugador" }));

      expect(screen.getByLabelText("Email o teléfono del jugador")).toBeTruthy();
    });

    it("also offers it on a full match, to replace a companion", () => {
      render(<BookingRow booking={openMatch({ needPlayers: false, confirmedPlayers: 4 })} now={NOW} />);

      expect(screen.getByRole("button", { name: "Agregar jugador" })).toBeTruthy();
    });

    it("does not offer it for a cancelled match", () => {
      render(<BookingRow booking={openMatch({ bookingState: BookingState.CANCELLED })} now={NOW} />);

      expect(screen.queryByRole("button", { name: "Agregar jugador" })).toBeNull();
    });

    it("does not offer it for a regular booking without an open match", () => {
      render(<BookingRow booking={booking()} now={NOW} />);

      expect(screen.queryByRole("button", { name: "Agregar jugador" })).toBeNull();
    });
  });
});
