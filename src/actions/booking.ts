"use server";

import "reflect-metadata";
import { EntityManager, LessThanOrEqual } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { BookingParticipant } from "@/src/entities/BookingParticipant";
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
   * a los acompañantes que trae y no tienen cuenta propia). Menos de 4 dejan el
   * turno en estado "pendiente de jugadores" para que se sumen otros.
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
const NOT_PENDING_PLAYERS_MESSAGE = "Este turno no es un partido abierto pendiente de jugadores.";
const INVALID_PLAYERS_TO_CLOSE_MESSAGE = `El cierre manual solo está disponible con entre 1 y ${OPEN_MATCH_MAX_PLAYERS - 1} jugadores confirmados.`;
const OPEN_MATCH_TOO_SOON_MESSAGE = `No se puede crear un partido abierto con menos de ${OPEN_MATCH_MIN_HOURS_BEFORE_START} horas de anticipación.`;
const CANCEL_EXPIRED_OPEN_MATCHES_ERROR_MESSAGE = "No se pudieron cancelar los partidos abiertos vencidos.";

class DoubleBookingError extends Error {}
class InvalidGroupSizeError extends Error {}
class NotPendingPlayersError extends Error {}
class InvalidPlayersToCloseError extends Error {}
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
      const bookingState =
        input.bookingState ??
        (groupSize < OPEN_MATCH_MAX_PLAYERS ? BookingState.PENDING_PLAYERS : BookingState.RESERVED);

      if (bookingState === BookingState.PENDING_PLAYERS) {
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

      // En un partido abierto, quien lo crea queda registrado como el primer participante confirmado.
      if (bookingState === BookingState.PENDING_PLAYERS) {
        const participants = manager.getRepository(BookingParticipant);
        await participants.save(
          participants.create({
            booking: { id: saved.id },
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
    const data = await bookings.find({ relations: { player: true, court: true, participants: true } });
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
      relations: { player: true, court: true, participants: true },
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

/**
 * Cierre manual de la convocatoria de un partido abierto: quien lo creó ya
 * consiguió al resto de los jugadores por fuera de la app y asegura la cancha
 * pasando el turno a "Reservada". Solo aplica con 1, 2 o 3 jugadores confirmados;
 * con el cupo completo el turno ya pasa a "Reservada" al sumarse el último jugador.
 */
export async function closeOpenMatch(id: number): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      const bookings = manager.getRepository(Booking);
      const booking = await bookings.findOne({
        where: { id },
        relations: { participants: true },
      });
      if (!booking) {
        throw new Error("NOT_FOUND");
      }
      if (booking.bookingState !== BookingState.PENDING_PLAYERS) {
        throw new NotPendingPlayersError();
      }

      const confirmedPlayers = (booking.participants ?? []).reduce(
        (sum, p) => sum + (p.playersCount ?? 1),
        0,
      );
      if (confirmedPlayers < 1 || confirmedPlayers >= OPEN_MATCH_MAX_PLAYERS) {
        throw new InvalidPlayersToCloseError();
      }

      booking.bookingState = BookingState.RESERVED;
      return bookings.save(booking);
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof NotPendingPlayersError) {
      return { success: false, error: NOT_PENDING_PLAYERS_MESSAGE };
    }
    if (error instanceof InvalidPlayersToCloseError) {
      return { success: false, error: INVALID_PLAYERS_TO_CLOSE_MESSAGE };
    }
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "La reserva no existe." };
    }
    console.error("closeOpenMatch", error);
    return { success: false, error: "No se pudo cerrar el partido." };
  }
}

/**
 * Cancelación automática de partidos abiertos que no llegaron a completar el
 * cupo a horas de su inicio: pensada para correr periódicamente desde un
 * proceso en segundo plano (ver src/jobs/open-match-expiration.ts). Los que ya
 * fueron cerrados manualmente quedaron en RESERVED y no los toca esta consulta.
 */
export async function cancelExpiredOpenMatches(): Promise<ActionResult<number>> {
  try {
    const dataSource = await getDataSource();
    const bookings = dataSource.getRepository<Booking>("Booking");

    const threshold = new Date(Date.now() + OPEN_MATCH_MIN_HOURS_BEFORE_START * 60 * 60_000);
    const expiring = await bookings.find({
      where: {
        bookingState: BookingState.PENDING_PLAYERS,
        fromDateTime: LessThanOrEqual(threshold),
      },
      relations: { participants: true },
    });

    const toCancel = expiring.filter(
      (booking) =>
        (booking.participants ?? []).reduce((sum, p) => sum + (p.playersCount ?? 1), 0) <
        OPEN_MATCH_MAX_PLAYERS,
    );

    for (const booking of toCancel) {
      booking.bookingState = BookingState.CANCELLED;
    }
    if (toCancel.length > 0) {
      await bookings.save(toCancel);
    }

    return { success: true, data: toCancel.length };
  } catch (error) {
    console.error("cancelExpiredOpenMatches", error);
    return { success: false, error: CANCEL_EXPIRED_OPEN_MATCHES_ERROR_MESSAGE };
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
