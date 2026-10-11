import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { OutOfServiceReason } from "@/src/domain/enums";
import {
  courtUnavailableNotice,
  playerJoinedNotice,
  playerLeftNotice,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/src/domain/notifications";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { createBooking, getBookingById, joinOpenMatch } from "@/src/actions/booking";
import { leaveMatch } from "@/src/actions/match";
import { createOutOfService } from "@/src/actions/outOfService";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));

type NotifyCall = [NotificationRecipient[], (recipient: NotificationRecipient) => NotificationMessage];

function notifyCalls() {
  return notify.mock.calls as unknown as NotifyCall[];
}

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

// Siempre en el futuro (más allá de las 3 horas de baja tardía) y con horario propio por test.
let slotOffset = 0;
function uniqueFromDateTime() {
  const date = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
  date.setHours(8, 0, 0, 0);
  date.setHours(date.getHours() + slotOffset * 2);
  slotOffset += 1;
  return date;
}

describe("avisos de cambios en turnos y partidos (integración con Postgres real)", () => {
  let courtId: number;
  let courtNumber: number;
  let ana: NotificationRecipient & { id: number };
  let bruno: NotificationRecipient & { id: number };
  let carla: NotificationRecipient & { id: number };

  async function newPlayer(names: string, lastnames: string) {
    const email = uniqueEmail(names.toLowerCase());
    const phoneNumber = uniquePhoneNumber();
    const player = await createPlayer({ phoneNumber, email, password: "secreto123", names, lastnames });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: player.data.id, names, email, phoneNumber };
  }

  async function createOpenMatch(fromDateTime: Date, groupSize: number) {
    const created = await createBooking({ fromDateTime, bookerId: ana.id, courtId, groupSize });
    if (!created.success) throw new Error(`no se pudo crear el partido: ${created.error}`);
    const found = await getBookingById(created.data.id);
    if (!found.success || !found.data?.match) throw new Error("se esperaba un partido abierto");
    return { bookingId: created.data.id, matchId: found.data.match.id };
  }

  function recipientOf(person: typeof ana): NotificationRecipient {
    return { names: person.names, email: person.email, phoneNumber: person.phoneNumber };
  }

  beforeAll(async () => {
    courtNumber = uniqueCourtNumber();
    const court = await createCourt({ number: courtNumber, price: 10000 });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;

    ana = await newPlayer("Ana", "Pérez");
    bruno = await newPlayer("Bruno", "Díaz");
    carla = await newPlayer("Carla", "Gómez");
  });

  beforeEach(() => {
    notify.mockClear();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("cuando un jugador se suma a un partido abierto", () => {
    it("avisa a los demás jugadores del partido quién se sumó y cuántos lugares quedan", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatch({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const joined = await joinOpenMatch({ bookingId, playerId: carla.id });

      expect(joined.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(bruno)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(ana))).toEqual(
        playerJoinedNotice("Ana", "Carla Gómez", { fromDateTime, courtNumber }, 0),
      );
    });

    it("no avisa nada si no se pudo sumar", async () => {
      const { bookingId } = await createOpenMatch(uniqueFromDateTime(), 3);
      await joinOpenMatch({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const joined = await joinOpenMatch({ bookingId, playerId: bruno.id });

      expect(joined.success).toBe(false);
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("cuando un jugador se baja de un partido abierto", () => {
    it("avisa a los demás jugadores del partido quién se bajó y cuántos lugares quedan", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId, matchId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatch({ bookingId, playerId: bruno.id });
      await joinOpenMatch({ bookingId, playerId: carla.id });
      notify.mockClear();

      const left = await leaveMatch(matchId, bruno.id);

      expect(left.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(carla)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(carla))).toEqual(
        playerLeftNotice("Carla", "Bruno Díaz", { fromDateTime, courtNumber }, 1),
      );
    });
  });

  describe("cuando la cancha queda fuera de servicio", () => {
    it("avisa a todos los jugadores de cada turno cancelado, sin tocar los turnos que no se superponen", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatch({ bookingId, playerId: bruno.id });
      const later = uniqueFromDateTime();
      const untouched = await createBooking({ fromDateTime: later, bookerId: carla.id, courtId, groupSize: 4 });
      if (!untouched.success) throw new Error("no se pudo crear el turno de prueba");
      notify.mockClear();

      const blocked = await createOutOfService({
        fromDateTime,
        toDateTime: new Date(fromDateTime.getTime() + 60 * 60_000),
        reason: OutOfServiceReason.MAINTENANCE,
        courtId,
      });

      expect(blocked.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(bruno)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(bruno))).toEqual(
        courtUnavailableNotice("Bruno", { fromDateTime, courtNumber }),
      );
    });

    it("avisa a quien reservó un turno completo (sin partido abierto)", async () => {
      const fromDateTime = uniqueFromDateTime();
      const booked = await createBooking({ fromDateTime, bookerId: carla.id, courtId, groupSize: 4 });
      if (!booked.success) throw new Error("no se pudo crear el turno de prueba");
      notify.mockClear();

      await createOutOfService({
        fromDateTime,
        toDateTime: new Date(fromDateTime.getTime() + 60 * 60_000),
        reason: OutOfServiceReason.CLEANING,
        courtId,
      });

      expect(notify).toHaveBeenCalledTimes(1);
      expect(notifyCalls()[0][0]).toEqual([recipientOf(carla)]);
    });

    it("no avisa nada si el bloqueo no cancela ningún turno", async () => {
      const fromDateTime = uniqueFromDateTime();

      await createOutOfService({
        fromDateTime,
        toDateTime: new Date(fromDateTime.getTime() + 60 * 60_000),
        reason: OutOfServiceReason.FREE_DAY,
        courtId,
      });

      expect(notify).not.toHaveBeenCalled();
    });
  });
});
