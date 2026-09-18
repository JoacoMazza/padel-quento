import { beforeEach, describe, expect, it, vi } from "vitest";

const { findOne, getDataSource } = vi.hoisted(() => {
  const findOne = vi.fn();
  const repository = { findOne };
  const getRepository = vi.fn(() => repository);
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { findOne, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { getChatById } from "@/src/actions/chat";

describe("chat actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getChatById", () => {
    it("devuelve el chat con el partido, el turno y los jugadores confirmados", async () => {
      findOne.mockResolvedValueOnce({ id: 1, match: { id: 2 } });

      const result = await getChatById(1);

      expect(findOne).toHaveBeenCalledWith({
        where: { id: 1 },
        relations: {
          match: { booking: { court: true }, matchPlayers: { player: true } },
        },
      });
      expect(result).toEqual({ success: true, data: { id: 1, match: { id: 2 } } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getChatById(999);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve un error genérico si falla la consulta", async () => {
      findOne.mockRejectedValueOnce(new Error("db down"));

      const result = await getChatById(1);

      expect(result).toEqual({ success: false, error: "No se pudo obtener el chat." });
    });
  });
});
