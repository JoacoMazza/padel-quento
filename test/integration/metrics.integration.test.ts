import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { BookingState, DayOfWeek, OutOfServiceReason, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, deleteBooking } from "@/src/actions/booking";
import { createSchedule } from "@/src/actions/schedule";
import { createOutOfService } from "@/src/actions/outOfService";
import { getOccupancyReportData } from "@/src/actions/metrics";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

function mockAdminSession() {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email: "admin@test.com", name: "Admin", role: Role.ADMIN },
  } as never);
}

// Un día propio en el futuro lejano para no cruzarse con los turnos de otros tests.
const day = new Date(Date.now() + 200 * 24 * 60 * 60 * 1000);
day.setHours(0, 0, 0, 0);
const at = (hours: number, dayOffset = 0) => {
  const date = new Date(day);
  date.setDate(date.getDate() + dayOffset);
  date.setHours(hours, 0, 0, 0);
  return date;
};

describe("getOccupancyReportData (integración con Postgres real)", () => {
  let courtId: number;
  let courtNumber: number;
  const bookingIds: Record<string, number> = {};

  beforeAll(async () => {
    courtNumber = uniqueCourtNumber();
    const court = await createCourt({ number: courtNumber, price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    await createSchedule({
      dayOfWeek: DayOfWeek.MONDAY,
      // La columna "time" guarda la hora local del Date.
      openingTime: new Date(1970, 0, 1, 8, 0),
      closingTime: new Date(1970, 0, 1, 23, 0),
      courtId,
    });

    const player = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: `metricas.${Date.now()}@test.com`,
      password: "pass123",
      names: "Metricas",
      lastnames: "Test",
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    const bookerId = player.data.id;

    const create = async (key: string, fromDateTime: Date, bookingState: BookingState) => {
      const result = await createBooking({ fromDateTime, bookingState, bookerId, courtId });
      if (!result.success) throw new Error(`no se pudo crear el turno ${key}: ${result.error}`);
      bookingIds[key] = result.data.id;
    };
    await create("reserved", at(8), BookingState.RESERVED);
    await create("paid", at(10), BookingState.PAID);
    await create("cancelled", at(12), BookingState.CANCELLED);
    await create("outOfRange", at(10, 2), BookingState.RESERVED);

    await createOutOfService({
      fromDateTime: at(18),
      toDateTime: at(20),
      reason: OutOfServiceReason.MAINTENANCE,
      courtId,
    });
    await createOutOfService({
      fromDateTime: at(18, 3),
      toDateTime: at(20, 3),
      reason: OutOfServiceReason.CLEANING,
      courtId,
    });
  });

  afterAll(async () => {
    // Los archivos comparten la base de test: sin borrar estos turnos, otros tests
    // que buscan "el" turno pago o reservado podrían encontrar uno de acá.
    for (const id of Object.values(bookingIds)) {
      await deleteBooking(id);
    }
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("trae solo las reservas activas y los bloqueos que caen en el rango", async () => {
    mockAdminSession();
    const to = new Date(day);
    to.setHours(23, 59, 59, 999);

    const result = await getOccupancyReportData({ from: day, to });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.courts).toContainEqual({ id: courtId, number: courtNumber });
    expect(result.data.schedules.filter((s) => s.courtId === courtId)).toEqual([
      { courtId, dayOfWeek: DayOfWeek.MONDAY, openingTime: "08:00:00", closingTime: "23:00:00" },
    ]);

    const bookings = result.data.bookings.filter((b) => b.courtId === courtId);
    expect(bookings.map((b) => b.fromDateTime.getTime()).sort()).toEqual([at(8).getTime(), at(10).getTime()]);
    expect(bookings.every((b) => b.durationMinutes === 90)).toBe(true);

    expect(result.data.outOfServices.filter((o) => o.courtId === courtId)).toEqual([
      { courtId, fromDateTime: at(18), toDateTime: at(20) },
    ]);
  });

  it("rechaza el acceso a quien no es administrador", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
    } as never);

    const result = await getOccupancyReportData({ from: day, to: at(23) });

    expect(result.success).toBe(false);
  });
});
