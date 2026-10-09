import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

// Un find mockeado por repositorio, para devolver datos distintos a cada consulta.
const { finds, getDataSource } = vi.hoisted(() => {
  const finds: Record<string, ReturnType<typeof vi.fn>> = {
    Court: vi.fn(),
    Schedule: vi.fn(),
    Booking: vi.fn(),
    OutOfService: vi.fn(),
  };
  const getRepository = vi.fn((name: string) => ({ find: finds[name] }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { finds, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import { getServerSession } from "next-auth/next";
import { BookingState, DayOfWeek, Role } from "@/src/domain/enums";
import { getOccupancyReportData } from "@/src/actions/metrics";

function mockSession(role: Role | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    role ? ({ user: { email: "user@test.com", name: "User", role } } as never) : null,
  );
}

const from = new Date(2026, 9, 1);
const to = new Date(2026, 9, 31, 23, 59, 59, 999);

describe("getOccupancyReportData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("devuelve canchas, horarios, reservas activas y bloqueos del rango como objetos planos", async () => {
    mockSession(Role.ADMIN);
    finds.Court.mockResolvedValueOnce([{ id: 1, number: 3, state: "available", price: 10000 }]);
    finds.Schedule.mockResolvedValueOnce([
      { id: 5, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00", court: { id: 1 } },
    ]);
    finds.Booking.mockResolvedValueOnce([
      {
        id: 7,
        fromDateTime: new Date(2026, 9, 12, 18, 0),
        durationMinutes: 90,
        bookingState: BookingState.PAID,
        court: { id: 1 },
      },
    ]);
    finds.OutOfService.mockResolvedValueOnce([
      { id: 9, fromDateTime: new Date(2026, 9, 13, 8, 0), toDateTime: new Date(2026, 9, 13, 12, 0), court: { id: 1 } },
    ]);

    const result = await getOccupancyReportData({ from, to });

    expect(result).toEqual({
      success: true,
      data: {
        courts: [{ id: 1, number: 3 }],
        schedules: [{ courtId: 1, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00" }],
        bookings: [{ courtId: 1, fromDateTime: new Date(2026, 9, 12, 18, 0), durationMinutes: 90 }],
        outOfServices: [
          { courtId: 1, fromDateTime: new Date(2026, 9, 13, 8, 0), toDateTime: new Date(2026, 9, 13, 12, 0) },
        ],
      },
    });
  });

  it("rechaza un rango con la fecha de inicio posterior a la de fin", async () => {
    mockSession(Role.ADMIN);

    const result = await getOccupancyReportData({ from: to, to: from });

    expect(result).toEqual({ success: false, error: "El rango de fechas no es válido." });
    expect(finds.Booking).not.toHaveBeenCalled();
  });

  it("devuelve error genérico si falla la BD", async () => {
    mockSession(Role.ADMIN);
    finds.Court.mockRejectedValueOnce(new Error("db down"));

    const result = await getOccupancyReportData({ from, to });

    expect(result).toEqual({ success: false, error: "No se pudieron obtener las métricas de ocupación." });
  });

  it("devuelve error si el usuario no es admin", async () => {
    mockSession(Role.PLAYER);

    const result = await getOccupancyReportData({ from, to });

    expect(result.success).toBe(false);
    expect(finds.Court).not.toHaveBeenCalled();
  });

  it("devuelve error si no hay sesión", async () => {
    mockSession(null);

    const result = await getOccupancyReportData({ from, to });

    expect(result.success).toBe(false);
    expect(finds.Court).not.toHaveBeenCalled();
  });
});
