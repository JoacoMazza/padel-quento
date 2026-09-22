import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, Role } from "@/src/domain/enums";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

const { find, findOne, update, getDataSource } = vi.hoisted(() => {
  const find = vi.fn();
  const findOne = vi.fn();
  const update = vi.fn(async () => ({ affected: 1 }));
  const getRepository = vi.fn(() => ({ find, findOne, update }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { find, findOne, update, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

const { recordPointsMovement } = vi.hoisted(() => ({
  recordPointsMovement: vi.fn(async () => true),
}));

vi.mock("@/src/actions/profile", () => ({ recordPointsMovement }));

import { getServerSession } from "next-auth/next";
import {
  setBookingAttendance,
  setMatchPlayerAttendance,
  awardAttendancePoints,
} from "@/src/actions/attendance";

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

describe("attendance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setBookingAttendance", () => {
    it("marca la asistencia del turno cuando es admin", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 1, attended: true, match: null });

      const result = await setBookingAttendance(1, false);

      expect(update).toHaveBeenCalledWith(1, { attended: false });
      expect(result).toEqual({ success: true, data: expect.objectContaining({ attended: false }) });
    });

    it("devuelve error si el turno no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await setBookingAttendance(999, false);

      expect(result).toEqual({ success: false, error: "El turno no existe." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si el turno es un partido abierto", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 1, attended: true, match: { id: 5 } });

      const result = await setBookingAttendance(1, false);

      expect(result).toEqual({
        success: false,
        error: "Este turno es un partido abierto: marcá la asistencia de cada jugador por separado.",
      });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await setBookingAttendance(1, false);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe("setMatchPlayerAttendance", () => {
    it("marca la asistencia de un jugador del partido cuando es admin", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 10, attended: true });

      const result = await setMatchPlayerAttendance(10, false);

      expect(update).toHaveBeenCalledWith(10, { attended: false });
      expect(result).toEqual({ success: true, data: expect.objectContaining({ attended: false }) });
    });

    it("devuelve error si el jugador del partido no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await setMatchPlayerAttendance(999, false);

      expect(result).toEqual({ success: false, error: "El jugador no forma parte de este partido." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await setMatchPlayerAttendance(10, false);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
    });
  });

  describe("awardAttendancePoints", () => {
    it("acredita los puntos al jugador de un turno simple ya finalizado y sin marcar ausente", async () => {
      const past = new Date(Date.now() - 2 * 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: past,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: true,
          player: { id: 42 },
          match: null,
        },
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).toHaveBeenCalledWith(42, expect.any(Number), "bonus", expect.any(String));
      expect(update).toHaveBeenCalledWith(1, { pointsAwarded: true });
      expect(result).toEqual({ success: true, data: 1 });
    });

    it("no acredita puntos si el turno fue marcado como ausente", async () => {
      const past = new Date(Date.now() - 2 * 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: past,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: false,
          player: { id: 42 },
          match: null,
        },
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(1, { pointsAwarded: true });
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("no procesa turnos que todavía no finalizaron", async () => {
      const future = new Date(Date.now() + 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: future,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: true,
          player: { id: 42 },
          match: null,
        },
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("no procesa turnos cancelados", async () => {
      const past = new Date(Date.now() - 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 1,
          fromDateTime: past,
          durationMinutes: 90,
          bookingState: BookingState.CANCELLED,
          attended: true,
          player: { id: 42 },
          match: null,
        },
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("acredita puntos a cada jugador del partido abierto que no fue marcado ausente", async () => {
      const past = new Date(Date.now() - 2 * 60 * 60_000);
      find.mockResolvedValueOnce([
        {
          id: 2,
          fromDateTime: past,
          durationMinutes: 90,
          bookingState: BookingState.RESERVED,
          attended: true,
          player: { id: 1 },
          match: {
            id: 1,
            matchPlayers: [
              { id: 10, attended: true, player: { id: 1 } },
              { id: 11, attended: false, player: { id: 2 } },
              { id: 12, attended: true, player: { id: 3 } },
            ],
          },
        },
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).toHaveBeenCalledWith(1, expect.any(Number), "bonus", expect.any(String));
      expect(recordPointsMovement).toHaveBeenCalledWith(3, expect.any(Number), "bonus", expect.any(String));
      expect(recordPointsMovement).not.toHaveBeenCalledWith(2, expect.any(Number), "bonus", expect.any(String));
      expect(recordPointsMovement).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledWith(2, { pointsAwarded: true });
      expect(result).toEqual({ success: true, data: 2 });
    });

    it("devuelve error genérico si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("boom"));

      const result = await awardAttendancePoints();

      expect(result).toEqual({
        success: false,
        error: "No se pudieron acreditar los puntos por asistencia.",
      });
    });
  });
});
