import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, CourtState, DayOfWeek, OutOfServiceReason, Role } from "@/src/domain/enums";
import { addDaysISO, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";
import { Booker } from "@/src/entities/Booker";
import { Booking } from "@/src/entities/Booking";
import { createCourt, updateCourt } from "@/src/actions/court";
import { createSchedule } from "@/src/actions/schedule";
import { blockPlayer, createPlayer } from "@/src/actions/player";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { createOutOfService } from "@/src/actions/outOfService";
import { createBookingAdmin, getAvailableSlotsAdmin } from "@/src/actions/adminBooking";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

vi.mock("@/src/lib/notifications", () => ({ notify: vi.fn(async () => {}) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

function mockSession(role: Role | null) {
  vi.mocked(getServerSession).mockResolvedValue(
    role ? ({ user: { email: "admin@test.com", role } } as never) : null,
  );
}

const ALL_DAYS = Object.values(DayOfWeek);

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

describe("turnos comunes agendados por el admin (integración con Postgres real)", () => {
  const date = addDaysISO(todayISO(), 3);
  let player: { id: number; phoneNumber: string };

  async function newCourt(price = 20000) {
    const court = await createCourt({ number: uniqueCourtNumber(), price });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    for (const dayOfWeek of ALL_DAYS) {
      await createSchedule({
        dayOfWeek,
        openingTime: "09:00:00" as unknown as Date,
        closingTime: "23:00:00" as unknown as Date,
        courtId: court.data.id,
      });
    }
    return court.data.id;
  }

  async function newPlayer() {
    const phoneNumber = uniquePhoneNumber();
    const created = await createPlayer({
      email: uniqueEmail("agenda"),
      phoneNumber,
      password: "secreto123",
      names: "Ana",
      lastnames: "Agenda",
    });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: created.data.id, phoneNumber };
  }

  async function bookingById(id: number) {
    const dataSource = await getDataSource();
    return dataSource
      .getRepository<Booking>("Booking")
      .findOneOrFail({ where: { id }, relations: { booker: true, court: true, match: true } });
  }

  beforeAll(async () => {
    player = await newPlayer();
  });

  beforeEach(() => {
    mockSession(Role.ADMIN);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("agenda un turno completo a nombre de un jugador registrado, con el precio de la cancha", async () => {
    const courtId = await newCourt(25000);

    const result = await createBookingAdmin({ courtId, date, startTime: "18:00", holder: { playerId: player.id } });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error(result.error);
    const booking = await bookingById(result.data.id);
    expect(booking.booker.id).toBe(player.id);
    expect(booking.court.id).toBe(courtId);
    expect(booking.fromDateTime.getTime()).toBe(occurrenceStart(date, "18:00").getTime());
    expect(booking.durationMinutes).toBe(90);
    expect(booking.bookingState).toBe(BookingState.RESERVED);
    expect(booking.price).toBe(25000);
    // Turno completo: no se publica como partido abierto.
    expect(booking.match).toBeNull();
  });

  it("agenda a nombre de alguien sin cuenta, creando su registro por teléfono", async () => {
    const courtId = await newCourt();
    const phoneNumber = uniquePhoneNumber();

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime: "20:00",
      holder: { names: "Carla", lastnames: "Mostrador", phoneNumber },
    });

    if (!result.success) throw new Error(result.error);
    const booking = await bookingById(result.data.id);
    expect(booking.booker).toMatchObject({ names: "Carla", lastnames: "Mostrador", phoneNumber });
  });

  it("si ya hay alguien con ese teléfono, el turno queda a su nombre sin duplicarlo", async () => {
    const courtId = await newCourt();

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime: "12:00",
      holder: { names: "Otro", lastnames: "Nombre", phoneNumber: player.phoneNumber },
    });

    if (!result.success) throw new Error(result.error);
    expect((await bookingById(result.data.id)).booker.id).toBe(player.id);
    const dataSource = await getDataSource();
    expect(await dataSource.getRepository<Booker>("Booker").count({ where: { phoneNumber: player.phoneNumber } })).toBe(1);
  });

  it("no agenda sobre un turno que ya ocupa ese horario", async () => {
    const courtId = await newCourt();
    const existing = await createBookingForPlayer({
      fromDateTime: occurrenceStart(date, "18:00"),
      bookerId: player.id,
      courtId,
    });
    expect(existing.success).toBe(true);

    const result = await createBookingAdmin({ courtId, date, startTime: "19:00", holder: { playerId: player.id } });

    expect(result).toEqual({ success: false, error: "Ese horario ya está ocupado en esta cancha." });
  });

  it("no agenda durante un bloqueo de la cancha", async () => {
    const courtId = await newCourt();
    const blocked = await createOutOfService({
      courtId,
      fromDateTime: occurrenceStart(date, "17:00"),
      toDateTime: occurrenceStart(date, "21:00"),
      reason: OutOfServiceReason.MAINTENANCE,
    });
    expect(blocked.success).toBe(true);

    const result = await createBookingAdmin({ courtId, date, startTime: "18:00", holder: { playerId: player.id } });

    expect(result).toEqual({ success: false, error: "Ese horario ya está ocupado en esta cancha." });
  });

  it("no agenda fuera del horario de la cancha", async () => {
    const courtId = await newCourt();

    const result = await createBookingAdmin({ courtId, date, startTime: "22:00", holder: { playerId: player.id } });

    expect(result).toEqual({ success: false, error: "La cancha no está abierta en ese horario ese día." });
  });

  it("no agenda en un horario que ya pasó", async () => {
    const courtId = await newCourt();

    const result = await createBookingAdmin({
      courtId,
      date: addDaysISO(todayISO(), -1),
      startTime: "18:00",
      holder: { playerId: player.id },
    });

    expect(result).toEqual({ success: false, error: "No se puede agendar un turno en un horario que ya pasó." });
  });

  it("no agenda en una cancha dada de baja", async () => {
    const courtId = await newCourt();
    await updateCourt(courtId, { state: CourtState.CLOSED_DOWN });

    const result = await createBookingAdmin({ courtId, date, startTime: "18:00", holder: { playerId: player.id } });

    expect(result).toEqual({ success: false, error: "La cancha está dada de baja." });
  });

  it("no agenda a nombre de un jugador bloqueado", async () => {
    const courtId = await newCourt();
    const blockedPlayer = await newPlayer();
    await blockPlayer(blockedPlayer.id);

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime: "18:00",
      holder: { playerId: blockedPlayer.id },
    });

    expect(result).toEqual({
      success: false,
      error: "El jugador está bloqueado: desbloquealo desde Gestión de Usuarios para agendarle un turno.",
    });
  });

  it("pide completar los datos de alguien sin cuenta", async () => {
    const courtId = await newCourt();

    const result = await createBookingAdmin({
      courtId,
      date,
      startTime: "18:00",
      holder: { names: "Sin", lastnames: " ", phoneNumber: uniquePhoneNumber() },
    });

    expect(result).toEqual({ success: false, error: "Completá el nombre, el apellido y el teléfono del titular." });
  });

  it("solo puede usarlo un administrador", async () => {
    const courtId = await newCourt();
    mockSession(Role.PLAYER);

    const asPlayer = await createBookingAdmin({ courtId, date, startTime: "18:00", holder: { playerId: player.id } });
    mockSession(null);
    const anonymous = await createBookingAdmin({ courtId, date, startTime: "18:00", holder: { playerId: player.id } });

    expect(asPlayer.success).toBe(false);
    expect(anonymous.success).toBe(false);
    const dataSource = await getDataSource();
    expect(await dataSource.getRepository<Booking>("Booking").count({ where: { court: { id: courtId } } })).toBe(0);
  });

  describe("horarios libres para el formulario", () => {
    // Cancha abierta de 09:00 a 23:00: turnos de 90 minutos desde la apertura.
    const ALL_SLOTS = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30", "18:00", "19:30", "21:00"];

    it("ofrece los turnos de la grilla dentro del horario de la cancha", async () => {
      const courtId = await newCourt();

      expect(await getAvailableSlotsAdmin({ courtId, date })).toEqual({ success: true, data: ALL_SLOTS });
    });

    it("no ofrece los turnos ocupados ni los que se pisan con un bloqueo", async () => {
      const courtId = await newCourt();
      await createBookingForPlayer({ fromDateTime: occurrenceStart(date, "10:30"), bookerId: player.id, courtId });
      await createOutOfService({
        courtId,
        fromDateTime: occurrenceStart(date, "17:00"),
        toDateTime: occurrenceStart(date, "20:00"),
        reason: OutOfServiceReason.MAINTENANCE,
      });

      const result = await getAvailableSlotsAdmin({ courtId, date });

      expect(result).toEqual({ success: true, data: ["09:00", "12:00", "13:30", "15:00", "21:00"] });
    });

    it("un turno cancelado deja el horario libre", async () => {
      const courtId = await newCourt();
      await createBookingForPlayer({
        fromDateTime: occurrenceStart(date, "10:30"),
        bookerId: player.id,
        courtId,
        bookingState: BookingState.CANCELLED,
      });

      expect(await getAvailableSlotsAdmin({ courtId, date })).toEqual({ success: true, data: ALL_SLOTS });
    });

    it("no ofrece horarios de días que ya pasaron", async () => {
      const courtId = await newCourt();

      const result = await getAvailableSlotsAdmin({ courtId, date: addDaysISO(todayISO(), -1) });

      expect(result).toEqual({ success: true, data: [] });
    });

    it("no ofrece horarios en una cancha dada de baja", async () => {
      const courtId = await newCourt();
      await updateCourt(courtId, { state: CourtState.CLOSED_DOWN });

      expect(await getAvailableSlotsAdmin({ courtId, date })).toEqual({ success: true, data: [] });
    });

    it("solo puede usarlo un administrador", async () => {
      const courtId = await newCourt();
      mockSession(Role.PLAYER);

      const result = await getAvailableSlotsAdmin({ courtId, date });

      expect(result.success).toBe(false);
    });
  });
});
