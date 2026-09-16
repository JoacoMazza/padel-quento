import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState } from "@/src/domain/enums";

const { update, find, findOne, getDataSource } = vi.hoisted(() => {
  const update = vi.fn(async () => ({ affected: 1 }));
  const find = vi.fn();
  const findOne = vi.fn();

  const repository = { update, find, findOne };

  const manager = { getRepository: vi.fn(() => repository) };

  const getRepository = vi.fn(() => repository);
  const transaction = vi.fn(async (cb: (manager: unknown) => unknown) => cb(manager));
  const getDataSource = vi.fn(async () => ({ getRepository, transaction }));

  return { update, find, findOne, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { closeMatch, cancelExpiredMatches } from "@/src/actions/match";

describe("match actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("closeMatch", () => {
    it("cierra manualmente un partido con 1, 2 o 3 jugadores confirmados", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        needPlayers: true,
        matchPlayers: [{ playersCount: 2 }],
      });

      const result = await closeMatch(1);

      expect(update).toHaveBeenCalledWith(1, { needPlayers: false });
      expect(result).toEqual({
        success: true,
        data: { id: 1, needPlayers: false, matchPlayers: [{ playersCount: 2 }] },
      });
    });

    it("devuelve error si el partido no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await closeMatch(999);

      expect(result).toEqual({ success: false, error: "El partido no existe." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si el partido ya no está buscando jugadores", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        needPlayers: false,
        matchPlayers: [{ playersCount: 4 }],
      });

      const result = await closeMatch(1);

      expect(result).toEqual({
        success: false,
        error: "Este partido ya no está buscando jugadores.",
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si ya están los 4 jugadores confirmados", async () => {
      findOne.mockResolvedValueOnce({
        id: 1,
        needPlayers: true,
        matchPlayers: [{ playersCount: 4 }],
      });

      const result = await closeMatch(1);

      expect(result).toEqual({
        success: false,
        error: "El cierre manual solo está disponible con entre 1 y 3 jugadores confirmados.",
      });
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("cancelExpiredMatches", () => {
    it("cancela los partidos vencidos que no completaron el cupo", async () => {
      const soon = new Date(Date.now() + 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          needPlayers: true,
          booking: { id: 10, bookingState: BookingState.RESERVED, fromDateTime: soon },
          matchPlayers: [{ playersCount: 2 }],
        },
        {
          id: 2,
          needPlayers: true,
          booking: { id: 20, bookingState: BookingState.RESERVED, fromDateTime: soon },
          matchPlayers: [{ playersCount: 4 }],
        },
      ]);

      const result = await cancelExpiredMatches();

      expect(update).toHaveBeenCalledWith([10], { bookingState: BookingState.CANCELLED });
      expect(update).toHaveBeenCalledWith([1], { needPlayers: false });
      expect(update).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ success: true, data: 1 });
    });

    it("no cancela partidos que todavía tienen más de 3 horas antes del inicio", async () => {
      const farFuture = new Date(Date.now() + 10 * 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          needPlayers: true,
          booking: { id: 10, bookingState: BookingState.RESERVED, fromDateTime: farFuture },
          matchPlayers: [{ playersCount: 2 }],
        },
      ]);

      const result = await cancelExpiredMatches();

      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("no toca un partido cuyo turno ya está cancelado", async () => {
      find.mockResolvedValueOnce([
        {
          id: 1,
          needPlayers: true,
          booking: { id: 10, bookingState: BookingState.CANCELLED, fromDateTime: new Date() },
          matchPlayers: [{ playersCount: 2 }],
        },
      ]);

      const result = await cancelExpiredMatches();

      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("devuelve un error genérico si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("boom"));

      const result = await cancelExpiredMatches();

      expect(result).toEqual({
        success: false,
        error: "No se pudieron cancelar los partidos abiertos vencidos.",
      });
    });
  });
});
