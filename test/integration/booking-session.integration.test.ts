import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch } from "@/src/actions/booking";
import { createBookingForPlayer } from "@/src/lib/bookings";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

function signedInAs(email: string | null) {
  vi.mocked(getServerSession).mockResolvedValue(email ? ({ user: { email } } as never) : null);
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000);
  date.setHours(8, 0, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

describe("reservar y sumarse a partidos con la sesión (integración con Postgres real)", () => {
  let courtId: number;
  let ana: { id: number; email: string };
  let bruno: { id: number; email: string };

  async function newPlayer(names: string) {
    const email = uniqueEmail(names.toLowerCase());
    const created = await createPlayer({
      email,
      phoneNumber: uniquePhoneNumber(),
      password: "secreto123",
      names,
      lastnames: "Sesion",
    });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: created.data.id, email };
  }

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
    ana = await newPlayer("Ana");
    bruno = await newPlayer("Bruno");
  });

  beforeEach(() => {
    vi.mocked(getServerSession).mockReset();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("createBooking", () => {
    it("sin sesión no reserva", async () => {
      signedInAs(null);
      const fromDateTime = uniqueFromDateTime();

      const result = await createBooking({ fromDateTime, courtId, groupSize: 4 });

      expect(result).toEqual({ success: false, error: "Tenés que iniciar sesión para reservar." });
      // El horario sigue libre: otro jugador lo puede reservar.
      const again = await createBookingForPlayer({ fromDateTime, courtId, groupSize: 4, bookerId: bruno.id });
      expect(again.success).toBe(true);
    });

    it("reserva a nombre del jugador de la sesión, aunque el cliente mande el id de otro", async () => {
      signedInAs(ana.email);

      const result = await createBooking({
        fromDateTime: uniqueFromDateTime(),
        courtId,
        groupSize: 4,
        bookerId: bruno.id,
      } as Parameters<typeof createBooking>[0]);

      if (!result.success) throw new Error(result.error);
      const found = await getBookingById(result.data.id);
      expect(found.success && found.data?.booker.id).toBe(ana.id);
    });
  });

  describe("joinOpenMatch", () => {
    async function openMatchOf(creatorId: number) {
      const created = await createBookingForPlayer({
        fromDateTime: uniqueFromDateTime(),
        courtId,
        groupSize: 2,
        bookerId: creatorId,
      });
      if (!created.success) throw new Error(created.error);
      return created.data.id;
    }

    it("sin sesión no suma a nadie", async () => {
      const bookingId = await openMatchOf(ana.id);
      signedInAs(null);

      const result = await joinOpenMatch({ bookingId });

      expect(result).toEqual({ success: false, error: "Tenés que iniciar sesión para reservar." });
      const found = await getBookingById(bookingId);
      expect(found.success && found.data?.match?.matchPlayers).toHaveLength(1);
    });

    it("suma al jugador de la sesión, aunque el cliente mande el id de otro", async () => {
      const bookingId = await openMatchOf(ana.id);
      signedInAs(bruno.email);

      const result = await joinOpenMatch({ bookingId, playerId: ana.id } as Parameters<typeof joinOpenMatch>[0]);

      expect(result.success).toBe(true);
      const found = await getBookingById(bookingId);
      const playerIds = (found.success ? found.data?.match?.matchPlayers ?? [] : []).map((mp) => mp.player.id);
      expect(playerIds.sort()).toEqual([ana.id, bruno.id].sort());
    });
  });
});
