import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { getPublicBookings } from "@/src/lib/public-bookings";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

const PUBLIC_FIELDS = [
  "bookingState",
  "confirmedPlayers",
  "courtId",
  "durationMinutes",
  "fromDateTime",
  "id",
  "joinedByViewer",
  "needPlayers",
  "price",
].sort();

describe("turnos para la vista pública (integración con Postgres real)", () => {
  let courtId: number;
  let organizer: { id: number; email: string; phoneNumber: string };
  let joiner: { id: number };
  let openMatchId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 15000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    const phoneNumber = uniquePhoneNumber();
    const email = uniqueEmail("organizador");
    const created = await createPlayer({ category: PlayerCategory.FOURTH, email, phoneNumber, password: "secreto123", names: "Olga", lastnames: "Privada" });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    organizer = { id: created.data.id, email, phoneNumber };

    const other = await createPlayer({
      category: PlayerCategory.FOURTH,
      email: uniqueEmail("sumado"),
      phoneNumber: uniquePhoneNumber(),
      password: "secreto123",
      names: "Sergio",
      lastnames: "Sumado",
    });
    if (!other.success) throw new Error("no se pudo crear el jugador de prueba");
    joiner = { id: other.data.id };

    const fromDateTime = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000);
    fromDateTime.setHours(18, 0, 0, 0);
    const booking = await createBookingForPlayer({ fromDateTime, courtId, groupSize: 2, bookerId: organizer.id });
    if (!booking.success) throw new Error(booking.error);
    openMatchId = booking.data.id;
    await joinOpenMatchForPlayer({ bookingId: openMatchId, playerId: joiner.id });
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("solo incluye los datos del turno necesarios para la grilla, sin datos de los jugadores", async () => {
    const bookings = await getPublicBookings(null);

    const openMatch = bookings.find((b) => b.id === openMatchId);
    expect(openMatch).toMatchObject({
      courtId,
      bookingState: BookingState.RESERVED,
      price: 15000,
      needPlayers: true,
      confirmedPlayers: 3,
      joinedByViewer: false,
    });
    for (const booking of bookings) {
      expect(Object.keys(booking).sort()).toEqual(PUBLIC_FIELDS);
    }
    const serialized = JSON.stringify(bookings);
    expect(serialized).not.toContain("Olga");
    expect(serialized).not.toContain("Privada");
    expect(serialized).not.toContain(organizer.email);
    expect(serialized).not.toContain(organizer.phoneNumber);
  });

  it("a un jugador con sesión le indica si ya está anotado en el partido, sin revelar quién más está", async () => {
    const asJoiner = await getPublicBookings(joiner.id);
    const asOrganizer = await getPublicBookings(organizer.id);

    expect(asJoiner.find((b) => b.id === openMatchId)?.joinedByViewer).toBe(true);
    expect(asOrganizer.find((b) => b.id === openMatchId)?.joinedByViewer).toBe(true);
    expect(JSON.stringify(asJoiner)).not.toContain("Olga");
  });

  it("no incluye los turnos cancelados", async () => {
    const fromDateTime = new Date(Date.now() + 51 * 24 * 60 * 60 * 1000);
    const cancelled = await createBookingForPlayer({
      fromDateTime,
      courtId,
      groupSize: 4,
      bookerId: organizer.id,
      bookingState: BookingState.CANCELLED,
    });
    if (!cancelled.success) throw new Error(cancelled.error);

    const bookings = await getPublicBookings(null);

    expect(bookings.some((b) => b.id === cancelled.data.id)).toBe(false);
  });
});
