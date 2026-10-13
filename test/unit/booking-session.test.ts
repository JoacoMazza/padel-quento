import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSessionPlayerId, createBookingForPlayer, joinOpenMatchForPlayer } = vi.hoisted(() => ({
  getSessionPlayerId: vi.fn(),
  createBookingForPlayer: vi.fn(async () => ({ success: true, data: { id: 10 } })),
  joinOpenMatchForPlayer: vi.fn(async () => ({ success: true, data: { id: 10 } })),
}));

vi.mock("@/src/lib/session-player", () => ({ getSessionPlayerId }));
vi.mock("@/src/lib/bookings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/src/lib/bookings")>()),
  createBookingForPlayer,
  joinOpenMatchForPlayer,
}));
vi.mock("@/src/lib/db", () => ({ getDataSource: vi.fn() }));
vi.mock("@/src/actions/profile", () => ({ recordPointsMovement: vi.fn() }));

import { createBooking, joinOpenMatch } from "@/src/actions/booking";

const bookingInput = { fromDateTime: new Date("2026-10-20T19:30:00"), courtId: 3, groupSize: 4 };

describe("reservar y sumarse a partidos toman el jugador de la sesión", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createBooking", () => {
    it("sin sesión pide iniciar sesión y no reserva", async () => {
      getSessionPlayerId.mockResolvedValueOnce(null);

      const result = await createBooking(bookingInput);

      expect(result).toEqual({ success: false, error: "Tenés que iniciar sesión para reservar." });
      expect(createBookingForPlayer).not.toHaveBeenCalled();
    });

    it("reserva a nombre del jugador de la sesión, aunque el cliente mande otro id", async () => {
      getSessionPlayerId.mockResolvedValueOnce(7);

      await createBooking({ ...bookingInput, bookerId: 99 } as typeof bookingInput);

      expect(createBookingForPlayer).toHaveBeenCalledWith({ ...bookingInput, bookerId: 7 });
    });
  });

  describe("joinOpenMatch", () => {
    it("sin sesión pide iniciar sesión y no suma a nadie", async () => {
      getSessionPlayerId.mockResolvedValueOnce(null);

      const result = await joinOpenMatch({ bookingId: 10 });

      expect(result).toEqual({ success: false, error: "Tenés que iniciar sesión para reservar." });
      expect(joinOpenMatchForPlayer).not.toHaveBeenCalled();
    });

    it("suma al jugador de la sesión, aunque el cliente mande otro id", async () => {
      getSessionPlayerId.mockResolvedValueOnce(7);

      await joinOpenMatch({ bookingId: 10, groupSize: 2, playerId: 99 } as { bookingId: number; groupSize: number });

      expect(joinOpenMatchForPlayer).toHaveBeenCalledWith({ bookingId: 10, groupSize: 2, playerId: 7 });
    });
  });
});
