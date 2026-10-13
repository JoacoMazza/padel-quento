"use server";

import "reflect-metadata";
import type { Booking } from "@/src/entities/Booking";
import type { Court } from "@/src/entities/Court";
import type { Player } from "@/src/entities/Player";
import { BookingState, CourtState } from "@/src/domain/enums";
import { occurrenceStart } from "@/src/domain/fixed-booking";
import { getDataSource } from "@/src/lib/db";
import type { ActionResult } from "@/src/lib/action-result";
import { ForbiddenError, UnauthorizedError, requireAdmin } from "@/src/lib/rbac";
import {
  BookingRuleError,
  isSlotTaken,
  isWithinSchedule,
  lockCourt,
  resolveBookingHolder,
  type BookingHolder,
} from "@/src/lib/court-booking";

export type CreateBookingAdminInput = {
  courtId: number;
  /** Día del turno ("YYYY-MM-DD"). */
  date: string;
  /** Hora de inicio ("HH:MM"). */
  startTime: string;
  durationMinutes?: number;
  /** Si no se indica, el precio actual de la cancha. */
  price?: number;
  holder: BookingHolder;
};

/**
 * Alta de un turno común desde la Turnera Global, solo para administradores
 * (por ejemplo, alguien que llama o se acerca al mostrador). El turno queda
 * reservado completo, sin partido abierto, a nombre de un jugador registrado o
 * de alguien sin cuenta.
 */
export async function createBookingAdmin(input: CreateBookingAdminInput): Promise<ActionResult<{ id: number }>> {
  try {
    await requireAdmin();

    const durationMinutes = input.durationMinutes ?? 90;
    const start = occurrenceStart(input.date, input.startTime);
    if (start.getTime() <= Date.now()) {
      throw new BookingRuleError("No se puede agendar un turno en un horario que ya pasó.");
    }
    if (input.price !== undefined && !(input.price > 0)) {
      throw new BookingRuleError("El precio debe ser mayor a 0.");
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
          price: input.price ?? court.price,
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
