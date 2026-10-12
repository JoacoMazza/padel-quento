import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Un find mockeado por repositorio, para devolver datos distintos a cada consulta.
const { finds, getDataSource } = vi.hoisted(() => {
  const finds: Record<string, ReturnType<typeof vi.fn>> = {
    Booking: vi.fn(),
    Penalty: vi.fn(),
  };
  const getRepository = vi.fn((name: string) => ({ find: finds[name] }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { finds, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { getServerSession } from "next-auth/next";
import { BookingState, Role } from "@/src/domain/enums";
import { getAttendanceReport } from "@/src/actions/reports";

function mockSession(role: Role | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    role ? ({ user: { email: "user@test.com", name: "User", role } } as never) : null,
  );
}

const from = new Date(2026, 9, 1);
const to = new Date(2026, 9, 31, 23, 59, 59, 999);

// Entidades tal como las devuelve TypeORM (con más campos de los que usa el reporte).
const ana = { id: 1, names: "Ana", lastnames: "García", phoneNumber: "2211111111", scoring: 40 };
const beto = { id: 2, names: "Beto", lastnames: "López", phoneNumber: "2212222222", scoring: 10 };
const plain = ({ id, names, lastnames, phoneNumber }: typeof ana) => ({ id, names, lastnames, phoneNumber });

describe("getAttendanceReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 9, 20, 12, 0));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cuenta la asistencia de los turnos ya finalizados y las cancelaciones tardías del rango", async () => {
    mockSession(Role.ADMIN);
    finds.Booking.mockResolvedValueOnce([
      // Turno simple: cuenta la asistencia de quien reservó.
      {
        id: 10,
        fromDateTime: new Date(2026, 9, 5, 18, 0),
        durationMinutes: 90,
        bookingState: BookingState.PAID,
        attended: true,
        booker: ana,
      },
      // Partido abierto: cuenta la asistencia de cada jugador confirmado.
      {
        id: 11,
        fromDateTime: new Date(2026, 9, 6, 18, 0),
        durationMinutes: 90,
        bookingState: BookingState.RESERVED,
        attended: true,
        booker: ana,
        match: {
          matchPlayers: [
            { attended: true, player: ana },
            { attended: false, player: beto },
          ],
        },
      },
      // Todavía no terminó: no cuenta ni como asistencia ni como ausencia.
      {
        id: 12,
        fromDateTime: new Date(2026, 9, 20, 11, 0),
        durationMinutes: 90,
        bookingState: BookingState.RESERVED,
        attended: true,
        booker: beto,
      },
      // Turno previo a la migración, sin quien reservó: no hay jugador al que atribuirlo.
      {
        id: 13,
        fromDateTime: new Date(2026, 9, 7, 18, 0),
        durationMinutes: 90,
        bookingState: BookingState.PAID,
        attended: false,
        booker: null,
      },
    ]);
    // Penalidades por cancelación tardía (sin importar cuántos puntos descontaron).
    finds.Penalty.mockResolvedValueOnce([{ id: 50, penalizedScoring: 0, player: beto }]);

    const result = await getAttendanceReport({ from, to });

    expect(result).toEqual({
      success: true,
      data: {
        total: { attended: 2, noShows: 1, lateCancellations: 1, absenteeismRate: 2 / 4 },
        byPlayer: [
          { player: plain(beto), attended: 0, noShows: 1, lateCancellations: 1, absenteeismRate: 1 },
          { player: plain(ana), attended: 2, noShows: 0, lateCancellations: 0, absenteeismRate: 0 },
        ],
      },
    });
  });

  it("rechaza un rango con la fecha de inicio posterior a la de fin", async () => {
    mockSession(Role.ADMIN);

    const result = await getAttendanceReport({ from: to, to: from });

    expect(result).toEqual({ success: false, error: "El rango de fechas no es válido." });
    expect(finds.Booking).not.toHaveBeenCalled();
  });

  it("devuelve error genérico si falla la BD", async () => {
    mockSession(Role.ADMIN);
    finds.Booking.mockRejectedValueOnce(new Error("db down"));

    const result = await getAttendanceReport({ from, to });

    expect(result).toEqual({ success: false, error: "No se pudo generar el reporte de asistencia." });
  });

  it("devuelve error si el usuario no es admin", async () => {
    mockSession(Role.PLAYER);

    const result = await getAttendanceReport({ from, to });

    expect(result.success).toBe(false);
    expect(finds.Booking).not.toHaveBeenCalled();
  });

  it("devuelve error si no hay sesión", async () => {
    mockSession(null);

    const result = await getAttendanceReport({ from, to });

    expect(result.success).toBe(false);
    expect(finds.Booking).not.toHaveBeenCalled();
  });
});
