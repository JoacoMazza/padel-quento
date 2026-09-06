import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import {
  createBooking,
  getBookings,
  getBookingById,
  updateBooking,
  deleteBooking,
} from "@/src/actions/booking";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

const fromDateTime = new Date("2026-01-01T10:00:00Z");

describe("booking actions (integración con Postgres real)", () => {
  let courtId: number;
  let playerId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber() });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    const player = await createPlayer({
      email: uniqueEmail("booking-player"),
      password: "secreto123",
      names: "Jugador",
      lastnames: "De Prueba",
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    playerId = player.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea una reserva con los valores por defecto y la persiste", async () => {
    const result = await createBooking({ fromDateTime, playerId, courtId });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ durationMinutes: 90, bookingState: BookingState.RESERVED });
    expect(result.data.id).toBeDefined();
  });

  it("lista las reservas con jugador y cancha cargados", async () => {
    await createBooking({ fromDateTime, playerId, courtId, bookingState: BookingState.PAID });

    const result = await getBookings();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const created = result.data.find((b) => b.bookingState === BookingState.PAID);
    expect(created?.player).toMatchObject({ id: playerId });
    expect(created?.court).toMatchObject({ id: courtId });
  });

  it("obtiene una reserva por id y null si no existe", async () => {
    const created = await createBooking({ fromDateTime, playerId, courtId });
    if (!created.success) throw new Error("expected success");

    const found = await getBookingById(created.data.id);
    expect(found.success).toBe(true);
    if (!found.success) throw new Error("expected success");
    expect(found.data?.court).toMatchObject({ id: courtId });

    const notFound = await getBookingById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el estado de una reserva existente", async () => {
    const created = await createBooking({ fromDateTime, playerId, courtId });
    if (!created.success) throw new Error("expected success");

    const result = await updateBooking(created.data.id, { bookingState: BookingState.CANCELLED });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ bookingState: BookingState.CANCELLED }),
    });
  });

  it("devuelve error al actualizar una reserva inexistente", async () => {
    const result = await updateBooking(999_999_999, { bookingState: BookingState.PAID });

    expect(result).toEqual({ success: false, error: "La reserva no existe." });
  });

  it("elimina una reserva existente y falla al eliminarla de nuevo", async () => {
    const created = await createBooking({ fromDateTime, playerId, courtId });
    if (!created.success) throw new Error("expected success");

    const result = await deleteBooking(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteBooking(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "La reserva no existe." });
  });
});
