"use server";

import "reflect-metadata";
import { EntityManager } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { BookingState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateBookingInput = {
  fromDateTime: Date;
  durationMinutes?: number;
  bookingState?: BookingState;
  /**
   * Si es true, el turno queda como partido abierto: bookingState pasa a
   * PENDING_PLAYERS y se crea un Match donde quien reserva es el primer
   * jugador confirmado, dejando lugares libres para que se sumen otros.
   */
  isOpenMatch?: boolean;
  playerId: number;
  courtId: number;
};

export type UpdateBookingInput = Partial<
  Omit<CreateBookingInput, "playerId" | "courtId">
> & {
  playerId?: number;
  courtId?: number;
};

export type JoinOpenMatchInput = {
  bookingId: number;
  playerId: number;
};

const DOUBLE_BOOKING_MESSAGE = "Ese horario ya está reservado para esta cancha.";
const BOOKING_NOT_FOUND_MESSAGE = "El turno no existe.";
const NOT_OPEN_MATCH_MESSAGE = "Este turno no es un partido abierto.";
const ALREADY_JOINED_MESSAGE = "Ya estás anotado en este partido.";
const MATCH_FULL_MESSAGE = "El partido ya está completo, no quedan lugares libres.";

// Namespace distinto (forma de dos claves) al lock por cancha de createBooking/updateBooking,
// para que un bookingId nunca contienda con un courtId que tenga el mismo número.
const JOIN_MATCH_LOCK_CLASS = 42;

class DoubleBookingError extends Error {}
class BookingNotFoundError extends Error {}
class NotOpenMatchError extends Error {}
class AlreadyJoinedError extends Error {}
class MatchFullError extends Error {}

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
      const bookingState =
        input.bookingState ?? (input.isOpenMatch ? BookingState.PENDING_PLAYERS : BookingState.RESERVED);

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

      // En un partido abierto, quien lo crea queda registrado como el primer jugador confirmado.
      if (bookingState === BookingState.PENDING_PLAYERS) {
        const matches = manager.getRepository(Match);
        const matchPlayers = manager.getRepository(MatchPlayer);

        const match = await matches.save(
          matches.create({ booking: { id: saved.id }, needsPlayers: true }),
        );
        await matchPlayers.save(
          matchPlayers.create({ match: { id: match.id }, player: { id: input.playerId } }),
        );
      }

      return saved;
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

/**
 * Suma a un jugador a un partido abierto (bookingState = PENDING_PLAYERS) hasta
 * completar el cupo máximo de OPEN_MATCH_MAX_PLAYERS jugadores distintos. Si con
 * esta suma se completa el cupo, el turno pasa a RESERVED.
 */
export async function joinOpenMatch(
  input: JoinOpenMatchInput,
): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      // Serializa los intentos de sumarse al mismo partido para no pasarse del cupo máximo.
      await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [
        JOIN_MATCH_LOCK_CLASS,
        input.bookingId,
      ]);

      const bookings = manager.getRepository(Booking);
      const booking = await bookings.findOne({ where: { id: input.bookingId } });
      if (!booking) {
        throw new BookingNotFoundError();
      }
      if (booking.bookingState !== BookingState.PENDING_PLAYERS) {
        throw new NotOpenMatchError();
      }

      const matches = manager.getRepository(Match);
      const match = await matches.findOne({
        where: { booking: { id: booking.id } },
        relations: { matchPlayers: true },
      });
      if (!match) {
        throw new NotOpenMatchError();
      }

      const alreadyJoined = match.matchPlayers.some((mp) => mp.playerId === input.playerId);
      if (alreadyJoined) {
        throw new AlreadyJoinedError();
      }

      if (match.matchPlayers.length >= OPEN_MATCH_MAX_PLAYERS) {
        throw new MatchFullError();
      }

      const matchPlayers = manager.getRepository(MatchPlayer);
      await matchPlayers.save(
        matchPlayers.create({ match: { id: match.id }, player: { id: input.playerId } }),
      );

      if (match.matchPlayers.length + 1 >= OPEN_MATCH_MAX_PLAYERS) {
        match.needsPlayers = false;
        await matches.save(match);
        booking.bookingState = BookingState.RESERVED;
        await bookings.save(booking);
      }

      return booking;
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof BookingNotFoundError) {
      return { success: false, error: BOOKING_NOT_FOUND_MESSAGE };
    }
    if (error instanceof NotOpenMatchError) {
      return { success: false, error: NOT_OPEN_MATCH_MESSAGE };
    }
    if (error instanceof AlreadyJoinedError) {
      return { success: false, error: ALREADY_JOINED_MESSAGE };
    }
    if (error instanceof MatchFullError) {
      return { success: false, error: MATCH_FULL_MESSAGE };
    }
    console.error("joinOpenMatch", error);
    return { success: false, error: "No se pudo sumar al partido." };
  }
}

export async function getBookings(): Promise<ActionResult<Booking[]>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");
    const data = await bookings.find({
      relations: { player: true, court: true, match: { matchPlayers: true } },
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
      relations: { player: true, court: true, match: { matchPlayers: true } },
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

      const { playerId, courtId, isOpenMatch: _isOpenMatch, ...rest } = input;

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
