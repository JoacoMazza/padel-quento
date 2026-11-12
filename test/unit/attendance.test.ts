import { beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, Role } from "@/src/domain/enums";
import { ATTENDANCE_POINTS, OPEN_MATCH_JOIN_BONUS_POINTS } from "@/src/domain/constants";
import { NO_SHOW_PENALTY_REASON } from "@/src/domain/attendance";

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

const { recordPointsMovement, syncNoShowPenalty } = vi.hoisted(() => ({
  recordPointsMovement: vi.fn(async () => true),
  syncNoShowPenalty: vi.fn(async () => {}),
}));

vi.mock("@/src/actions/profile", () => ({ recordPointsMovement }));
vi.mock("@/src/lib/no-show-penalties", () => ({ syncNoShowPenalty }));

import { getServerSession } from "next-auth/next";
import {
  setBookingAttendance,
  setMatchPlayerAttendance,
  awardAttendancePoints,
} from "@/src/actions/attendance";

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as never);
}

function mockPlayerSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
  } as never);
}

/** Turno reservado que terminó hace media hora, sin partido ni clase. */
function endedBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    fromDateTime: new Date(Date.now() - 2 * 60 * 60_000),
    durationMinutes: 90,
    bookingState: BookingState.RESERVED,
    booker: { id: 42 },
    penalties: [],
    match: null,
    lesson: null,
    ...overrides,
  };
}

describe("attendance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("setBookingAttendance", () => {
    it("marcar ausente a quien reservó le aplica la inasistencia del turno", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 1, match: null, booker: { id: 42 } });

      const result = await setBookingAttendance(1, false);

      expect(syncNoShowPenalty).toHaveBeenCalledWith(1, 42, 1);
      expect(result).toEqual({ success: true, data: { id: 1, attended: false } });
    });

    it("marcarlo presente le saca la inasistencia", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 1, match: null, booker: { id: 42 } });

      await setBookingAttendance(1, true);

      expect(syncNoShowPenalty).toHaveBeenCalledWith(1, 42, 0);
    });

    it("devuelve error si el turno no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await setBookingAttendance(999, false);

      expect(result).toEqual({ success: false, error: "El turno no existe." });
      expect(syncNoShowPenalty).not.toHaveBeenCalled();
    });

    it("devuelve error si el turno es un partido abierto", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 1, match: { id: 5 }, booker: { id: 42 } });

      const result = await setBookingAttendance(1, false);

      expect(result).toEqual({
        success: false,
        error: "Este turno es un partido abierto: marcá la asistencia de cada jugador por separado.",
      });
      expect(syncNoShowPenalty).not.toHaveBeenCalled();
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await setBookingAttendance(1, false);

      expect(result.success).toBe(false);
      expect(findOne).not.toHaveBeenCalled();
      expect(syncNoShowPenalty).not.toHaveBeenCalled();
    });
  });

  describe("setMatchPlayerAttendance", () => {
    it("guarda cuántos del grupo asistieron y penaliza al jugador por cada ausente", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 10, playerId: 7, playersCount: 3, match: { booking: { id: 2 } } });

      const result = await setMatchPlayerAttendance(10, 1);

      expect(update).toHaveBeenCalledWith(10, { attendedCount: 1 });
      expect(syncNoShowPenalty).toHaveBeenCalledWith(2, 7, 2);
      expect(result).toEqual({ success: true, data: { id: 10, attendedCount: 1 } });
    });

    it("rechaza una cantidad de asistentes fuera del grupo", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce({ id: 10, playerId: 7, playersCount: 2, match: { booking: { id: 2 } } });

      const result = await setMatchPlayerAttendance(10, 3);

      expect(result).toEqual({ success: false, error: "La cantidad de asistentes tiene que ser de 0 a 2." });
      expect(update).not.toHaveBeenCalled();
    });

    it("devuelve error si el jugador del partido no existe", async () => {
      mockAdminSession();
      findOne.mockResolvedValueOnce(null);

      const result = await setMatchPlayerAttendance(999, 0);

      expect(result).toEqual({ success: false, error: "El jugador no forma parte de este partido." });
    });

    it("devuelve error si el usuario no es admin", async () => {
      mockPlayerSession();

      const result = await setMatchPlayerAttendance(10, 0);

      expect(result.success).toBe(false);
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe("awardAttendancePoints", () => {
    it("acredita los puntos al jugador de un turno simple ya finalizado y lo da por finalizado", async () => {
      find.mockResolvedValueOnce([endedBooking()]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).toHaveBeenCalledWith(42, ATTENDANCE_POINTS, "bonus", "Asistencia a turno reservado", 1);
      expect(update).toHaveBeenCalledWith(1, { bookingState: BookingState.FINISHED });
      expect(result).toEqual({ success: true, data: 1 });
    });

    it("no acredita ni descuenta puntos en un turno simple sin quien reservó (dato previo a la migración)", async () => {
      find.mockResolvedValueOnce([endedBooking({ booker: null })]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(1, { bookingState: BookingState.FINISHED });
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("no acredita puntos a quien fue marcado ausente (la penalización ya se aplicó al marcarlo)", async () => {
      find.mockResolvedValueOnce([endedBooking({ penalties: [{ reason: NO_SHOW_PENALTY_REASON }] })]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(1, { bookingState: BookingState.FINISHED });
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("no procesa turnos que todavía no finalizaron", async () => {
      // La consulta trae los que ya empezaron: este sigue en juego.
      find.mockResolvedValueOnce([endedBooking({ fromDateTime: new Date(Date.now() - 30 * 60_000) })]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("solo busca turnos reservados: los cancelados y los ya finalizados no se procesan", async () => {
      find.mockResolvedValueOnce([]);

      await awardAttendancePoints();

      expect(find).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ bookingState: BookingState.RESERVED }) }),
      );
    });

    it("los turnos de una clase se dan por finalizados sin mover puntos", async () => {
      find.mockResolvedValueOnce([endedBooking({ lesson: { id: 3 } })]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledWith(1, { bookingState: BookingState.FINISHED });
      expect(result).toEqual({ success: true, data: 0 });
    });

    it("acredita puntos a cada jugador presente del partido abierto y guarda lo acreditado", async () => {
      find.mockResolvedValueOnce([
        endedBooking({
          id: 2,
          booker: { id: 1 },
          match: {
            id: 1,
            matchPlayers: [
              { id: 10, playersCount: 1, attendedCount: 1, player: { id: 1 } },
              { id: 11, playersCount: 2, attendedCount: 0, player: { id: 2 } },
              // Faltó uno de sus acompañantes, pero él estuvo: cobra.
              { id: 12, playersCount: 2, attendedCount: 1, player: { id: 3 } },
            ],
          },
        }),
      ]);

      const result = await awardAttendancePoints();

      expect(recordPointsMovement).toHaveBeenCalledWith(1, ATTENDANCE_POINTS, "bonus", "Asistencia a turno reservado", 2);
      expect(recordPointsMovement).toHaveBeenCalledWith(3, ATTENDANCE_POINTS, "bonus", "Asistencia a turno reservado", 2);
      expect(recordPointsMovement).not.toHaveBeenCalledWith(2, expect.anything(), expect.anything(), expect.anything(), 2);
      // Jugadores 1 y 3 por asistencia, más el bonus del 3 por haberse sumado al partido de otro.
      expect(recordPointsMovement).toHaveBeenCalledTimes(3);
      expect(update).toHaveBeenCalledWith(10, { pointsAwarded: ATTENDANCE_POINTS });
      expect(update).toHaveBeenCalledWith(12, { pointsAwarded: ATTENDANCE_POINTS + OPEN_MATCH_JOIN_BONUS_POINTS });
      expect(update).not.toHaveBeenCalledWith(11, expect.anything());
      expect(update).toHaveBeenCalledWith(2, { bookingState: BookingState.FINISHED });
      expect(result).toEqual({ success: true, data: 2 });
    });

    it("acredita el bonus por sumarse a un partido abierto solo a quienes se sumaron y asistieron", async () => {
      find.mockResolvedValueOnce([
        endedBooking({
          id: 3,
          booker: { id: 1 },
          match: {
            id: 1,
            matchPlayers: [
              { id: 10, playersCount: 1, attendedCount: 1, player: { id: 1 } },
              { id: 11, playersCount: 1, attendedCount: 0, player: { id: 2 } },
              { id: 12, playersCount: 1, attendedCount: 1, player: { id: 3 } },
            ],
          },
        }),
      ]);

      await awardAttendancePoints();

      const joinBonusReason = "Bonus por sumarse a un partido abierto";
      expect(recordPointsMovement).toHaveBeenCalledWith(3, OPEN_MATCH_JOIN_BONUS_POINTS, "bonus", joinBonusReason, 3);
      expect(recordPointsMovement).not.toHaveBeenCalledWith(1, expect.any(Number), "bonus", joinBonusReason, 3);
      expect(recordPointsMovement).not.toHaveBeenCalledWith(2, expect.any(Number), "bonus", joinBonusReason, 3);
    });

    it("no acredita el bonus por partido abierto en un turno simple", async () => {
      find.mockResolvedValueOnce([endedBooking({ id: 4 })]);

      await awardAttendancePoints();

      expect(recordPointsMovement).toHaveBeenCalledTimes(1);
      expect(recordPointsMovement).toHaveBeenCalledWith(42, ATTENDANCE_POINTS, "bonus", "Asistencia a turno reservado", 4);
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
