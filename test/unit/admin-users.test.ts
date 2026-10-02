import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock de next-auth (para requireAdmin) ─────────────────────────────────────
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// ── mocks de la capa de datos ─────────────────────────────────────────────────
const { find, findOne, update, getDataSource } = vi.hoisted(() => {
  const find = vi.fn();
  const findOne = vi.fn();
  const update = vi.fn(async () => ({ affected: 1 }));
  const getRepository = vi.fn(() => ({ find, findOne, update }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { find, findOne, update, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

// ── imports bajo test ─────────────────────────────────────────────────────────
import { getServerSession } from "next-auth/next";
import { Role } from "@/src/domain/enums";
import { getPlayersAdmin, blockPlayer, unblockPlayer } from "@/src/actions/player";

// ── helpers ───────────────────────────────────────────────────────────────────
function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as any);
}

function mockPlayerSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
  } as any);
}

function mockNoSession() {
  vi.mocked(getServerSession).mockResolvedValue(null);
}

// ─────────────────────────────────────────────────────────────────────────────

describe("admin player actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPlayersAdmin ─────────────────────────────────────────────────────────
  describe("getPlayersAdmin", () => {
    it("devuelve la lista de jugadores cuando el usuario es admin, sin datos sensibles de la cuenta", async () => {
      mockAdminSession();
      find.mockResolvedValueOnce([
        {
          id: 1,
          category: "4th",
          scoring: 30,
          names: "Ana",
          lastnames: "Gomez",
          phoneNumber: "2215550101",
          account: { id: 10, email: "ana@test.com", isBlocked: false, passwordHash: "hash" },
        },
      ]);

      const result = await getPlayersAdmin();

      expect(result).toEqual({
        success: true,
        data: [
          {
            id: 1,
            names: "Ana",
            lastnames: "Gomez",
            email: "ana@test.com",
            phoneNumber: "2215550101",
            category: "4th",
            scoring: 30,
            isBlocked: false,
          },
        ],
      });
    });

    it("devuelve error genérico si falla la consulta a la BD", async () => {
      mockAdminSession();
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getPlayersAdmin();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener los jugadores." });
    });

    it("devuelve error si no hay sesión (no autenticado)", async () => {
      mockNoSession();

      const result = await getPlayersAdmin();

      expect(result.success).toBe(false);
      expect(find).not.toHaveBeenCalled();
    });

    it("devuelve error si el usuario tiene rol player (no autorizado)", async () => {
      mockPlayerSession();

      const result = await getPlayersAdmin();

      expect(result.success).toBe(false);
      expect(find).not.toHaveBeenCalled();
    });
  });

  // ── blockPlayer ─────────────────────────────────────────────────────────────
  describe("blockPlayer", () => {
    it("pone isBlocked en true en la cuenta del jugador", async () => {
      mockAdminSession();
      const player = { id: 5, account: { id: 50, isBlocked: false } };
      findOne.mockResolvedValueOnce(player);

      const result = await blockPlayer(5);

      expect(result).toEqual({ success: true, data: null });
      expect(update).toHaveBeenCalledWith(50, { isBlocked: true });
    });

    it("devuelve error si el jugador no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await blockPlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error genérico si falla la BD", async () => {
      mockAdminSession();
      findOne.mockRejectedValueOnce(new Error("db error"));

      const result = await blockPlayer(1);

      expect(result).toEqual({ success: false, error: "No se pudo bloquear el jugador." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await blockPlayer(1);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  // ── unblockPlayer ───────────────────────────────────────────────────────────
  describe("unblockPlayer", () => {
    it("pone isBlocked en false en la cuenta del jugador", async () => {
      mockAdminSession();
      const player = { id: 7, account: { id: 70, isBlocked: true } };
      findOne.mockResolvedValueOnce(player);

      const result = await unblockPlayer(7);

      expect(result).toEqual({ success: true, data: null });
      expect(update).toHaveBeenCalledWith(70, { isBlocked: false });
    });

    it("devuelve error si el jugador no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await unblockPlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error genérico si falla la BD", async () => {
      mockAdminSession();
      findOne.mockRejectedValueOnce(new Error("db error"));

      const result = await unblockPlayer(1);

      expect(result).toEqual({ success: false, error: "No se pudo desbloquear el jugador." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockNoSession();

      const result = await unblockPlayer(1);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });
});

