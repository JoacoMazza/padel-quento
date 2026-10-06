import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingState, OutOfServiceReason } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById } from "@/src/actions/booking";
import {
  createOutOfService,
  getOutOfServices,
  getOutOfServiceById,
  updateOutOfService,
  deleteOutOfService,
  endOutOfService,
} from "@/src/actions/outOfService";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const fromDateTime = new Date("2026-01-01T09:00:00Z");
const toDateTime = new Date("2026-01-01T12:00:00Z");

describe("outOfService actions (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
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
    expect(result.data).toMatchObject({
      reason: OutOfServiceReason.MAINTENANCE,
      description: "Arreglo de red",
    });
    expect(result.data.id).toBeDefined();
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

    const found = await getOutOfServiceById(created.data.id);
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

    const result = await updateOutOfService(created.data.id, {
      reason: OutOfServiceReason.MAINTENANCE,
    });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ reason: OutOfServiceReason.MAINTENANCE }),
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

    const result = await deleteOutOfService(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteOutOfService(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
  });

  it("al crear el bloqueo cancela solo los turnos de esa cancha que se superponen", async () => {
    const otherCourt = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!otherCourt.success) throw new Error("no se pudo crear la cancha de prueba");
    const player = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email: `bloqueo.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`,
      password: "secreto123",
      names: "Jugador",
      lastnames: "Bloqueo",
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");

    const day = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
    const at = (hours: number, minutes = 0) => {
      const date = new Date(day);
      date.setHours(hours, minutes, 0, 0);
      return date;
    };
    async function book(hours: number, minutes: number, onCourtId: number) {
      const booking = await createBooking({ fromDateTime: at(hours, minutes), bookerId: player.data!.id, courtId: onCourtId });
      if (!booking.success) throw new Error(`no se pudo crear el turno de prueba: ${booking.error}`);
      return booking.data.id;
    }

    // Bloqueo de 10:00 a 13:00 en la cancha del archivo.
    const overlapping = await book(9, 0, courtId); // 09:00-10:30, se superpone al inicio
    const inside = await book(11, 0, courtId); // 11:00-12:30, dentro del bloqueo
    const after = await book(13, 0, courtId); // 13:00-14:30, empieza justo al terminar
    const otherCourtSameTime = await book(11, 0, otherCourt.data.id);

    const created = await createOutOfService({
      fromDateTime: at(10),
      toDateTime: at(13),
      reason: OutOfServiceReason.MAINTENANCE,
      courtId,
    });
    expect(created.success).toBe(true);

    async function stateOf(bookingId: number) {
      const found = await getBookingById(bookingId);
      if (!found.success || !found.data) throw new Error("no se encontró el turno");
      return found.data.bookingState;
    }
    expect(await stateOf(overlapping)).toBe(BookingState.CANCELLED);
    expect(await stateOf(inside)).toBe(BookingState.CANCELLED);
    expect(await stateOf(after)).not.toBe(BookingState.CANCELLED);
    expect(await stateOf(otherCourtSameTime)).not.toBe(BookingState.CANCELLED);
  });

  it("finaliza un bloqueo activo y conserva el registro", async () => {
    const created = await createOutOfService({
      fromDateTime: new Date(Date.now() - 60 * 60 * 1000),
      toDateTime: new Date(Date.now() + 60 * 60 * 1000),
      reason: OutOfServiceReason.CLEANING,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const ended = await endOutOfService(created.data.id);
    expect(ended.success).toBe(true);

    const found = await getOutOfServiceById(created.data.id);
    if (!found.success || !found.data) throw new Error("expected the block to still exist");
    expect(found.data.toDateTime.getTime()).toBeLessThanOrEqual(Date.now());

    const again = await endOutOfService(created.data.id);
    expect(again).toEqual({ success: false, error: "El bloqueo de cancha no está activo." });
  });
});
