import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { Booking } from "@/src/entities/Booking";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { MY_BOOKINGS_PAST_LIMIT } from "@/src/domain/constants";
import { getPlayerBookings } from "@/src/lib/player-bookings";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const DAY = 24 * 60 * 60_000;

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

/**
 * Mis turnos (issue #68): solo los turnos del jugador, todos los próximos y
 * los últimos MY_BOOKINGS_PAST_LIMIT pasados, sin traer los del resto del club.
 */
describe("getPlayerBookings (integración con Postgres real)", () => {
  let courtId: number;
  let ana: number;
  let bruno: number;
  const ids: Record<string, number> = {};

  async function newPlayer(prefix: string) {
    const created = await createPlayer({
      email: uniqueEmail(prefix),
      password: "secreto123",
      names: prefix,
      lastnames: "Turnos",
      phoneNumber: uniquePhoneNumber(),
      category: PlayerCategory.FOURTH,
    });
    if (!created.success) throw new Error(created.error);
    return created.data.id;
  }

  /** Reserva a futuro (las reglas lo exigen) y, si se pide, la lleva a `daysFromNow` (negativo = pasado). */
  let slot = 0;
  async function booking(bookerId: number, daysFromNow: number, groupSize = 4) {
    const future = new Date(Date.now() + (300 + slot++) * DAY);
    future.setHours(10, 0, 0, 0);
    const created = await createBookingForPlayer({ fromDateTime: future, courtId, bookerId, groupSize });
    if (!created.success) throw new Error(created.error);
    const start = new Date(Date.now() + daysFromNow * DAY);
    const dataSource = await getDataSource();
    await dataSource.getRepository<Booking>("Booking").update(created.data.id, { fromDateTime: start });
    return created.data.id;
  }

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error(court.error);
    courtId = court.data.id;
    ana = await newPlayer("Ana");
    bruno = await newPlayer("Bruno");

    ids.next1 = await booking(ana, 2);
    ids.next2 = await booking(ana, 5);
    ids.past1 = await booking(ana, -1);
    ids.past2 = await booking(ana, -3);
    ids.past4 = await booking(ana, -10);
    ids.past5 = await booking(ana, -20);
    // Partido abierto de Bruno al que se sumó Ana: también es suyo.
    ids.joinedPast3 = await booking(bruno, -5, 1);
    const joined = await joinOpenMatchForPlayer({ bookingId: ids.joinedPast3, playerId: ana });
    if (!joined.success) throw new Error(joined.error);
    // Turno de Bruno en el que Ana no juega.
    ids.brunoOnly = await booking(bruno, 1);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("muestra hasta 3 turnos pasados", () => {
    expect(MY_BOOKINGS_PAST_LIMIT).toBe(3);
  });

  it("trae todos los próximos turnos y solo los últimos pasados del jugador", async () => {
    const bookings = await getPlayerBookings(ana);

    expect(bookings.map((b) => b.id).sort()).toEqual(
      [ids.next1, ids.next2, ids.past1, ids.past2, ids.joinedPast3].sort(),
    );
  });

  it("incluye los partidos de otros a los que se sumó, con sus jugadores", async () => {
    const bookings = await getPlayerBookings(ana);

    const joined = bookings.find((b) => b.id === ids.joinedPast3)!;
    expect(joined.booker.id).toBe(bruno);
    expect(joined.match?.matchPlayers.map((mp) => mp.playerId).sort()).toEqual([ana, bruno].sort());
    expect(joined.court.id).toBe(courtId);
  });

  it("no trae turnos del resto del club", async () => {
    const bookings = await getPlayerBookings(ana);

    expect(bookings.some((b) => b.id === ids.brunoOnly)).toBe(false);
  });

  it("un jugador sin turnos no recibe nada", async () => {
    const carla = await newPlayer("Carla");

    expect(await getPlayerBookings(carla)).toEqual([]);
  });
});
