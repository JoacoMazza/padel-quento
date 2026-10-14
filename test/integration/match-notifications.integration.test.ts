import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, CourtState, OutOfServiceReason, Role, PlayerCategory } from "@/src/domain/enums";
import {
  courtUnavailableNotice,
  matchCancelledByCreatorNotice,
  matchClosedNotice,
  matchCompleteNotice,
  matchExpiredNotice,
  playerJoinedNotice,
  playerLeftLateNotice,
  playerLeftNotice,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/src/domain/notifications";
import { getDataSource } from "@/src/lib/db";
import { createCourt, updateCourt } from "@/src/actions/court";
import { createPlayer } from "@/src/actions/player";
import { getBookingById, updateBooking } from "@/src/actions/booking";
import { createBookingForPlayer, joinOpenMatchForPlayer } from "@/src/lib/bookings";
import { cancelExpiredMatches, closeMatch, leaveMatch } from "@/src/actions/match";
import { createOutOfService } from "@/src/actions/outOfService";
import { uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));
vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

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
    const player = await createPlayer({ category: PlayerCategory.FOURTH, phoneNumber, email, password: "secreto123", names, lastnames });
    if (!player.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: player.data.id, names, email, phoneNumber };
  }

  async function createOpenMatch(fromDateTime: Date, groupSize: number, creator = ana, onCourtId = courtId) {
    const created = await createBookingForPlayer({ fromDateTime, bookerId: creator.id, courtId: onCourtId, groupSize });
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

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("cuando un jugador se suma a un partido abierto", () => {
    it("avisa a los demás jugadores del partido quién se sumó y cuántos lugares quedan", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 1);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const joined = await joinOpenMatchForPlayer({ bookingId, playerId: carla.id });

      expect(joined.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(bruno)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(ana))).toEqual(
        playerJoinedNotice("Ana", "Carla Gómez", { fromDateTime, courtNumber }, 1),
      );
    });

    it("cuando el partido se completa avisa a todos sus jugadores, incluido quien se sumó (HU-17)", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const joined = await joinOpenMatchForPlayer({ bookingId, playerId: carla.id });

      expect(joined.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(bruno), recipientOf(carla)]));
      expect(recipients).toHaveLength(3);
      expect(buildMessage(recipientOf(carla))).toEqual(
        matchCompleteNotice("Carla", "Carla Gómez", { fromDateTime, courtNumber }),
      );
    });

    it("no avisa nada si no se pudo sumar", async () => {
      const { bookingId } = await createOpenMatch(uniqueFromDateTime(), 3);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const joined = await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });

      expect(joined.success).toBe(false);
      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("cuando un jugador se baja de un partido abierto", () => {
    it("avisa a los demás jugadores del partido quién se bajó y cuántos lugares quedan", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId, matchId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      await joinOpenMatchForPlayer({ bookingId, playerId: carla.id });
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
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      const later = uniqueFromDateTime();
      const untouched = await createBookingForPlayer({ fromDateTime: later, bookerId: carla.id, courtId, groupSize: 4 });
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
      const booked = await createBookingForPlayer({ fromDateTime, bookerId: carla.id, courtId, groupSize: 4 });
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

  describe("cuando un jugador se baja a último momento", () => {
    it("avisa que se bajó sin ofrecer su lugar, porque el partido no vuelve a buscar jugadores", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId, matchId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(fromDateTime.getTime() - 2 * 60 * 60_000));
      const left = await leaveMatch(matchId, bruno.id);

      expect(left.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual([recipientOf(ana)]);
      expect(buildMessage(recipientOf(ana))).toEqual(
        playerLeftLateNotice("Ana", "Bruno Díaz", { fromDateTime, courtNumber }),
      );
    });
  });

  describe("cuando quien armó el partido cancela el turno (HU-19)", () => {
    it("avisa a todos los demás jugadores anotados", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 1);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      await joinOpenMatchForPlayer({ bookingId, playerId: carla.id });
      notify.mockClear();

      const cancelled = await updateBooking(bookingId, { bookingState: BookingState.CANCELLED });

      expect(cancelled.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(bruno), recipientOf(carla)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(bruno))).toEqual(
        matchCancelledByCreatorNotice("Bruno", "Ana Pérez", { fromDateTime, courtNumber }),
      );
    });

    it("no avisa nada al cancelar un turno sin otros jugadores anotados", async () => {
      const booked = await createBookingForPlayer({ fromDateTime: uniqueFromDateTime(), bookerId: ana.id, courtId, groupSize: 4 });
      if (!booked.success) throw new Error("no se pudo crear el turno de prueba");
      notify.mockClear();

      await updateBooking(booked.data.id, { bookingState: BookingState.CANCELLED });

      expect(notify).not.toHaveBeenCalled();
    });

    it("no avisa nada si el cambio del turno no es una cancelación", async () => {
      const { bookingId } = await createOpenMatch(uniqueFromDateTime(), 2);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      await updateBooking(bookingId, { price: 12000 });

      expect(notify).not.toHaveBeenCalled();
    });
  });

  describe("cuando quien armó el partido lo cierra", () => {
    it("avisa a los demás jugadores que el partido ya no busca más jugadores", async () => {
      const fromDateTime = uniqueFromDateTime();
      const { bookingId, matchId } = await createOpenMatch(fromDateTime, 2);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      const closed = await closeMatch(matchId);

      expect(closed.success).toBe(true);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual([recipientOf(bruno)]);
      expect(buildMessage(recipientOf(bruno))).toEqual(matchClosedNotice("Bruno", { fromDateTime, courtNumber }));
    });
  });

  describe("cuando un partido abierto se cancela por no completar el cupo", () => {
    it("avisa a todos los jugadores anotados, incluido quien lo armó", async () => {
      const diego = await newPlayer("Diego", "Sosa");
      const elena = await newPlayer("Elena", "Ruiz");
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 1, diego);
      await joinOpenMatchForPlayer({ bookingId, playerId: elena.id });
      notify.mockClear();

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(fromDateTime.getTime() - 3 * 60 * 60_000));
      await cancelExpiredMatches();

      // Puede cancelar también partidos abiertos de otros tests: se busca el aviso de este.
      const call = notifyCalls().find(([recipients]) => recipients.some((r) => r.email === diego.email));
      if (!call) throw new Error("no se avisó la cancelación del partido");
      const [recipients, buildMessage] = call;
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(diego), recipientOf(elena)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(elena))).toEqual(matchExpiredNotice("Elena", { fromDateTime, courtNumber }));
    });
  });

  describe("cuando la cancha se da de baja", () => {
    it("cancela los turnos futuros de esa cancha y avisa a sus jugadores", async () => {
      const otherNumber = uniqueCourtNumber();
      const other = await createCourt({ number: otherNumber, price: 10000 });
      if (!other.success) throw new Error("no se pudo crear la cancha de prueba");
      const fromDateTime = uniqueFromDateTime();
      const { bookingId } = await createOpenMatch(fromDateTime, 2, ana, other.data.id);
      await joinOpenMatchForPlayer({ bookingId, playerId: bruno.id });
      notify.mockClear();

      // Dar de baja una cancha es solo para administradores.
      vi.mocked(getServerSession).mockResolvedValue({ user: { email: "admin@test.com", role: Role.ADMIN } } as never);
      const closedDown = await updateCourt(other.data.id, { state: CourtState.CLOSED_DOWN });

      expect(closedDown.success).toBe(true);
      const found = await getBookingById(bookingId);
      expect(found.success && found.data?.bookingState).toBe(BookingState.CANCELLED);
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notifyCalls()[0];
      expect(recipients).toEqual(expect.arrayContaining([recipientOf(ana), recipientOf(bruno)]));
      expect(recipients).toHaveLength(2);
      expect(buildMessage(recipientOf(ana))).toEqual(
        courtUnavailableNotice("Ana", { fromDateTime, courtNumber: otherNumber }),
      );
    });

    it("no cancela ni avisa nada si se edita la cancha sin darla de baja", async () => {
      const other = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
      if (!other.success) throw new Error("no se pudo crear la cancha de prueba");
      const { bookingId } = await createOpenMatch(uniqueFromDateTime(), 2, ana, other.data.id);
      notify.mockClear();

      await updateCourt(other.data.id, { price: 15000 });

      const found = await getBookingById(bookingId);
      expect(found.success && found.data?.bookingState).toBe(BookingState.RESERVED);
      expect(notify).not.toHaveBeenCalled();
    });
  });
});
