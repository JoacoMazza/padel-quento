"use server";

import "reflect-metadata";
import type { Booking } from "@/src/entities/Booking";
import type { Court } from "@/src/entities/Court";
import type { Player } from "@/src/entities/Player";
import { BookingState, CourtState } from "@/src/domain/enums";
import { dayOfWeekOfISO, occurrenceStart } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";
import {
  BookingRuleError,
  isSlotStart,
  isSlotTaken,
  isWithinSchedule,
  lockCourt,
  resolveBookingHolder,
  toMinutes,
  toTimeLabel,
  type BookingHolder,
} from "@/src/lib/court-booking";

export type CreateBookingAdminInput = {
  courtId: number;
  /** Día del turno ("YYYY-MM-DD"). */
  date: string;
  /** Hora de inicio ("HH:MM"). */
  startTime: string;
  durationMinutes?: number;
  holder: BookingHolder;
};

const SLOT_DURATION_MINUTES = 90;

/**
 * Alta de un turno común desde la Turnera Global, solo para administradores
 * (por ejemplo, alguien que llama o se acerca al mostrador). El turno queda
 * reservado completo, sin partido abierto, a nombre de un jugador registrado o
 * de alguien sin cuenta, con el precio actual de la cancha.
 */
export async function createBookingAdmin(input: CreateBookingAdminInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireAdmin();

    const durationMinutes = input.durationMinutes ?? SLOT_DURATION_MINUTES;
    const start = occurrenceStart(input.date, input.startTime);
    if (start.getTime() <= Date.now()) {
      throw new BookingRuleError("No se puede agendar un turno en un horario que ya pasó.");
    }

    const dataSource = await getDataSource();
    const id = await dataSource.transaction(async (manager) => {
      const court = await manager
        .getRepository<Court>("Court")
        .findOne({ where: { id: input.courtId }, relations: { schedules: true } });
      if (!court) throw new BookingRuleError("La cancha no existe.");
      if (court.state === CourtState.CLOSED_DOWN) throw new BookingRuleError("La cancha está dada de baja.");
      if (!isWithinSchedule(court.schedules, input.date, input.startTime, durationMinutes)) {
        throw new BookingRuleError("La cancha no está abierta en ese horario ese día.");
      }
      if (!isSlotStart(court.schedules, input.date, input.startTime)) {
        throw new BookingRuleError("Ese horario no corresponde a un turno de la cancha.");
      }

      const booker = await resolveBookingHolder(manager, input.holder);
      if ((booker as Player).account?.isBlocked) {
        throw new BookingRuleError(
          "El jugador está bloqueado: desbloquealo desde Gestión de Usuarios para agendarle un turno.",
        );
      }

      await lockCourt(manager, court.id);
      if (await isSlotTaken(manager, court.id, start, durationMinutes)) {
        throw new BookingRuleError("Ese horario ya está ocupado en esta cancha.");
      }

      const bookings = manager.getRepository<Booking>("Booking");
      const saved = await bookings.save(
        bookings.create({
          fromDateTime: start,
          durationMinutes,
          bookingState: BookingState.RESERVED,
          price: court.price,
          // La FK es booker_phone_number: TypeORM necesita el teléfono para armarla.
          booker: { id: booker.id, phoneNumber: booker.phoneNumber },
          court: { id: court.id },
        }),
      );
      return saved.id;
    });

    return { success: true, data: { id } };
  } catch (error) {
    if (error instanceof BookingRuleError || error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    console.error("createBookingAdmin", error);
    return { success: false, error: "No se pudo agendar el turno." };
  }
}

/**
 * Turnos libres de la grilla (de 90 minutos desde la apertura) para una cancha
 * y un día, para que el formulario del admin solo ofrezca los que se pueden
 * agendar: dentro del horario, sin turnos ni bloqueos que se pisen y que no
 * hayan empezado. Devuelve las horas como "HH:MM".
 */
export async function getAvailableSlotsAdmin(input: { courtId: number; date: string }): Promise<ActionResult<string[]>> {
  try {
    await requireAdmin();

    const dataSource = await getDataSource();
    const court = await dataSource
      .getRepository<Court>("Court")
      .findOne({ where: { id: input.courtId }, relations: { schedules: true } });
    const schedule = court?.schedules.find((s) => s.dayOfWeek === dayOfWeekOfISO(input.date));
    if (!court || court.state === CourtState.CLOSED_DOWN || !schedule) {
      return { success: true, data: [] };
    }

    const closing = toMinutes(String(schedule.closingTime));
    const now = Date.now();
    const slots: string[] = [];
    for (
      let minutes = toMinutes(String(schedule.openingTime));
      minutes + SLOT_DURATION_MINUTES <= closing;
      minutes += SLOT_DURATION_MINUTES
    ) {
      const startTime = toTimeLabel(minutes);
      const start = occurrenceStart(input.date, startTime);
      if (start.getTime() <= now) continue;
      if (await isSlotTaken(dataSource.manager, court.id, start, SLOT_DURATION_MINUTES)) continue;
      slots.push(startTime);
    }
    return { success: true, data: slots };
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return { success: false, error: error.message };
    }
    console.error("getAvailableSlotsAdmin", error);
    return { success: false, error: "No se pudieron obtener los horarios libres." };
  }
}
