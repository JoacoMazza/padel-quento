import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mock de next-auth (para requireAdmin) ─────────────────────────────────────
vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// ── mocks de la capa de datos ─────────────────────────────────────────────────
const { find, findOne, save, getDataSource } = vi.hoisted(() => {
  const find = vi.fn();
  const findOne = vi.fn();
  const save = vi.fn(async (entity: unknown) => entity);
  const getRepository = vi.fn(() => ({ find, findOne, save }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { find, findOne, save, getDataSource };
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
    save.mockImplementation(async (entity: unknown) => entity);
  });

  // ── getPlayersAdmin ─────────────────────────────────────────────────────────
  describe("getPlayersAdmin", () => {
    it("devuelve la lista de jugadores cuando el usuario es admin", async () => {
      mockAdminSession();
      const fakePlayer = { id: 1, names: "Ana", lastnames: "Gomez", email: "ana@test.com", isBlocked: false };
      find.mockResolvedValueOnce([fakePlayer]);

      const result = await getPlayersAdmin();

      expect(result).toEqual({ success: true, data: [fakePlayer] });
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
    it("pone isBlocked en true y guarda el jugador", async () => {
      mockAdminSession();
      const player = { id: 5, names: "Luis", isBlocked: false };
      findOne.mockResolvedValueOnce(player);

      const result = await blockPlayer(5);

      expect(result).toEqual({ success: true, data: null });
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 5, isBlocked: true }));
    });

    it("devuelve error si el jugador no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await blockPlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(save).not.toHaveBeenCalled();
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
    it("pone isBlocked en false y guarda el jugador", async () => {
      mockAdminSession();
      const player = { id: 7, names: "Marta", isBlocked: true };
      findOne.mockResolvedValueOnce(player);

      const result = await unblockPlayer(7);

      expect(result).toEqual({ success: true, data: null });
      expect(save).toHaveBeenCalledWith(expect.objectContaining({ id: 7, isBlocked: false }));
    });

    it("devuelve error si el jugador no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await unblockPlayer(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(save).not.toHaveBeenCalled();
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

