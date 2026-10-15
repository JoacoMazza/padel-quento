import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { BookingState, OutOfServiceReason, PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { getBookingById } from "@/src/actions/booking";
import { createOutOfService, updateOutOfService } from "@/src/actions/outOfService";
import { awardAttendancePoints } from "@/src/actions/attendance";
import { getProfileData, recordPointsMovement } from "@/src/actions/profile";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const INITIAL_POINTS = 50;

/**
 * HU-13: al bloquearse una cancha (mantenimiento, limpieza, etc.) los turnos
 * afectados se cancelan solos y a ningún jugador se le descuentan puntos, ni
 * por cancelación tardía (RN-03) ni por inasistencia (RN-04).
 */
describe("maintenance cancellation without penalties (HU-13, integración con Postgres real)", () => {
  let courtId: number;
  let dayOffset = 70;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  /** Player with INITIAL_POINTS points, so a penalty would show up in their balance. */
  async function playerWithPoints(prefix: string) {
    const email = `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`.toLowerCase();
    const player = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
      // Para crear o sumarse a un partido abierto hace falta tener la categoría cargada (#54).
      category: PlayerCategory.FOURTH,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    await recordPointsMovement(player.data.id, INITIAL_POINTS, "bonus", "Puntos iniciales de prueba");
    return { id: player.data.id, email };
  }

  async function pointsOf(player: { email: string }) {
    const profile = await getProfileData(player.email);
    if (!profile) throw new Error("no se encontró el perfil");
    return { scoring: profile.scoring, movements: profile.movements.length };
  }

  async function stateOf(bookingId: number) {
    const found = await getBookingById(bookingId);
    if (!found.success || !found.data) throw new Error("no se encontró el turno");
    return found.data.bookingState;
  }

  /** A day far ahead, with its own date per test so bookings never overlap. */
  function nextDay() {
    const day = new Date(Date.now() + dayOffset * 24 * 60 * 60 * 1000);
    dayOffset += 1;
    return (hours: number) => {
      const date = new Date(day);
      date.setHours(hours, 0, 0, 0);
      return date;
    };
  }

  it("cancels a booking that starts in less than 3 hours without deducting points", async () => {
    const player = await playerWithPoints("Tardio");
    // Turno completo dentro de una hora: si lo cancelara el jugador, se lo penalizaría (RN-03).
    const startsSoon = new Date(Date.now() + 60 * 60 * 1000);
    startsSoon.setSeconds(0, 0);
    const booking = await createBookingForPlayer({ fromDateTime: startsSoon, bookerId: player.id, courtId });
    if (!booking.success) throw new Error(`no se pudo crear el turno de prueba: ${booking.error}`);

    const blocked = await createOutOfService({
      fromDateTime: new Date(startsSoon.getTime() - 30 * 60 * 1000),
      toDateTime: new Date(startsSoon.getTime() + 3 * 60 * 60 * 1000),
      reason: OutOfServiceReason.MAINTENANCE,
      courtId,
    });
    expect(blocked.success).toBe(true);

    expect(await stateOf(booking.data.id)).toBe(BookingState.CANCELLED);
    expect(await pointsOf(player)).toEqual({ scoring: INITIAL_POINTS, movements: 1 });
  });

  it("cancels an open match without deducting points to any of its players", async () => {
    const at = nextDay();
    const creator = await playerWithPoints("Creador");
    const joiner = await playerWithPoints("Sumado");
    const booking = await createBookingForPlayer({ fromDateTime: at(18), bookerId: creator.id, courtId, groupSize: 2 });
    if (!booking.success) throw new Error(`no se pudo crear el partido de prueba: ${booking.error}`);
    const joined = await joinOpenMatchForPlayer({ bookingId: booking.data.id, playerId: joiner.id });
    if (!joined.success) throw new Error("no se pudo sumar al jugador");

    await createOutOfService({ fromDateTime: at(17), toDateTime: at(20), reason: OutOfServiceReason.CLEANING, courtId });

    expect(await stateOf(booking.data.id)).toBe(BookingState.CANCELLED);
    expect(await pointsOf(creator)).toEqual({ scoring: INITIAL_POINTS, movements: 1 });
    expect(await pointsOf(joiner)).toEqual({ scoring: INITIAL_POINTS, movements: 1 });
  });

  it("does not penalize the cancelled booking as a no-show once its time has passed", async () => {
    const at = nextDay();
    const player = await playerWithPoints("Ausente");
    const booking = await createBookingForPlayer({ fromDateTime: at(10), bookerId: player.id, courtId });
    if (!booking.success) throw new Error(`no se pudo crear el turno de prueba: ${booking.error}`);
    await createOutOfService({ fromDateTime: at(9), toDateTime: at(12), reason: OutOfServiceReason.MAINTENANCE, courtId });

    // El turno ya pasó: el job de puntos por asistencia no debe tomarlo como inasistencia.
    const dataSource = await getDataSource();
    await dataSource
      .getRepository("Booking")
      .update(booking.data.id, { fromDateTime: new Date(Date.now() - 3 * 60 * 60 * 1000) });
    await awardAttendancePoints();

    expect(await pointsOf(player)).toEqual({ scoring: INITIAL_POINTS, movements: 1 });
  });

  it("editing a block so it covers more bookings cancels them, without deducting points", async () => {
    const at = nextDay();
    const player = await playerWithPoints("Ampliado");
    async function book(hours: number) {
      const booking = await createBookingForPlayer({ fromDateTime: at(hours), bookerId: player.id, courtId });
      if (!booking.success) throw new Error(`no se pudo crear el turno de prueba: ${booking.error}`);
      return booking.data.id;
    }
    const covered = await book(13); // 13:00-14:30: queda dentro al ampliar el bloqueo
    const outside = await book(16); // 16:00-17:30: sigue afuera

    const created = await createOutOfService({
      fromDateTime: at(9),
      toDateTime: at(12),
      reason: OutOfServiceReason.MAINTENANCE,
      courtId,
    });
    if (!created.success) throw new Error("no se pudo crear el bloqueo");
    expect(await stateOf(covered)).not.toBe(BookingState.CANCELLED);

    const updated = await updateOutOfService(created.data.id, { toDateTime: at(15) });
    expect(updated.success).toBe(true);

    expect(await stateOf(covered)).toBe(BookingState.CANCELLED);
    expect(await stateOf(outside)).not.toBe(BookingState.CANCELLED);
    expect(await pointsOf(player)).toEqual({ scoring: INITIAL_POINTS, movements: 1 });
  });
});
