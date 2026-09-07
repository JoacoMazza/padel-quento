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

// Cada test necesita un horario propio: como ahora el backend rechaza solapamientos,
// reutilizar el mismo horario entre tests haría que se pisen entre sí.
let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(2026, 0, 1, 8, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

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
    const result = await createBooking({ fromDateTime: uniqueFromDateTime(), playerId, courtId });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ durationMinutes: 90, bookingState: BookingState.RESERVED });
    expect(result.data.id).toBeDefined();
  });

  it("lista las reservas con jugador y cancha cargados", async () => {
    await createBooking({
      fromDateTime: uniqueFromDateTime(),
      playerId,
      courtId,
      bookingState: BookingState.PAID,
    });

    const result = await getBookings();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const created = result.data.find((b) => b.bookingState === BookingState.PAID);
    expect(created?.player).toMatchObject({ id: playerId });
    expect(created?.court).toMatchObject({ id: courtId });
  });

  it("obtiene una reserva por id y null si no existe", async () => {
    const created = await createBooking({ fromDateTime: uniqueFromDateTime(), playerId, courtId });
    if (!created.success) throw new Error("expected success");

    const found = await getBookingById(created.data.id);
    expect(found.success).toBe(true);
    if (!found.success) throw new Error("expected success");
    expect(found.data?.court).toMatchObject({ id: courtId });

    const notFound = await getBookingById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el estado de una reserva existente", async () => {
    const created = await createBooking({ fromDateTime: uniqueFromDateTime(), playerId, courtId });
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
    const created = await createBooking({ fromDateTime: uniqueFromDateTime(), playerId, courtId });
    if (!created.success) throw new Error("expected success");

    const result = await deleteBooking(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteBooking(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "La reserva no existe." });
  });

  describe("prevención de doble reserva", () => {
    it("no permite crear una reserva en el mismo horario y cancha", async () => {
      const fromDateTime = uniqueFromDateTime();
      const first = await createBooking({ fromDateTime, playerId, courtId });
      if (!first.success) throw new Error("expected success");

      const second = await createBooking({ fromDateTime, playerId, courtId });

      expect(second).toEqual({
        success: false,
        error: "Ese horario ya está reservado para esta cancha.",
      });
    });

    it("no permite crear una reserva que se solapa parcialmente", async () => {
      const fromDateTime = uniqueFromDateTime();
      const first = await createBooking({ fromDateTime, playerId, courtId, durationMinutes: 90 });
      if (!first.success) throw new Error("expected success");

      const overlapping = new Date(fromDateTime.getTime() + 60 * 60_000);
      const second = await createBooking({ fromDateTime: overlapping, playerId, courtId });

      expect(second).toEqual({
        success: false,
        error: "Ese horario ya está reservado para esta cancha.",
      });
    });

    it("permite reservar el mismo horario si la reserva anterior fue cancelada", async () => {
      const fromDateTime = uniqueFromDateTime();
      const first = await createBooking({ fromDateTime, playerId, courtId });
      if (!first.success) throw new Error("expected success");

      const cancelled = await updateBooking(first.data.id, { bookingState: BookingState.CANCELLED });
      expect(cancelled.success).toBe(true);

      const second = await createBooking({ fromDateTime, playerId, courtId });

      expect(second.success).toBe(true);
    });

    it("no cuenta la reserva propia como solapamiento al actualizarla", async () => {
      const fromDateTime = uniqueFromDateTime();
      const created = await createBooking({ fromDateTime, playerId, courtId });
      if (!created.success) throw new Error("expected success");

      const result = await updateBooking(created.data.id, { bookingState: BookingState.PAID });

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ bookingState: BookingState.PAID }),
      });
    });

    it("no permite mover una reserva a un horario ya ocupado en otra cancha", async () => {
      const otherCourt = await createCourt({ number: uniqueCourtNumber() });
      if (!otherCourt.success) throw new Error("no se pudo crear la segunda cancha de prueba");

      const fromDateTime = uniqueFromDateTime();
      const occupying = await createBooking({ fromDateTime, playerId, courtId: otherCourt.data.id });
      if (!occupying.success) throw new Error("expected success");

      const movable = await createBooking({ fromDateTime: uniqueFromDateTime(), playerId, courtId });
      if (!movable.success) throw new Error("expected success");

      const result = await updateBooking(movable.data.id, {
        fromDateTime,
        courtId: otherCourt.data.id,
      });

      expect(result).toEqual({
        success: false,
        error: "Ese horario ya está reservado para esta cancha.",
      });
    });
  });
});
