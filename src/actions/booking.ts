"use server";

import "reflect-metadata";
import { EntityManager } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { BookingState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS, OPEN_MATCH_MIN_HOURS_BEFORE_START } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateBookingInput = {
  fromDateTime: Date;
  durationMinutes?: number;
  bookingState?: BookingState;
  /**
   * Cantidad de jugadores con la que reserva quien crea el turno (1 a 4, contando
   * a los acompañantes que trae y no tienen cuenta propia). Menos de 4 y sin un
   * bookingState explícito crea además un partido abierto para ese turno.
   */
  groupSize?: number;
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
const INVALID_GROUP_SIZE_MESSAGE = `La cantidad de jugadores debe ser entre 1 y ${OPEN_MATCH_MAX_PLAYERS}.`;
const OPEN_MATCH_TOO_SOON_MESSAGE = `No se puede crear un partido abierto con menos de ${OPEN_MATCH_MIN_HOURS_BEFORE_START} horas de anticipación.`;

class DoubleBookingError extends Error {}
class InvalidGroupSizeError extends Error {}
class OpenMatchTooSoonError extends Error {}

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
    .where('booking."court_id" = :courtId', { courtId: params.courtId })
    .andWhere('booking."booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
    .andWhere('booking."datetime" < :end', {
      end: new Date(params.start.getTime() + params.durationMinutes * 60_000),
    })
    .andWhere(
      'booking."datetime" + make_interval(mins => booking."duration_minutes") > :start',
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
      // Sin groupSize explícito no es un partido abierto: se asume completo (comportamiento previo).
      const groupSize = input.groupSize ?? (input.bookingState ? 1 : OPEN_MATCH_MAX_PLAYERS);
      if (groupSize < 1 || groupSize > OPEN_MATCH_MAX_PLAYERS) {
        throw new InvalidGroupSizeError();
      }
      const isOpenMatch = !input.bookingState && groupSize < OPEN_MATCH_MAX_PLAYERS;
      const bookingState = input.bookingState ?? BookingState.RESERVED;

      if (isOpenMatch) {
        const hoursUntilStart = (input.fromDateTime.getTime() - Date.now()) / (60 * 60_000);
        if (hoursUntilStart < OPEN_MATCH_MIN_HOURS_BEFORE_START) {
          throw new OpenMatchTooSoonError();
        }
      }

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

      const saved = await bookings.save(booking);

      // Partido abierto: el turno queda reservado y, además, se crea el partido
      // asociado con quien lo creó como primer jugador confirmado.
      if (isOpenMatch) {
        const matches = manager.getRepository(Match);
        const match = await matches.save(
          matches.create({ booking: { id: saved.id }, needPlayers: true }),
        );

        const matchPlayers = manager.getRepository(MatchPlayer);
        await matchPlayers.save(
          matchPlayers.create({
            match: { id: match.id },
            player: { id: input.playerId },
            playersCount: groupSize,
          }),
        );
      }

      return saved;
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof DoubleBookingError) {
      return { success: false, error: DOUBLE_BOOKING_MESSAGE };
    }
    if (error instanceof InvalidGroupSizeError) {
      return { success: false, error: INVALID_GROUP_SIZE_MESSAGE };
    }
    if (error instanceof OpenMatchTooSoonError) {
      return { success: false, error: OPEN_MATCH_TOO_SOON_MESSAGE };
    }
    console.error("createBooking", error);
    return { success: false, error: "No se pudo crear la reserva." };
  }
}

export async function getBookings(): Promise<ActionResult<Booking[]>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const data = await bookings.find({
      relations: { player: true, court: true, match: { players: true } },
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
      relations: { player: true, court: true, match: { players: true } },
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
