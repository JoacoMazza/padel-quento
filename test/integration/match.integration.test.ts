import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById } from "@/src/actions/booking";
import { closeMatch, cancelExpiredMatches } from "@/src/actions/match";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// Siempre en el futuro y con horario propio por test: la antelación mínima de
// partidos abiertos y la cancelación automática comparan contra la hora real,
// y el backend rechaza solapamientos para la misma cancha.
let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  date.setHours(8, 0, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

describe("match actions (integración con Postgres real)", () => {
  let courtId: number;
  let playerId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber() });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    const player = await createPlayer({
      email: uniqueEmail("match-player"),
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

  async function createOpenMatch(fromDateTime: Date, groupSize = 2) {
    const created = await createBooking({ fromDateTime, playerId, courtId, groupSize });
    if (!created.success) throw new Error("expected success");

    const found = await getBookingById(created.data.id);
    if (!found.success || !found.data?.match) throw new Error("expected match");

    return { bookingId: created.data.id, matchId: found.data.match.id };
  }

  describe("cierre manual de partido abierto", () => {
    it("cierra manualmente un partido con 1, 2 o 3 jugadores confirmados sin tocar el estado del turno", async () => {
      const { bookingId, matchId } = await createOpenMatch(uniqueFromDateTime(), 2);

      const result = await closeMatch(matchId);

      expect(result).toEqual({
        success: true,
        data: expect.objectContaining({ needPlayers: false }),
      });

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.RESERVED);
      expect(found.data?.match?.needPlayers).toBe(false);
    });

    it("rechaza el cierre manual si el partido ya no está buscando jugadores", async () => {
      const { matchId } = await createOpenMatch(uniqueFromDateTime(), 2);

      const first = await closeMatch(matchId);
      expect(first.success).toBe(true);

      const second = await closeMatch(matchId);

      expect(second).toEqual({
        success: false,
        error: "Este partido ya no está buscando jugadores.",
      });
    });

    it("devuelve error si el partido no existe", async () => {
      const result = await closeMatch(999_999_999);

      expect(result).toEqual({ success: false, error: "El partido no existe." });
    });
  });

  describe("cancelación automática de partidos abiertos por falta de cupo", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("cancela un partido abierto que no completó el cupo al llegar a 3 horas del inicio", async () => {
      const startTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(startTime, 2);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 3 * 60 * 60_000));

      const result = await cancelExpiredMatches();
      expect(result.success).toBe(true);
      vi.useRealTimers();

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.CANCELLED);
      expect(found.data?.match?.needPlayers).toBe(false);
    });

    it("no cancela un partido abierto si todavía faltan más de 3 horas para el inicio", async () => {
      const startTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(startTime, 2);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 4 * 60 * 60_000));

      await cancelExpiredMatches();
      vi.useRealTimers();

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.RESERVED);
      expect(found.data?.match?.needPlayers).toBe(true);
    });

    it("no cancela un partido abierto que ya fue cerrado manualmente", async () => {
      const startTime = uniqueFromDateTime();
      const { bookingId, matchId } = await createOpenMatch(startTime, 2);

      const closed = await closeMatch(matchId);
      expect(closed.success).toBe(true);

      vi.useFakeTimers();
      vi.setSystemTime(new Date(startTime.getTime() - 60 * 60_000));

      await cancelExpiredMatches();
      vi.useRealTimers();

      const found = await getBookingById(bookingId);
      if (!found.success) throw new Error("expected success");
      expect(found.data?.bookingState).toBe(BookingState.RESERVED);
    });
  });
});
