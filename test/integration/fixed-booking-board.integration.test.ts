import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessLevel, BookingState, DayOfWeek, FixedBookingFrequency, Role } from "@/src/domain/enums";
import { addDaysISO, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";
import { createSchedule } from "@/src/actions/schedule";
import { createPlayer } from "@/src/actions/player";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { getScheduleBoardData } from "@/src/actions/scheduleBoard";
import {
  cancelFixedBooking,
  createFixedBooking,
  getFixedBookingsAdmin,
  releaseFixedBookingDate,
} from "@/src/actions/fixedBooking";
import { createTestAdmin, createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

vi.mock("@/src/lib/notifications", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

let ownerEmail = "";
let staffEmail = "";

function mockSession(email: string, role: Role) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email, role } } as never);
}

describe("turnos fijos en la Turnera Global (flujo completo)", () => {
  const startDate = addDaysISO(todayISO(), 7);
  const endDate = addDaysISO(startDate, 14);
  let playerId = 0;
  let otherId = 0;

  async function newCourt() {
    const court = await createTestCourt({ number: uniqueCourtNumber(), price: 20000 });
    mockSession(ownerEmail, Role.ADMIN);
    for (const dayOfWeek of Object.values(DayOfWeek)) {
      await createSchedule({
        dayOfWeek,
        openingTime: "09:00:00" as unknown as Date,
        closingTime: "23:00:00" as unknown as Date,
        courtId: court.data.id,
      });
    }
    return court.data.id;
  }

  async function newPlayer(names: string) {
    const created = await createPlayer({
      email: `${names}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`,
      phoneNumber: uniquePhoneNumber(),
      password: "secreto123",
      names,
      lastnames: "Grilla",
    });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    return created.data.id;
  }

  /** Turnos no cancelados de la cancha en la grilla, con su marca de turno fijo. */
  async function boardFor(courtId: number) {
    const board = await getScheduleBoardData();
    if (!board.success) throw new Error(board.error);
    const fixedIds = new Set(board.data.fixedBookingDates.map((d) => d.bookingId));
    return board.data.bookings
      .filter((b) => b.court.id === courtId && b.bookingState !== BookingState.CANCELLED)
      .map((b) => ({ start: new Date(b.fromDateTime).getTime(), isFixed: fixedIds.has(b.id) }))
      .sort((a, b) => a.start - b.start);
  }

  function slot(date: string) {
    return occurrenceStart(date, "18:00").getTime();
  }

  beforeAll(async () => {
    ownerEmail = (await createTestAdmin()).email;
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
    playerId = await newPlayer("Fede");
    otherId = await newPlayer("Otro");
  });

  beforeEach(() => {
    mockSession(staffEmail, Role.ADMIN);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("un admin (no dueño) crea el turno fijo y sus fechas aparecen ocupadas como turno fijo en la grilla", async () => {
    const courtId = await newCourt();
    mockSession(staffEmail, Role.ADMIN);

    const created = await createFixedBooking({
      courtId,
      startDate,
      endDate,
      startTime: "18:00",
      frequency: FixedBookingFrequency.WEEKLY,
      holder: { playerId },
    });

    expect(created).toEqual({ success: true, data: { id: expect.any(Number), conflicts: [] } });
    expect(await boardFor(courtId)).toEqual([
      { start: slot(startDate), isFixed: true },
      { start: slot(addDaysISO(startDate, 7)), isFixed: true },
      { start: slot(endDate), isFixed: true },
    ]);

    const someoneElse = await createBookingForPlayer({
      fromDateTime: occurrenceStart(startDate, "18:00"),
      bookerId: otherId,
      courtId,
      groupSize: 4,
    });
    expect(someoneElse.success).toBe(false);
  });

  it("liberar una fecha la deja libre en la grilla y cancelar libera todas las fechas futuras", async () => {
    const courtId = await newCourt();
    mockSession(staffEmail, Role.ADMIN);
    const created = await createFixedBooking({
      courtId,
      startDate,
      endDate,
      startTime: "18:00",
      frequency: FixedBookingFrequency.WEEKLY,
      holder: { playerId },
    });
    if (!created.success) throw new Error(created.error);
    const list = await getFixedBookingsAdmin();
    if (!list.success) throw new Error(list.error);
    const second = list.data.find((f) => f.id === created.data.id)!.upcomingDates[1];

    expect(await releaseFixedBookingDate(second.id)).toEqual({ success: true, data: null });
    expect(await boardFor(courtId)).toEqual([
      { start: slot(startDate), isFixed: true },
      { start: slot(endDate), isFixed: true },
    ]);

    expect(await cancelFixedBooking(created.data.id)).toEqual({ success: true, data: null });
    expect(await boardFor(courtId)).toEqual([]);
  });
});
