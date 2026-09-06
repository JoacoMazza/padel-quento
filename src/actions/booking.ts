"use server";

import "reflect-metadata";
import { EntityManager } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { BookingState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateBookingInput = {
  fromDateTime: Date;
  durationMinutes?: number;
  bookingState?: BookingState;
  playerId: number;
  courtId: number;
};

export type UpdateBookingInput = Partial<
  Omit<CreateBookingInput, "playerId" | "courtId">
> & {
  playerId?: number;
  courtId?: number;
};

const DOUBLE_BOOKING_MESSAGE = "Ese horario ya está reservado para esta cancha.";

class DoubleBookingError extends Error {}

/**
 * Un turno ocupa la cancha salvo que esté cancelado; por eso alcanza con excluir
 * bookingState = CANCELLED al buscar solapamientos, sin importar el resto de los estados.
 */
async function hasOverlappingBooking(
  manager: EntityManager,
  params: { courtId: number; start: Date; durationMinutes: number; excludeBookingId?: number },
): Promise<boolean> {
  const qb = manager
    .createQueryBuilder(Booking, "booking")
    .where('booking."courtId" = :courtId', { courtId: params.courtId })
    .andWhere('booking."bookingState" != :cancelled', { cancelled: BookingState.CANCELLED })
    .andWhere('booking."fromDateTime" < :end', {
      end: new Date(params.start.getTime() + params.durationMinutes * 60_000),
    })
    .andWhere(
      'booking."fromDateTime" + make_interval(mins => booking."durationMinutes") > :start',
      { start: params.start },
    );

  if (params.excludeBookingId) {
    qb.andWhere('booking."id" != :excludeId', { excludeId: params.excludeBookingId });
  }

  const overlapping = await qb.getOne();
  return overlapping !== null;
}

export async function createBooking(
  input: CreateBookingInput,
): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      // Serializa los intentos de reserva para la misma cancha: el lock se toma y
      // libera automáticamente con la transacción, así el chequeo de abajo nunca
      // corre en paralelo con otro para la misma cancha.
      await manager.query("SELECT pg_advisory_xact_lock($1)", [input.courtId]);

      const durationMinutes = input.durationMinutes ?? 90;
      const bookingState = input.bookingState ?? BookingState.RESERVED;

      if (bookingState !== BookingState.CANCELLED) {
        const overlaps = await hasOverlappingBooking(manager, {
          courtId: input.courtId,
          start: input.fromDateTime,
          durationMinutes,
        });
        if (overlaps) {
          throw new DoubleBookingError();
        }
      }

      const bookings = manager.getRepository(Booking);
      const booking = bookings.create({
        fromDateTime: input.fromDateTime,
        durationMinutes,
        bookingState,
        player: { id: input.playerId },
        court: { id: input.courtId },
      });

      return bookings.save(booking);
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof DoubleBookingError) {
      return { success: false, error: DOUBLE_BOOKING_MESSAGE };
    }
    console.error("createBooking", error);
    return { success: false, error: "No se pudo crear la reserva." };
  }
}

export async function getBookings(): Promise<ActionResult<Booking[]>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const data = await bookings.find({ relations: { player: true, court: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getBookings", error);
    return { success: false, error: "No se pudieron obtener las reservas." };
  }
}

export async function getBookingById(
  id: number,
): Promise<ActionResult<Booking | null>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const data = await bookings.findOne({
      where: { id },
      relations: { player: true, court: true },
    });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getBookingById", error);
    return { success: false, error: "No se pudo obtener la reserva." };
  }
}

export async function updateBooking(
  id: number,
  input: UpdateBookingInput,
): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      const bookings = manager.getRepository(Booking);
      const booking = await bookings.findOne({ where: { id }, relations: { court: true } });
      if (!booking) {
        throw new Error("NOT_FOUND");
      }

      const { playerId, courtId, ...rest } = input;

      const effectiveCourtId = courtId ?? booking.court?.id;
      const effectiveState = input.bookingState ?? booking.bookingState;

      if (effectiveState !== BookingState.CANCELLED && effectiveCourtId) {
        // El lock es por cancha: si además se está moviendo de cancha, hay que
        // serializar contra la cancha destino, que es la que puede tener el choque.
        await manager.query("SELECT pg_advisory_xact_lock($1)", [effectiveCourtId]);

        const overlaps = await hasOverlappingBooking(manager, {
          courtId: effectiveCourtId,
          start: input.fromDateTime ?? booking.fromDateTime,
          durationMinutes: input.durationMinutes ?? booking.durationMinutes,
          excludeBookingId: id,
        });
        if (overlaps) {
          throw new DoubleBookingError();
        }
      }

      bookings.merge(booking, {
        ...rest,
        ...(playerId ? { player: { id: playerId } } : {}),
        ...(courtId ? { court: { id: courtId } } : {}),
      });

      return bookings.save(booking);
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof DoubleBookingError) {
      return { success: false, error: DOUBLE_BOOKING_MESSAGE };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La reserva no existe." };
    }
    console.error("updateBooking", error);
    return { success: false, error: "No se pudo actualizar la reserva." };
  }
}

export async function deleteBooking(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");

    const result = await bookings.delete(id);
    if (!result.affected) {
      return { success: false, error: "La reserva no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deleteBooking", error);
    return { success: false, error: "No se pudo eliminar la reserva." };
  }
}
