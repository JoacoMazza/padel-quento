import "reflect-metadata";
import type { EntityManager } from "typeorm";
import type { Booker } from "@/src/entities/Booker";
import type { Booking } from "@/src/entities/Booking";
import type { Player } from "@/src/entities/Player";
import type { Schedule } from "@/src/entities/Schedule";
import { BookingState } from "@/src/domain/enums";
import { dayOfWeekOfISO } from "@/src/domain/fixed-booking";

/**
 * Reglas compartidas por las altas que hace el admin desde la Turnera Global:
 * turnos fijos (src/actions/fixedBooking.ts) y turnos comunes
 * (src/actions/adminBooking.ts).
 */

/** Error de validación cuyo mensaje se muestra tal cual al admin. */
export class BookingRuleError extends Error {}

/** Titular del turno: un jugador registrado, o alguien sin cuenta identificado por su teléfono. */
export type BookingHolder = { playerId: number } | { names: string; lastnames: string; phoneNumber: string };

export function toMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/** Minutos desde las 00:00 a "HH:MM" (por ejemplo 570 → "09:30"). */
export function toTimeLabel(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** El turno empieza y termina dentro del horario de la cancha para el día de `date` ("YYYY-MM-DD"). */
export function isWithinSchedule(schedules: Schedule[], date: string, startTime: string, durationMinutes: number) {
  const schedule = schedules.find((s) => s.dayOfWeek === dayOfWeekOfISO(date));
  const start = toMinutes(startTime);
  return (
    schedule !== undefined &&
    start >= toMinutes(String(schedule.openingTime)) &&
    start + durationMinutes <= toMinutes(String(schedule.closingTime))
  );
}

// Mismo lock por cancha que createBooking: serializa las reservas de la cancha
// para que dos altas simultáneas no tomen el mismo horario.
export async function lockCourt(manager: EntityManager, courtId: number) {
  await manager.query("SELECT pg_advisory_xact_lock($1)", [courtId]);
}

/** El horario está ocupado si se superpone con un turno no cancelado o con un bloqueo de la cancha. */
export async function isSlotTaken(manager: EntityManager, courtId: number, start: Date, durationMinutes: number) {
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

/**
 * Devuelve el booker titular. Para alguien sin cuenta busca por teléfono: si ya
 * existe alguien con ese teléfono (jugador o no), el turno queda a su nombre.
 */
export async function resolveBookingHolder(manager: EntityManager, holder: BookingHolder): Promise<Booker> {
  if ("playerId" in holder) {
    const player = await manager
      .getRepository<Player>("Player")
      .findOne({ where: { id: holder.playerId }, relations: { account: true } });
    if (!player) throw new BookingRuleError("El jugador no existe.");
    return player;
  }

  const names = holder.names.trim();
  const lastnames = holder.lastnames.trim();
  const phoneNumber = holder.phoneNumber.trim();
  if (!names || !lastnames || !phoneNumber) {
    throw new BookingRuleError("Completá el nombre, el apellido y el teléfono del titular.");
  }

  const bookers = manager.getRepository<Booker>("Booker");
  const existing = await bookers.findOne({ where: { phoneNumber } });
  return existing ?? bookers.save(bookers.create({ names, lastnames, phoneNumber }));
}
