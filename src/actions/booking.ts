"use server";

import "reflect-metadata";
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

export async function createBooking(
  input: CreateBookingInput,
): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");

    const booking = bookings.create({
      fromDateTime: input.fromDateTime,
      durationMinutes: input.durationMinutes ?? 90,
      bookingState: input.bookingState ?? BookingState.RESERVED,
      player: { id: input.playerId },
      court: { id: input.courtId },
    });

    const saved = await bookings.save(booking);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
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
    const bookings = dataSource.getRepository<Booking>("Booking");

    const booking = await bookings.findOne({ where: { id } });
    if (!booking) {
      return { success: false, error: "La reserva no existe." };
    }

    const { playerId, courtId, ...rest } = input;
    bookings.merge(booking, {
      ...rest,
      ...(playerId ? { player: { id: playerId } } : {}),
      ...(courtId ? { court: { id: courtId } } : {}),
    });

    const saved = await bookings.save(booking);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
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
