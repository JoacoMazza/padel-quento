"use server";

import "reflect-metadata";
import { In, type EntityManager } from "typeorm";
import type { Booker } from "@/src/entities/Booker";
import type { Booking } from "@/src/entities/Booking";
import type { Court } from "@/src/entities/Court";
import type { FixedBooking } from "@/src/entities/FixedBooking";
import type { FixedBookingDate } from "@/src/entities/FixedBookingDate";
import type { Player } from "@/src/entities/Player";
import { BookingState, CourtState, FixedBookingDateState, FixedBookingFrequency } from "@/src/domain/enums";
import { FIXED_BOOKING_HORIZON_DAYS } from "@/src/domain/constants";
import { addDaysISO, dayOfWeekOfISO, occurrenceDates, occurrenceStart, todayISO } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";
import { notifyFixedBookingCancelled, notifyFixedDateReleased } from "@/src/lib/match-notifications";

/** Titular del turno fijo: un jugador registrado, o alguien sin cuenta identificado por su teléfono. */
export type FixedBookingHolder = { playerId: number } | { names: string; lastnames: string; phoneNumber: string };

export type CreateFixedBookingInput = {
  courtId: number;
  /** Primera fecha ("YYYY-MM-DD"): define el día de la semana del turno fijo. */
  startDate: string;
  /** Hora de inicio ("HH:MM"). */
  startTime: string;
  frequency: FixedBookingFrequency;
  endDate?: string | null;
  durationMinutes?: number;
  holder: FixedBookingHolder;
};

export type FixedBookingAdminItem = {
  id: number;
  courtId: number;
  courtNumber: number;
  holderName: string;
  holderPhoneNumber: string;
  frequency: FixedBookingFrequency;
  startDate: string;
  endDate: string | null;
  startTime: string;
  durationMinutes: number;
  isActive: boolean;
  upcomingDates: Array<{ id: number; date: string; state: FixedBookingDateState; bookingId: number | null }>;
};

/** Error de validación cuyo mensaje se muestra tal cual al admin. */
class FixedBookingError extends Error {}

const UPCOMING_DATES_LIMIT = 10;

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof FixedBookingError || error instanceof ForbiddenError || error instanceof UnauthorizedError) {
    return error.message;
  }
  return fallback;
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

// Mismo lock por cancha que createBooking: serializa las reservas de la cancha
// para que dos altas simultáneas no tomen el mismo horario.
async function lockCourt(manager: EntityManager, courtId: number) {
  await manager.query("SELECT pg_advisory_xact_lock($1)", [courtId]);
}

/** El horario está ocupado si se superpone con un turno no cancelado o con un bloqueo de la cancha. */
async function isSlotTaken(manager: EntityManager, courtId: number, start: Date, durationMinutes: number) {
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const booking = await manager
    .createQueryBuilder<Booking>("Booking", "booking")
    .where('booking."court_id" = :courtId', { courtId })
    .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
    .andWhere('booking."datetime" < :end', { end })
    .andWhere('booking."datetime" + make_interval(mins => booking."duration_minutes") > :start', { start })
    .getOne();
  if (booking) return true;

  const block = await manager
    .createQueryBuilder("OutOfService", "block")
    .where('block."court_id" = :courtId', { courtId })
    .andWhere('block."from_datetime" < :end', { end })
    .andWhere('block."to_datetime" > :start', { start })
    .getOne();
  return block !== null;
}

/** Reserva para el titular la fecha indicada; devuelve null si el horario está ocupado. */
async function reserveDate(manager: EntityManager, fixed: FixedBooking, date: string): Promise<Booking | null> {
  const start = occurrenceStart(date, fixed.startTime);
  if (await isSlotTaken(manager, fixed.court.id, start, fixed.durationMinutes)) {
    return null;
  }
  const bookings = manager.getRepository<Booking>("Booking");
  return bookings.save(
    bookings.create({
      fromDateTime: start,
      durationMinutes: fixed.durationMinutes,
      bookingState: BookingState.RESERVED,
      price: fixed.court.price,
      booker: { id: fixed.booker.id, phoneNumber: fixed.booker.phoneNumber },
      court: { id: fixed.court.id },
    }),
  );
}

/**
 * Genera las fechas que faltan del turno fijo hasta el horizonte de 6 meses.
 * Las ya registradas (reservadas, liberadas o salteadas) no se tocan, así que
 * se puede correr las veces que haga falta. Devuelve las fechas salteadas por
 * estar ocupadas y cuántas fechas nuevas se registraron.
 */
async function generateDates(manager: EntityManager, fixed: FixedBooking, now: Date) {
  const today = todayISO(now);
  const from = fixed.startDate > today ? fixed.startDate : today;
  const until = addDaysISO(today, FIXED_BOOKING_HORIZON_DAYS);

  const dates = manager.getRepository<FixedBookingDate>("FixedBookingDate");
  const existing = await dates.find({ where: { fixedBooking: { id: fixed.id } } });
  const registered = new Set(existing.map((d) => d.date));

  await lockCourt(manager, fixed.court.id);

  const conflicts: string[] = [];
  let created = 0;
  for (const date of occurrenceDates(fixed, from, until)) {
    if (registered.has(date) || occurrenceStart(date, fixed.startTime) <= now) continue;

    const booking = await reserveDate(manager, fixed, date);
    await dates.save(
      dates.create({
        fixedBooking: { id: fixed.id },
        date,
        state: booking ? FixedBookingDateState.BOOKED : FixedBookingDateState.CONFLICT,
        booking,
      }),
    );
    if (!booking) conflicts.push(date);
    created += 1;
  }
  return { conflicts, created };
}

async function resolveHolder(manager: EntityManager, holder: FixedBookingHolder): Promise<Booker> {
  if ("playerId" in holder) {
    const player = await manager.getRepository<Player>("Player").findOne({ where: { id: holder.playerId } });
    if (!player) throw new FixedBookingError("El jugador no existe.");
    return player;
  }

  const names = holder.names.trim();
  const lastnames = holder.lastnames.trim();
  const phoneNumber = holder.phoneNumber.trim();
  if (!names || !lastnames || !phoneNumber) {
    throw new FixedBookingError("Completá el nombre, el apellido y el teléfono del titular.");
  }

  // Si ya existe alguien con ese teléfono (jugador o no), el turno queda a su nombre.
  const bookers = manager.getRepository<Booker>("Booker");
  const existing = await bookers.findOne({ where: { phoneNumber } });
  return existing ?? bookers.save(bookers.create({ names, lastnames, phoneNumber }));
}

/**
 * Alta de un turno fijo (HU-41), solo para administradores. Reserva sus fechas
 * de los próximos 6 meses; las que ya estaban ocupadas se saltean y se devuelven
 * en `conflicts` para que el admin las vea.
 */
export async function createFixedBooking(
  input: CreateFixedBookingInput,
): Promise<ActionResult<{ id: number; conflicts: string[] }>> {
  try {
    await requireAdmin();

    if (input.startDate < todayISO()) {
      throw new FixedBookingError("La fecha de inicio no puede ser anterior a hoy.");
    }
    if (input.endDate && input.endDate < input.startDate) {
      throw new FixedBookingError("La fecha de fin no puede ser anterior a la de inicio.");
    }

    const dataSource = await getDataSource();
    const data = await dataSource.transaction(async (manager) => {
      const court = await manager
        .getRepository<Court>("Court")
        .findOne({ where: { id: input.courtId }, relations: { schedules: true } });
      if (!court) throw new FixedBookingError("La cancha no existe.");
      if (court.state === CourtState.CLOSED_DOWN) throw new FixedBookingError("La cancha está dada de baja.");

      const durationMinutes = input.durationMinutes ?? 90;
      const schedule = court.schedules.find((s) => s.dayOfWeek === dayOfWeekOfISO(input.startDate));
      const start = toMinutes(input.startTime);
      if (
        !schedule ||
        start < toMinutes(String(schedule.openingTime)) ||
        start + durationMinutes > toMinutes(String(schedule.closingTime))
      ) {
        throw new FixedBookingError("La cancha no está abierta en ese horario ese día.");
      }

      const booker = await resolveHolder(manager, input.holder);

      const fixedBookings = manager.getRepository<FixedBooking>("FixedBooking");
      const fixed = await fixedBookings.save(
        fixedBookings.create({
          court: { id: court.id },
          booker: { id: booker.id, phoneNumber: booker.phoneNumber },
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          startTime: input.startTime,
          durationMinutes,
          frequency: input.frequency,
          isActive: true,
        }),
      );
      fixed.court = court;
      fixed.booker = booker;

      const { conflicts } = await generateDates(manager, fixed, new Date());
      return { id: fixed.id, conflicts };
    });

    return { success: true, data };
  } catch (error) {
    if (!(error instanceof FixedBookingError)) console.error("createFixedBooking", error);
    return { success: false, error: errorMessage(error, "No se pudo crear el turno fijo.") };
  }
}

/**
 * Genera las fechas nuevas de los turnos fijos activos a medida que entran en
 * el horizonte de 6 meses. Pensada para el proceso en segundo plano
 * (src/jobs/fixed-booking-extension.ts). Devuelve cuántas fechas registró.
 */
export async function extendFixedBookings(): Promise<ActionResult<number>> {
  try {
    const dataSource = await getDataSource();
    const now = new Date();
    const today = todayISO(now);
    const active = await dataSource
      .getRepository<FixedBooking>("FixedBooking")
      .find({ where: { isActive: true }, relations: { court: true, booker: true } });

    let total = 0;
    for (const fixed of active) {
      if (fixed.court.state === CourtState.CLOSED_DOWN || (fixed.endDate && fixed.endDate < today)) continue;
      const { created } = await dataSource.transaction((manager) => generateDates(manager, fixed, now));
      total += created;
    }
    return { success: true, data: total };
  } catch (error) {
    console.error("extendFixedBookings", error);
    return { success: false, error: "No se pudieron generar las fechas de los turnos fijos." };
  }
}

/** Libera una sola fecha del turno fijo: cancela ese turno, sin penalización, y le avisa al titular. */
export async function releaseFixedBookingDate(fixedBookingDateId: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();

    const bookingId = await dataSource.transaction(async (manager) => {
      const dates = manager.getRepository<FixedBookingDate>("FixedBookingDate");
      const date = await dates.findOne({ where: { id: fixedBookingDateId }, relations: { booking: true } });
      if (!date) throw new FixedBookingError("La fecha del turno fijo no existe.");
      if (
        date.state !== FixedBookingDateState.BOOKED ||
        !date.booking ||
        date.booking.bookingState === BookingState.CANCELLED
      ) {
        throw new FixedBookingError("Esa fecha del turno fijo no está reservada.");
      }
      if (new Date(date.booking.fromDateTime) <= new Date()) {
        throw new FixedBookingError("Esa fecha ya pasó.");
      }

      await manager.getRepository<Booking>("Booking").update(date.booking.id, { bookingState: BookingState.CANCELLED });
      await dates.update(date.id, { state: FixedBookingDateState.RELEASED });
      return date.booking.id;
    });

    await notifyFixedDateReleased(bookingId);
    return { success: true, data: null };
  } catch (error) {
    if (!(error instanceof FixedBookingError)) console.error("releaseFixedBookingDate", error);
    return { success: false, error: errorMessage(error, "No se pudo liberar la fecha.") };
  }
}

/** Vuelve a reservar para el titular una fecha liberada o salteada, si el horario sigue libre. */
export async function restoreFixedBookingDate(fixedBookingDateId: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();

    await dataSource.transaction(async (manager) => {
      const dates = manager.getRepository<FixedBookingDate>("FixedBookingDate");
      const date = await dates.findOne({
        where: { id: fixedBookingDateId },
        relations: { fixedBooking: { court: true, booker: true } },
      });
      if (!date) throw new FixedBookingError("La fecha del turno fijo no existe.");
      if (date.state === FixedBookingDateState.BOOKED) {
        throw new FixedBookingError("Esa fecha del turno fijo ya está reservada.");
      }
      if (!date.fixedBooking.isActive) throw new FixedBookingError("El turno fijo fue dado de baja.");
      if (occurrenceStart(date.date, date.fixedBooking.startTime) <= new Date()) {
        throw new FixedBookingError("Esa fecha ya pasó.");
      }

      await lockCourt(manager, date.fixedBooking.court.id);
      const booking = await reserveDate(manager, date.fixedBooking, date.date);
      if (!booking) throw new FixedBookingError("Ese horario ya fue reservado por otra persona.");

      date.state = FixedBookingDateState.BOOKED;
      date.booking = booking;
      await dates.save(date);
    });

    return { success: true, data: null };
  } catch (error) {
    if (!(error instanceof FixedBookingError)) console.error("restoreFixedBookingDate", error);
    return { success: false, error: errorMessage(error, "No se pudo restaurar la fecha.") };
  }
}

/** Da de baja el turno fijo: cancela todas sus fechas futuras, no genera más y le avisa al titular. */
export async function cancelFixedBooking(fixedBookingId: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const now = new Date();

    await dataSource.transaction(async (manager) => {
      const fixedBookings = manager.getRepository<FixedBooking>("FixedBooking");
      const fixed = await fixedBookings.findOne({ where: { id: fixedBookingId } });
      if (!fixed) throw new FixedBookingError("El turno fijo no existe.");
      if (!fixed.isActive) throw new FixedBookingError("El turno fijo ya fue dado de baja.");

      await fixedBookings.update(fixed.id, { isActive: false });

      const dates = manager.getRepository<FixedBookingDate>("FixedBookingDate");
      const booked = await dates.find({
        where: { fixedBooking: { id: fixed.id }, state: FixedBookingDateState.BOOKED },
        relations: { booking: true },
      });
      const future = booked.filter((d) => d.booking && new Date(d.booking.fromDateTime) > now);
      if (future.length > 0) {
        await manager.getRepository<Booking>("Booking").update(
          future.map((d) => d.booking!.id),
          { bookingState: BookingState.CANCELLED },
        );
        await dates.update({ id: In(future.map((d) => d.id)) }, { state: FixedBookingDateState.RELEASED });
      }
    });

    await notifyFixedBookingCancelled(fixedBookingId);
    return { success: true, data: null };
  } catch (error) {
    if (!(error instanceof FixedBookingError)) console.error("cancelFixedBooking", error);
    return { success: false, error: errorMessage(error, "No se pudo dar de baja el turno fijo.") };
  }
}

/** Turnos fijos para el panel de administración, con sus próximas fechas. */
export async function getFixedBookingsAdmin(): Promise<ActionResult<FixedBookingAdminItem[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const today = todayISO();

    const found = await dataSource.getRepository<FixedBooking>("FixedBooking").find({
      relations: { court: true, booker: true, dates: { booking: true } },
      order: { createdAt: "DESC" },
    });

    const data: FixedBookingAdminItem[] = found.map((fixed) => ({
      id: fixed.id,
      courtId: fixed.court.id,
      courtNumber: fixed.court.number,
      holderName: `${fixed.booker.names} ${fixed.booker.lastnames}`,
      holderPhoneNumber: fixed.booker.phoneNumber,
      frequency: fixed.frequency,
      startDate: fixed.startDate,
      endDate: fixed.endDate,
      startTime: fixed.startTime.slice(0, 5),
      durationMinutes: fixed.durationMinutes,
      isActive: fixed.isActive,
      upcomingDates: fixed.dates
        .filter((d) => d.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, UPCOMING_DATES_LIMIT)
        .map((d) => ({ id: d.id, date: d.date, state: d.state, bookingId: d.booking?.id ?? null })),
    }));

    return { success: true, data };
  } catch (error) {
    if (!(error instanceof ForbiddenError || error instanceof UnauthorizedError)) {
      console.error("getFixedBookingsAdmin", error);
    }
    return { success: false, error: errorMessage(error, "No se pudieron obtener los turnos fijos.") };
  }
}
