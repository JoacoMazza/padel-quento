import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next-auth/next", () => ({
  getServerSession: vi.fn(),
}));

import { getServerSession } from "next-auth/next";
import { AdminAccessLevel, BookingState, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createPlayer } from "@/src/actions/player";
import { deleteBooking, updateBooking } from "@/src/actions/booking";
import { setBookingAttendance } from "@/src/actions/attendance";
import { getAttendanceReport } from "@/src/actions/reports";
import { createTestAdmin, createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";
import { createBookingForPlayer } from "@/src/lib/bookings";

// Métricas y reportes son solo para el dueño del complejo.
let ownerEmail = "";
let staffEmail = "";
beforeAll(async () => {
  ownerEmail = (await createTestAdmin(AdminAccessLevel.OWNER)).email;
  staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
});

function mockAdminSession(email = ownerEmail) {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { email, name: "Admin", role: Role.ADMIN },
  } as never);
}

const HOUR = 60 * 60_000;

describe("getAttendanceReport (integración con Postgres real)", () => {
  let attendingId: number;
  let absentId: number;
  const bookingIds: number[] = [];
  const now = Date.now();
  // Desde hace dos días hasta mañana: incluye turnos finalizados y uno por venir.
  const range = { from: new Date(now - 48 * HOUR), to: new Date(now + 24 * HOUR) };

  beforeAll(async () => {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    const courtId = court.data.id;

    const createTestPlayer = async (lastnames: string) => {
      const player = await createPlayer({
        phoneNumber: uniquePhoneNumber(),
        email: `reporte.${lastnames}.${Date.now()}@test.com`,
        password: "secreto123",
        names: "Reporte",
        lastnames,
      });
      if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
      return player.data.id;
    };
    attendingId = await createTestPlayer("Asiste");
    absentId = await createTestPlayer("Falta");

    const create = async (bookerId: number, fromDateTime: Date) => {
      const result = await createBookingForPlayer({ fromDateTime, bookerId, courtId, bookingState: BookingState.PAID });
      if (!result.success) throw new Error(`no se pudo crear el turno: ${result.error}`);
      bookingIds.push(result.data.id);
      return result.data.id;
    };

    // Turnos ya finalizados: uno con asistencia y otro marcado como ausente.
    await create(attendingId, new Date(now - 30 * HOUR));
    const missed = await create(absentId, new Date(now - 27 * HOUR));
    mockAdminSession();
    await setBookingAttendance(missed, false);

    // Turno que todavía no se jugó: no cuenta.
    await create(attendingId, new Date(now + 10 * HOUR));

    // Cancelación tardía: falta menos de 3 horas para el turno.
    const late = await create(absentId, new Date(now + 1 * HOUR));
    const cancelled = await updateBooking(late, { bookingState: BookingState.CANCELLED });
    if (!cancelled.success) throw new Error("no se pudo cancelar el turno de prueba");
  });

  afterAll(async () => {
    // Los archivos comparten la base de test: sin borrar estos turnos, otros tests
    // que buscan "el" turno pago o reservado podrían encontrar uno de acá.
    for (const id of bookingIds) {
      await deleteBooking(id);
    }
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("cuenta asistencias, ausencias y cancelaciones tardías de cada jugador en el rango", async () => {
    mockAdminSession();

    const result = await getAttendanceReport(range);

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const attending = result.data.byPlayer.find((row) => row.player.id === attendingId);
    const absent = result.data.byPlayer.find((row) => row.player.id === absentId);
    expect(attending).toEqual({
      player: expect.objectContaining({ id: attendingId, lastnames: "Asiste" }),
      attended: 1,
      noShows: 0,
      lateCancellations: 0,
      absenteeismRate: 0,
    });
    expect(absent).toEqual({
      player: expect.objectContaining({ id: absentId, lastnames: "Falta" }),
      attended: 0,
      noShows: 1,
      lateCancellations: 1,
      absenteeismRate: 1,
    });
  });

  it("no incluye lo que queda fuera del rango de fechas", async () => {
    mockAdminSession();

    const result = await getAttendanceReport({
      from: new Date(now - 10 * 24 * HOUR),
      to: new Date(now - 5 * 24 * HOUR),
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.byPlayer.map((row) => row.player.id)).not.toContain(attendingId);
    expect(result.data.byPlayer.map((row) => row.player.id)).not.toContain(absentId);
  });

  it("rechaza el acceso a quien no es administrador", async () => {
    vi.mocked(getServerSession).mockResolvedValue({
      user: { email: "jugador@test.com", name: "Jugador", role: Role.PLAYER },
    } as never);

    const result = await getAttendanceReport(range);

    expect(result.success).toBe(false);
  });

  it("rechaza el acceso a un trabajador (es solo para el dueño)", async () => {
    mockAdminSession(staffEmail);

    const result = await getAttendanceReport(range);

    expect(result).toEqual({ success: false, error: "Solo el dueño del complejo puede hacer esto." });
  });
});
