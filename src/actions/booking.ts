"use server";

import "reflect-metadata";
import { Booking } from "@/src/entities/Booking";
import { BookingState } from "@/src/domain/enums";
import { PENALTY_POINTS } from "@/src/domain/constants";
import { isLateCancellation } from "@/src/domain/late-cancellation";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { getSessionPlayerId } from "@/src/lib/session-player";
import {
  BOOKER_NOT_FOUND_MESSAGE,
  BookerNotFoundError,
  DOUBLE_BOOKING_MESSAGE,
  DoubleBookingError,
  LATE_CANCELLATION_REASON,
  NO_PLAYER_ACCOUNT_MESSAGE,
  NoPlayerAccountError,
  createBookingForPlayer,
  findBookingPlayer,
  hasOverlappingBooking,
  joinOpenMatchForPlayer,
  type CreateBookingInput,
  type JoinOpenMatchInput,
  type UpdateBookingInput,
} from "@/src/lib/bookings";
import { recordPointsMovement } from "@/src/actions/profile";

export type { CreateBookingInput, JoinOpenMatchInput, UpdateBookingInput };

const LOGIN_REQUIRED_MESSAGE = "Tenés que iniciar sesión para reservar.";

/**
 * Reserva un turno a nombre del jugador de la sesión. El cliente no elige a
 * nombre de quién reserva: sin sesión, devuelve el error para iniciar sesión.
 */
export async function createBooking(
  input: Omit<CreateBookingInput, "bookerId">,
): Promise<ActionResult<Booking>> {
  const playerId = await getSessionPlayerId();
  if (playerId === null) {
    return { success: false, error: LOGIN_REQUIRED_MESSAGE };
  }
  return createBookingForPlayer({ ...input, bookerId: playerId });
}

/** Suma al jugador de la sesión a un partido abierto (nunca al que indique el cliente). */
export async function joinOpenMatch(
  input: Omit<JoinOpenMatchInput, "playerId">,
): Promise<ActionResult<Booking>> {
  const playerId = await getSessionPlayerId();
  if (playerId === null) {
    return { success: false, error: LOGIN_REQUIRED_MESSAGE };
  }
  return joinOpenMatchForPlayer({ ...input, playerId });
}

const BOOKING_RELATIONS = {
  booker: true,
  court: true,
  match: { matchPlayers: { player: true }, chat: true },
} as const;

export async function getBookings(): Promise<ActionResult<Booking[]>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const data = await bookings.find({
      relations: BOOKING_RELATIONS,
    });
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
      relations: BOOKING_RELATIONS,
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

    let lateCancellationPlayerId: number | null = null;

    const saved = await dataSource.transaction(async (manager) => {
      const bookings = manager.getRepository<Booking>("Booking");
      const booking = await bookings.findOne({
        where: { id },
        relations: { court: true, booker: true },
      });
      if (!booking) {
        throw new Error("NOT_FOUND");
      }

      // Player hereda de Booker: el id de quien reservó es el de su jugador. Un
      // turno previo a la migración puede no tener quien reservó.
      if (
        input.bookingState === BookingState.CANCELLED &&
        booking.bookingState !== BookingState.CANCELLED &&
        booking.booker &&
        isLateCancellation(booking.fromDateTime)
      ) {
        lateCancellationPlayerId = booking.booker.id;
      }

      const { bookerId, courtId, ...rest } = input;

      const booker = bookerId ? await findBookingPlayer(manager, bookerId) : null;

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
        ...(booker ? { booker: { id: booker.id, phoneNumber: booker.phoneNumber } } : {}),
        ...(courtId ? { court: { id: courtId } } : {}),
      });

      return bookings.save(booking);
    });

    // Fuera de la transacción: recordPointsMovement usa su propia conexión, y
    // solo se penaliza si la cancelación efectivamente se guardó (RN-03).
    if (lateCancellationPlayerId !== null) {
      await recordPointsMovement(lateCancellationPlayerId, PENALTY_POINTS, "penalty", LATE_CANCELLATION_REASON);
    }

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof DoubleBookingError) {
      return { success: false, error: DOUBLE_BOOKING_MESSAGE };
    }
    if (error instanceof BookerNotFoundError) {
      return { success: false, error: BOOKER_NOT_FOUND_MESSAGE };
    }
    if (error instanceof NoPlayerAccountError) {
      return { success: false, error: NO_PLAYER_ACCOUNT_MESSAGE };
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
