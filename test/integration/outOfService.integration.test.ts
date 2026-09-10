import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingState, OutOfServiceReason } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById } from "@/src/actions/booking";
import { Penalty } from "@/src/entities/Penalty";
import {
  createOutOfService,
  getOutOfServices,
  getOutOfServiceById,
  updateOutOfService,
  deleteOutOfService,
} from "@/src/actions/outOfService";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

const fromDateTime = new Date("2026-01-01T09:00:00Z");
const toDateTime = new Date("2026-01-01T12:00:00Z");

describe("outOfService actions (integración con Postgres real)", () => {
  let courtId: number;
  let playerId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber() });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    const player = await createPlayer({
      email: uniqueEmail("oos-player"),
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

  it("crea un bloqueo asociado a la cancha y lo persiste", async () => {
    const result = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.MAINTENANCE,
      description: "Arreglo de red",
      courtId,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.outOfService).toMatchObject({
      reason: OutOfServiceReason.MAINTENANCE,
      description: "Arreglo de red",
    });
    expect(result.data.outOfService.id).toBeDefined();
    expect(result.data.cancelledBookings).toEqual([]);
  });

  it("lista los bloqueos con la cancha asociada cargada", async () => {
    await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.CLEANING,
      courtId,
    });

    const result = await getOutOfServices();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const created = result.data.find(
      (o) => o.reason === OutOfServiceReason.CLEANING && o.court?.id === courtId,
    );
    expect(created?.court).toMatchObject({ id: courtId });
  });

  it("obtiene un bloqueo por id y null si no existe", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.OTHER,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const found = await getOutOfServiceById(created.data.outOfService.id);
    expect(found.success).toBe(true);
    if (!found.success) throw new Error("expected success");
    expect(found.data?.reason).toBe(OutOfServiceReason.OTHER);

    const notFound = await getOutOfServiceById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el motivo de un bloqueo existente", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.FREE_DAY,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateOutOfService(created.data.outOfService.id, {
      reason: OutOfServiceReason.MAINTENANCE,
    });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        outOfService: expect.objectContaining({ reason: OutOfServiceReason.MAINTENANCE }),
      }),
    });
  });

  it("devuelve error al actualizar un bloqueo inexistente", async () => {
    const result = await updateOutOfService(999_999_999, { reason: OutOfServiceReason.OTHER });

    expect(result).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
  });

  it("elimina un bloqueo existente y falla al eliminarlo de nuevo", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.OTHER,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await deleteOutOfService(created.data.outOfService.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteOutOfService(created.data.outOfService.id);
    expect(secondAttempt).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
  });

  describe("cancelación automática de turnos afectados (RF-13)", () => {
    it("cancela las reservas superpuestas al bloquear el horario y no penaliza al jugador", async () => {
      const court = await createCourt({ number: uniqueCourtNumber() });
      if (!court.success) throw new Error("no se pudo crear la cancha de prueba");

      const bookingFrom = new Date("2026-02-01T10:00:00Z");
      const booking = await createBooking({
        fromDateTime: bookingFrom,
        durationMinutes: 90,
        playerId,
        courtId: court.data.id,
      });
      if (!booking.success) throw new Error("expected success");

      const blockFrom = new Date("2026-02-01T09:30:00Z");
      const blockTo = new Date("2026-02-01T11:00:00Z");
      const result = await createOutOfService({
        fromDateTime: blockFrom,
        toDateTime: blockTo,
        reason: OutOfServiceReason.MAINTENANCE,
        courtId: court.data.id,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.cancelledBookings).toHaveLength(1);
      expect(result.data.cancelledBookings[0]).toMatchObject({
        id: booking.data.id,
        bookingState: BookingState.CANCELLED,
      });

      const refreshed = await getBookingById(booking.data.id);
      expect(refreshed.success).toBe(true);
      if (!refreshed.success) throw new Error("expected success");
      expect(refreshed.data?.bookingState).toBe(BookingState.CANCELLED);

      const dataSource = await getDataSource();
      const penalties = await dataSource
        .getRepository<Penalty>("Penalty")
        .find({ where: { playerId } });
      expect(penalties).toEqual([]);
    });

    it("no cancela reservas fuera del rango bloqueado ni ya canceladas", async () => {
      const court = await createCourt({ number: uniqueCourtNumber() });
      if (!court.success) throw new Error("no se pudo crear la cancha de prueba");

      const outsideBooking = await createBooking({
        fromDateTime: new Date("2026-02-02T20:00:00Z"),
        durationMinutes: 90,
        playerId,
        courtId: court.data.id,
      });
      if (!outsideBooking.success) throw new Error("expected success");

      const result = await createOutOfService({
        fromDateTime: new Date("2026-02-02T09:00:00Z"),
        toDateTime: new Date("2026-02-02T12:00:00Z"),
        reason: OutOfServiceReason.MAINTENANCE,
        courtId: court.data.id,
      });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error("expected success");
      expect(result.data.cancelledBookings).toEqual([]);

      const refreshed = await getBookingById(outsideBooking.data.id);
      expect(refreshed.success).toBe(true);
      if (!refreshed.success) throw new Error("expected success");
      expect(refreshed.data?.bookingState).toBe(BookingState.RESERVED);
    });

    it("cancela reservas que quedan dentro del rango al ampliar un bloqueo existente", async () => {
      const court = await createCourt({ number: uniqueCourtNumber() });
      if (!court.success) throw new Error("no se pudo crear la cancha de prueba");

      const created = await createOutOfService({
        fromDateTime: new Date("2026-02-03T09:00:00Z"),
        toDateTime: new Date("2026-02-03T10:00:00Z"),
        reason: OutOfServiceReason.MAINTENANCE,
        courtId: court.data.id,
      });
      if (!created.success) throw new Error("expected success");

      const booking = await createBooking({
        fromDateTime: new Date("2026-02-03T11:00:00Z"),
        durationMinutes: 60,
        playerId,
        courtId: court.data.id,
      });
      if (!booking.success) throw new Error("expected success");

      const updated = await updateOutOfService(created.data.outOfService.id, {
        toDateTime: new Date("2026-02-03T12:00:00Z"),
      });

      expect(updated.success).toBe(true);
      if (!updated.success) throw new Error("expected success");
      expect(updated.data.cancelledBookings).toHaveLength(1);
      expect(updated.data.cancelledBookings[0]).toMatchObject({ id: booking.data.id });

      const refreshed = await getBookingById(booking.data.id);
      expect(refreshed.success).toBe(true);
      if (!refreshed.success) throw new Error("expected success");
      expect(refreshed.data?.bookingState).toBe(BookingState.CANCELLED);
    });
  });
});
