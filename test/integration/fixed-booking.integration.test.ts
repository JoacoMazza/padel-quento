import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { BookingState, CourtState, DayOfWeek, FixedBookingDateState, FixedBookingFrequency, Role } from "@/src/domain/enums";
import { FIXED_BOOKING_HORIZON_DAYS } from "@/src/domain/constants";
import { addDaysISO, occurrenceDates, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import {
  fixedBookingCancelledNotice,
  fixedDateReleasedNotice,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/src/domain/notifications";
import { getDataSource } from "@/src/lib/db";
import { Booking } from "@/src/entities/Booking";
import { FixedBookingDate } from "@/src/entities/FixedBookingDate";
import { updateCourt } from "@/src/actions/court";
import { createSchedule } from "@/src/actions/schedule";
import { createPlayer } from "@/src/actions/player";
import { updateBooking } from "@/src/actions/booking";
import { createBookingForPlayer } from "@/src/lib/bookings";
import {
  cancelFixedBooking,
  createFixedBooking,
  extendFixedBookings,
  getFixedBookingsAdmin,
  releaseFixedBookingDate,
  restoreFixedBookingDate,
} from "@/src/actions/fixedBooking";
import { createTestAdmin, createTestCourt, uniqueCourtNumber, uniquePhoneNumber } from "./helpers";

const { notify } = vi.hoisted(() => ({ notify: vi.fn(async () => {}) }));
vi.mock("@/src/lib/notifications", () => ({ notify }));

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));
import { getServerSession } from "next-auth/next";

type NotifyCall = [NotificationRecipient[], (recipient: NotificationRecipient) => NotificationMessage];

// El admin de la sesión es un dueño real: dar de baja una cancha es solo para el dueño.
let adminEmail = "";
beforeAll(async () => {
  adminEmail = (await createTestAdmin()).email;
});

function mockSession(role: Role) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { email: adminEmail, role } } as never);
}

const ALL_DAYS = Object.values(DayOfWeek);

function uniqueEmail(prefix: string) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2)}@test.com`;
}

describe("turnos fijos (integración con Postgres real)", () => {
  let player: { id: number; names: string; email: string; phoneNumber: string };
  let other: { id: number };
  const startDate = addDaysISO(todayISO(), 7);
  const horizon = addDaysISO(todayISO(), FIXED_BOOKING_HORIZON_DAYS);

  async function newCourt(price = 20000) {
    const number = uniqueCourtNumber();
    const court = await createTestCourt({ number, price });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    for (const dayOfWeek of ALL_DAYS) {
      await createSchedule({
        dayOfWeek,
        openingTime: "09:00:00" as unknown as Date,
        closingTime: "23:00:00" as unknown as Date,
        courtId: court.data.id,
      });
    }
    return { id: court.data.id, number };
  }

  async function newPlayer(names: string) {
    const email = uniqueEmail(names.toLowerCase());
    const phoneNumber = uniquePhoneNumber();
    const created = await createPlayer({ email, phoneNumber, password: "secreto123", names, lastnames: "Fijo" });
    if (!created.success) throw new Error("no se pudo crear el jugador de prueba");
    return { id: created.data.id, names, email, phoneNumber };
  }

  async function datesOf(fixedBookingId: number) {
    const dataSource = await getDataSource();
    return dataSource.getRepository<FixedBookingDate>("FixedBookingDate").find({
      where: { fixedBooking: { id: fixedBookingId } },
      relations: { booking: { booker: true, court: true } },
      order: { date: "ASC" },
    });
  }

  async function bookingById(id: number) {
    const dataSource = await getDataSource();
    return dataSource.getRepository<Booking>("Booking").findOneOrFail({ where: { id } });
  }

  async function createWeekly(courtId: number, overrides: Partial<Parameters<typeof createFixedBooking>[0]> = {}) {
    const result = await createFixedBooking({
      courtId,
      startDate,
      startTime: "18:00",
      frequency: FixedBookingFrequency.WEEKLY,
      holder: { playerId: player.id },
      ...overrides,
    });
    if (!result.success) throw new Error(`no se pudo crear el turno fijo: ${result.error}`);
    return result.data;
  }

  beforeAll(async () => {
    player = await newPlayer("Fede");
    other = await newPlayer("Otro");
  });

  beforeEach(() => {
    notify.mockClear();
    mockSession(Role.ADMIN);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  describe("alta de un turno fijo", () => {
    it("reserva todas las fechas semanales de los próximos 6 meses para el titular", async () => {
      const court = await newCourt(25000);

      const created = await createWeekly(court.id);

      const expected = occurrenceDates(
        { startDate, frequency: FixedBookingFrequency.WEEKLY, endDate: null },
        startDate,
        horizon,
      );
      expect(created.conflicts).toEqual([]);
      const dates = await datesOf(created.id);
      expect(dates.map((d) => d.date)).toEqual(expected);
      expect(dates.every((d) => d.state === FixedBookingDateState.BOOKED)).toBe(true);
      const first = dates[0].booking!;
      expect(first.bookingState).toBe(BookingState.RESERVED);
      expect(first.booker.phoneNumber).toBe(player.phoneNumber);
      expect(first.court.id).toBe(court.id);
      expect(first.price).toBe(25000);
      expect(first.durationMinutes).toBe(90);
      expect(new Date(first.fromDateTime)).toEqual(occurrenceStart(startDate, "18:00"));
    });

    it("en un turno quincenal con fecha de fin solo reserva cada dos semanas hasta esa fecha", async () => {
      const court = await newCourt();
      const endDate = addDaysISO(startDate, 42);

      const created = await createWeekly(court.id, { frequency: FixedBookingFrequency.BIWEEKLY, endDate });

      const dates = await datesOf(created.id);
      expect(dates.map((d) => d.date)).toEqual([
        startDate,
        addDaysISO(startDate, 14),
        addDaysISO(startDate, 28),
        addDaysISO(startDate, 42),
      ]);
    });

    it("puede quedar a nombre de alguien sin cuenta, identificado por su teléfono", async () => {
      const court = await newCourt();
      const phoneNumber = uniquePhoneNumber();

      const created = await createWeekly(court.id, {
        holder: { names: "Grupo", lastnames: "De Los Lunes", phoneNumber },
        endDate: startDate,
      });

      const [date] = await datesOf(created.id);
      expect(date.booking!.booker.phoneNumber).toBe(phoneNumber);
      expect(date.booking!.booker.names).toBe("Grupo");
    });

    it("reutiliza a quien ya existe con ese teléfono en lugar de duplicarlo", async () => {
      const court = await newCourt();

      const created = await createWeekly(court.id, {
        holder: { names: "Otro Nombre", lastnames: "X", phoneNumber: player.phoneNumber },
        endDate: startDate,
      });

      const [date] = await datesOf(created.id);
      expect(date.booking!.booker.id).toBe(player.id);
    });

    it("si una fecha ya estaba reservada la saltea y la informa, sin frenar el resto", async () => {
      const court = await newCourt();
      const busyDate = addDaysISO(startDate, 7);
      const busy = await createBookingForPlayer({
        fromDateTime: occurrenceStart(busyDate, "18:00"),
        bookerId: other.id,
        courtId: court.id,
        groupSize: 4,
      });
      if (!busy.success) throw new Error("no se pudo crear el turno de prueba");

      const created = await createWeekly(court.id, { endDate: addDaysISO(startDate, 14) });

      expect(created.conflicts).toEqual([busyDate]);
      const dates = await datesOf(created.id);
      expect(dates.map((d) => [d.date, d.state])).toEqual([
        [startDate, FixedBookingDateState.BOOKED],
        [busyDate, FixedBookingDateState.CONFLICT],
        [addDaysISO(startDate, 14), FixedBookingDateState.BOOKED],
      ]);
      expect(dates[1].booking).toBeNull();
    });

    it("rechaza una fecha de inicio anterior a hoy", async () => {
      const court = await newCourt();

      const result = await createFixedBooking({
        courtId: court.id,
        startDate: addDaysISO(todayISO(), -7),
        startTime: "18:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "La fecha de inicio no puede ser anterior a hoy." });
    });

    it("rechaza una fecha de fin anterior a la de inicio", async () => {
      const court = await newCourt();

      const result = await createFixedBooking({
        courtId: court.id,
        startDate,
        endDate: addDaysISO(startDate, -1),
        startTime: "18:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "La fecha de fin no puede ser anterior a la de inicio." });
    });

    it("rechaza un horario en el que la cancha no está abierta ese día", async () => {
      const court = await newCourt();

      const result = await createFixedBooking({
        courtId: court.id,
        startDate,
        startTime: "22:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "La cancha no está abierta en ese horario ese día." });
    });

    it("rechaza una hora que no coincide con el inicio de un turno de la cancha", async () => {
      const court = await newCourt();

      // La cancha abre a las 09:00: los turnos empiezan a las 09:00, 10:30, 12:00…
      const result = await createFixedBooking({
        courtId: court.id,
        startDate,
        startTime: "10:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "Ese horario no corresponde a un turno de la cancha." });
    });

    it("rechaza una cancha dada de baja", async () => {
      const court = await newCourt();
      await updateCourt(court.id, { state: CourtState.CLOSED_DOWN });

      const result = await createFixedBooking({
        courtId: court.id,
        startDate,
        startTime: "18:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "La cancha está dada de baja." });
    });

    it("solo lo puede crear un administrador", async () => {
      const court = await newCourt();
      mockSession(Role.PLAYER);

      const result = await createFixedBooking({
        courtId: court.id,
        startDate,
        startTime: "18:00",
        frequency: FixedBookingFrequency.WEEKLY,
        holder: { playerId: player.id },
      });

      expect(result).toEqual({ success: false, error: "Acceso denegado: Se requieren permisos de Administrador" });
    });
  });

  describe("liberar una sola fecha", () => {
    it("cancela solo ese turno, deja el horario libre y le avisa al titular", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: addDaysISO(startDate, 14) });
      const [first, second] = await datesOf(created.id);

      const released = await releaseFixedBookingDate(second.id);

      expect(released.success).toBe(true);
      const dates = await datesOf(created.id);
      expect(dates.map((d) => d.state)).toEqual([
        FixedBookingDateState.BOOKED,
        FixedBookingDateState.RELEASED,
        FixedBookingDateState.BOOKED,
      ]);
      expect((await bookingById(second.booking!.id)).bookingState).toBe(BookingState.CANCELLED);
      expect((await bookingById(first.booking!.id)).bookingState).toBe(BookingState.RESERVED);

      const [recipients, buildMessage] = notify.mock.calls[0] as unknown as NotifyCall;
      expect(recipients).toEqual([{ names: "Fede", email: player.email, phoneNumber: player.phoneNumber }]);
      expect(buildMessage(recipients[0])).toEqual(
        fixedDateReleasedNotice("Fede", { fromDateTime: occurrenceStart(second.date, "18:00"), courtNumber: court.number }),
      );

      const someoneElse = await createBookingForPlayer({
        fromDateTime: occurrenceStart(second.date, "18:00"),
        bookerId: other.id,
        courtId: court.id,
        groupSize: 4,
      });
      expect(someoneElse.success).toBe(true);
    });

    it("no deja liberar dos veces la misma fecha", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: startDate });
      const [date] = await datesOf(created.id);
      await releaseFixedBookingDate(date.id);

      const again = await releaseFixedBookingDate(date.id);

      expect(again).toEqual({ success: false, error: "Esa fecha del turno fijo no está reservada." });
    });
  });

  describe("restaurar una fecha liberada", () => {
    it("la vuelve a reservar para el titular si el horario sigue libre", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: startDate });
      const [date] = await datesOf(created.id);
      await releaseFixedBookingDate(date.id);

      const restored = await restoreFixedBookingDate(date.id);

      expect(restored.success).toBe(true);
      const [after] = await datesOf(created.id);
      expect(after.state).toBe(FixedBookingDateState.BOOKED);
      expect(after.booking!.bookingState).toBe(BookingState.RESERVED);
      expect(after.booking!.booker.phoneNumber).toBe(player.phoneNumber);
    });

    it("no la restaura si mientras tanto alguien reservó ese horario", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: startDate });
      const [date] = await datesOf(created.id);
      await releaseFixedBookingDate(date.id);
      await createBookingForPlayer({
        fromDateTime: occurrenceStart(date.date, "18:00"),
        bookerId: other.id,
        courtId: court.id,
        groupSize: 4,
      });

      const restored = await restoreFixedBookingDate(date.id);

      expect(restored).toEqual({ success: false, error: "Ese horario ya fue reservado por otra persona." });
      const [after] = await datesOf(created.id);
      expect(after.state).toBe(FixedBookingDateState.RELEASED);
    });
  });

  describe("dar de baja el turno fijo", () => {
    it("cancela todas sus fechas futuras, no genera más y le avisa al titular una sola vez", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: addDaysISO(startDate, 14) });

      const cancelled = await cancelFixedBooking(created.id);

      expect(cancelled.success).toBe(true);
      const dates = await datesOf(created.id);
      for (const date of dates) {
        expect((await bookingById(date.booking!.id)).bookingState).toBe(BookingState.CANCELLED);
      }
      expect(notify).toHaveBeenCalledTimes(1);
      const [recipients, buildMessage] = notify.mock.calls[0] as unknown as NotifyCall;
      expect(buildMessage(recipients[0])).toEqual(
        fixedBookingCancelledNotice("Fede", { startDate, startTime: "18:00:00", courtNumber: court.number }),
      );

      await extendFixedBookings();
      expect(await datesOf(created.id)).toHaveLength(dates.length);
    });
  });

  describe("extensión automática", () => {
    it("a medida que pasan los días genera las fechas nuevas que entran en los 6 meses, sin duplicar", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id);
      const before = await datesOf(created.id);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + 14 * 24 * 60 * 60 * 1000));
      await extendFixedBookings();
      await extendFixedBookings();

      const after = await datesOf(created.id);
      const newDates = after.map((d) => d.date).filter((date) => !before.some((b) => b.date === date));
      expect(newDates).toEqual(
        occurrenceDates(
          { startDate, frequency: FixedBookingFrequency.WEEKLY, endDate: null },
          addDaysISO(horizon, 1),
          addDaysISO(todayISO(), FIXED_BOOKING_HORIZON_DAYS),
        ),
      );
      expect(newDates.length).toBeGreaterThan(0);
    });
  });

  describe("del lado del jugador", () => {
    it("el titular no puede cancelar un turno fijo desde la app", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: startDate });
      const [date] = await datesOf(created.id);

      const result = await updateBooking(date.booking!.id, { bookingState: BookingState.CANCELLED });

      expect(result).toEqual({
        success: false,
        error: "Es un turno fijo: para liberar esta fecha comunicate con el club.",
      });
      expect((await bookingById(date.booking!.id)).bookingState).toBe(BookingState.RESERVED);
    });
  });

  describe("listado para el admin", () => {
    it("muestra cada turno fijo con su cancha, titular y próximas fechas", async () => {
      const court = await newCourt();
      const created = await createWeekly(court.id, { endDate: addDaysISO(startDate, 7) });
      const [, second] = await datesOf(created.id);
      await releaseFixedBookingDate(second.id);

      const result = await getFixedBookingsAdmin();

      if (!result.success) throw new Error(result.error);
      const item = result.data.find((fixed) => fixed.id === created.id);
      expect(item).toMatchObject({
        courtNumber: court.number,
        holderName: "Fede Fijo",
        holderPhoneNumber: player.phoneNumber,
        frequency: FixedBookingFrequency.WEEKLY,
        startDate,
        endDate: addDaysISO(startDate, 7),
        startTime: "18:00",
        isActive: true,
      });
      expect(item!.upcomingDates.map((d) => [d.date, d.state])).toEqual([
        [startDate, FixedBookingDateState.BOOKED],
        [addDaysISO(startDate, 7), FixedBookingDateState.RELEASED],
      ]);
    });
  });
});
