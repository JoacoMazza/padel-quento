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
import { BookingState, Role } from "@/src/domain/enums";
import { getPlayersAdmin, getPlayerRecordAdmin, blockPlayer, unblockPlayer } from "@/src/actions/player";

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
  // ── getPlayerRecordAdmin ────────────────────────────────────────────────────
  describe("getPlayerRecordAdmin", () => {
    const player = {
      id: 3,
      names: "Ana",
      lastnames: "Gomez",
      phoneNumber: "2215550101",
      category: "4th",
      scoring: 15,
      account: { id: 30, email: "ana@test.com", isBlocked: false, passwordHash: "hash" },
    };

    it("arma la ficha con reservas, partidos abiertos, inasistencias y movimientos de puntos", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(player);
      // Turnos que reservó el jugador: uno común al que faltó y un partido abierto que creó.
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: new Date("2026-10-01T10:00:00Z"),
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: false,
          court: { number: 3 },
          match: null,
        },
        {
          id: 2,
          fromDateTime: new Date("2026-10-05T10:00:00Z"),
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: true,
          court: { number: 1 },
          match: { id: 20 },
        },
      ]);
      // Participaciones en partidos abiertos: el propio (asistió) y uno ajeno (faltó).
      find.mockResolvedValueOnce([
        {
          attended: true,
          match: {
            booking: {
              id: 2,
              fromDateTime: new Date("2026-10-05T10:00:00Z"),
              durationMinutes: 90,
              bookingState: BookingState.RESERVED,
              attended: true,
              court: { number: 1 },
            },
          },
        },
        {
          attended: false,
          match: {
            booking: {
              id: 4,
              fromDateTime: new Date("2026-10-08T18:00:00Z"),
              durationMinutes: 60,
              bookingState: BookingState.PAID,
              attended: true,
              court: { number: 2 },
            },
          },
        },
      ]);
      find.mockResolvedValueOnce([
        { id: 9, penalizedScoring: -5, reason: "Inasistencia a turno reservado", createdAt: new Date("2026-10-02T00:00:00Z") },
        { id: 8, penalizedScoring: 20, reason: "Asistencia a turno reservado", createdAt: new Date("2026-09-30T00:00:00Z") },
      ]);

      const result = await getPlayerRecordAdmin(3);

      expect(result).toEqual({
        success: true,
        data: {
          id: 3,
          names: "Ana",
          lastnames: "Gomez",
          email: "ana@test.com",
          phoneNumber: "2215550101",
          category: "4th",
          scoring: 15,
          isBlocked: false,
          noShows: 2,
          // Ordenadas de la más reciente a la más antigua, sin repetir el partido propio.
          bookings: [
            {
              id: 4,
              fromDateTime: "2026-10-08T18:00:00.000Z",
              durationMinutes: 60,
              courtNumber: 2,
              bookingState: BookingState.PAID,
              isOpenMatch: true,
              attended: false,
            },
            {
              id: 2,
              fromDateTime: "2026-10-05T10:00:00.000Z",
              durationMinutes: 90,
              courtNumber: 1,
              bookingState: BookingState.RESERVED,
              isOpenMatch: true,
              attended: true,
            },
            {
              id: 1,
              fromDateTime: "2026-10-01T10:00:00.000Z",
              durationMinutes: 90,
              courtNumber: 3,
              bookingState: BookingState.RESERVED,
              isOpenMatch: false,
              attended: false,
            },
          ],
          movements: [
            { id: 9, amount: -5, description: "Inasistencia a turno reservado", createdAt: "2026-10-02T00:00:00.000Z" },
            { id: 8, amount: 20, description: "Asistencia a turno reservado", createdAt: "2026-09-30T00:00:00.000Z" },
          ],
        },
      });
    });

    it("no cuenta como inasistencia un turno cancelado", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(player);
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: new Date("2026-10-01T10:00:00Z"),
          durationMinutes: 90,
          bookingState: BookingState.CANCELLED,
          attended: false,
          court: { number: 3 },
          match: null,
        },
      ]);
      find.mockResolvedValueOnce([]);
      find.mockResolvedValueOnce([]);

      const result = await getPlayerRecordAdmin(3);

      if (!result.success) throw new Error("expected success");
      expect(result.data.noShows).toBe(0);
      expect(result.data.bookings).toHaveLength(1);
    });

    it("devuelve error si el jugador no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await getPlayerRecordAdmin(999);

      expect(result).toEqual({ success: false, error: "El jugador no existe." });
      expect(find).not.toHaveBeenCalled();
    });

    it("devuelve error genérico si falla la BD", async () => {
      mockAdminSession();
      findOne.mockRejectedValueOnce(new Error("db error"));

      const result = await getPlayerRecordAdmin(3);

      expect(result).toEqual({ success: false, error: "No se pudo obtener la ficha del jugador." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await getPlayerRecordAdmin(3);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });
});

