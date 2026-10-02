import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { BookingState } from "@/src/domain/enums";
import { PENALTY_POINTS } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch, updateBooking } from "@/src/actions/booking";
import { cancelExpiredMatches, leaveMatch } from "@/src/actions/match";
import { getProfileData, recordPointsMovement } from "@/src/actions/profile";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// Partidos abiertos a 30 días y con horario propio (igual que en
// match.integration.test.ts): se crean con la antelación mínima requerida y
// después se simula con fake timers que faltan menos de 3 horas.
const INITIAL_POINTS = 50;

let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setHours(8, 0, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

describe("penalización por cancelación tardía (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  async function createTestPlayer(prefix: string) {
    const email = uniqueEmail(prefix);
    const player = await createPlayer({
      phoneNumber: uniquePhoneNumber(),
      email,
      password: "secreto123",
      names: "Jugador",
      lastnames: prefix,
    });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    // Saldo inicial mayor a la penalización: con saldo 0 no habría nada que
    // descontar (el piso es 0) y no se podría distinguir si se penalizó.
    await recordPointsMovement(player.data.id, INITIAL_POINTS, "bonus", "Puntos iniciales de prueba");
    return { id: player.data.id, bookerId: player.data.id, email };
  }

  it("descuenta la penalización al cancelar un turno a menos de 3 horas", async () => {
    const player = await createTestPlayer("cancela-tarde");
    const created = await createBooking({
      fromDateTime: new Date(Date.now() + 2 * 60 * 60_000),
      bookerId: player.bookerId,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateBooking(created.data.id, { bookingState: BookingState.CANCELLED });
    expect(result.success).toBe(true);

    const profile = await getProfileData(player.email);
    expect(profile?.scoring).toBe(INITIAL_POINTS - PENALTY_POINTS);
  });

  it("no descuenta puntos al cancelar un turno con 3 horas o más de anticipación", async () => {
    const player = await createTestPlayer("cancela-a-tiempo");
    const created = await createBooking({
      fromDateTime: new Date(Date.now() + 5 * 60 * 60_000),
      bookerId: player.bookerId,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateBooking(created.data.id, { bookingState: BookingState.CANCELLED });
    expect(result.success).toBe(true);

    const profile = await getProfileData(player.email);
    expect(profile?.scoring).toBe(INITIAL_POINTS);
  });

  describe("partidos abiertos", () => {
    async function createOpenMatchWithJoiner(prefix: string) {
      const creator = await createTestPlayer(`${prefix}-creador`);
      const joiner = await createTestPlayer(`${prefix}-sumado`);
      const startTime = uniqueFromDateTime();

      const created = await createBooking({ fromDateTime: startTime, bookerId: creator.bookerId, courtId, groupSize: 2 });
      if (!created.success) throw new Error("expected success");
      const joined = await joinOpenMatch({ bookingId: created.data.id, playerId: joiner.id });
      if (!joined.success) throw new Error("expected success");

      const found = await getBookingById(created.data.id);
      if (!found.success || !found.data?.match) throw new Error("expected match");

      return { creator, joiner, startTime, bookingId: created.data.id, matchId: found.data.match.id };
    }

    it("penaliza al creador que cancela el partido abierto a menos de 3 horas, no a los sumados", async () => {
      const { creator, joiner, startTime, bookingId } = await createOpenMatchWithJoiner("abierto-cancela");

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 2 * 60 * 60_000));
      const result = await updateBooking(bookingId, { bookingState: BookingState.CANCELLED });
      vi.useRealTimers();
      expect(result.success).toBe(true);

      expect((await getProfileData(creator.email))?.scoring).toBe(INITIAL_POINTS - PENALTY_POINTS);
      expect((await getProfileData(joiner.email))?.scoring).toBe(INITIAL_POINTS);
    });

    it("penaliza al jugador sumado que se da de baja a menos de 3 horas, no al creador", async () => {
      const { creator, joiner, startTime, bookingId, matchId } = await createOpenMatchWithJoiner("abierto-baja");

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 2 * 60 * 60_000));
      const result = await leaveMatch(matchId, joiner.id);
      vi.useRealTimers();
      expect(result.success).toBe(true);

      expect((await getProfileData(joiner.email))?.scoring).toBe(INITIAL_POINTS - PENALTY_POINTS);
      expect((await getProfileData(creator.email))?.scoring).toBe(INITIAL_POINTS);

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.RESERVED);
      expect(found.data?.match?.matchPlayers?.map((mp) => mp.playerId)).toEqual([creator.id]);
    });

    it("no penaliza al jugador sumado que se da de baja con 3 horas o más, y reabre la búsqueda", async () => {
      const { joiner, bookingId, matchId } = await createOpenMatchWithJoiner("abierto-baja-a-tiempo");

      const result = await leaveMatch(matchId, joiner.id);
      expect(result.success).toBe(true);

      expect((await getProfileData(joiner.email))?.scoring).toBe(INITIAL_POINTS);

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.match?.needPlayers).toBe(true);
    });

    it("no penaliza a nadie cuando el partido se cancela solo por falta de jugadores a 3 horas del inicio", async () => {
      const { creator, joiner, startTime, bookingId } = await createOpenMatchWithJoiner("abierto-auto");

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 3 * 60 * 60_000));
      await cancelExpiredMatches();
      vi.useRealTimers();

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.CANCELLED);

      expect((await getProfileData(creator.email))?.scoring).toBe(INITIAL_POINTS);
      expect((await getProfileData(joiner.email))?.scoring).toBe(INITIAL_POINTS);
    });
  });
});
