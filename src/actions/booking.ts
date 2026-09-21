"use server";

import "reflect-metadata";
import { EntityManager } from "typeorm";
import { Booking } from "@/src/entities/Booking";
import { Chat } from "@/src/entities/Chat";
import { Court } from "@/src/entities/Court";
import { Match } from "@/src/entities/Match";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { Player } from "@/src/entities/Player";
import { BookingState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS, OPEN_MATCH_MIN_HOURS_BEFORE_START } from "@/src/domain/constants";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateBookingInput = {
  fromDateTime: Date;
  durationMinutes?: number;
  bookingState?: BookingState;
  price?: number;
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

export type JoinOpenMatchInput = {
  bookingId: number;
  playerId: number;
  /**
   * Cantidad de jugadores con la que se suma (1 a los lugares libres, contando
   * a los acompañantes que trae y no tienen cuenta propia). Por defecto 1.
   */
  groupSize?: number;
};

const DOUBLE_BOOKING_MESSAGE = "Ese horario ya está reservado para esta cancha.";
const INVALID_GROUP_SIZE_MESSAGE = `La cantidad de jugadores debe ser entre 1 y ${OPEN_MATCH_MAX_PLAYERS}.`;
const OPEN_MATCH_TOO_SOON_MESSAGE = `No se puede crear un partido abierto con menos de ${OPEN_MATCH_MIN_HOURS_BEFORE_START} horas de anticipación.`;
const BOOKING_NOT_FOUND_MESSAGE = "El turno no existe.";
const NOT_OPEN_MATCH_MESSAGE = "Este turno no es un partido abierto.";
const ALREADY_JOINED_MESSAGE = "Ya estás anotado en este partido.";
const MATCH_FULL_MESSAGE = "El partido ya está completo, no quedan lugares libres.";
const BLOCKED_PLAYER_MESSAGE = "El usuario se encuentra bloqueado y no puede realizar reservas.";
const invalidJoinGroupSizeMessage = (remainingSpots: number) =>
  `Elegí entre 1 y ${remainingSpots} jugador${remainingSpots === 1 ? "" : "es"} (los lugares libres que quedan).`;

// Namespace distinto (forma de dos claves) al lock por cancha de createBooking/updateBooking,
// para que un bookingId nunca contienda con un courtId que tenga el mismo número.
const JOIN_MATCH_LOCK_CLASS = 42;

class DoubleBookingError extends Error {}
class InvalidGroupSizeError extends Error {}
class OpenMatchTooSoonError extends Error {}
class BookingNotFoundError extends Error {}
class NotOpenMatchError extends Error {}
class AlreadyJoinedError extends Error {}
class MatchFullError extends Error {}
class BlockedPlayerError extends Error {}
class InvalidJoinGroupSizeError extends Error {
  constructor(public remainingSpots: number) {
    super();
  }
}

/**
 * Un turno ocupa la cancha salvo que esté cancelado; por eso alcanza con excluir
 * bookingState = CANCELLED al buscar solapamientos, sin importar el resto de los estados.
 */
async function hasOverlappingBooking(
  manager: EntityManager,
  params: { courtId: number; start: Date; durationMinutes: number; excludeBookingId?: number },
): Promise<boolean> {
  const qb = manager
    // Entity by name, not by class: avoids EntityMetadataNotFoundError when
    // Next's dev server hot-reloads this module and the cached DataSource
    // (globalThis, see src/lib/db.ts) ends up holding a stale class identity.
    .createQueryBuilder<Booking>("Booking", "booking")
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
      const players = manager.getRepository<Player>("Player");
      const player = await players.findOne({ where: { id: input.playerId } });
      if (player?.isBlocked) {
        throw new BlockedPlayerError();
      }

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

      const courts = manager.getRepository<Court>("Court");
      const court = await courts.findOne({ where: { id: input.courtId } });
      const price = input.price ?? court?.price;
      if (price === undefined || price === null || typeof price !== "number" || isNaN(price) || price <= 0) {
        throw new Error("El precio de la reserva es obligatorio y debe ser mayor a 0.");
      }

      const bookings = manager.getRepository<Booking>("Booking");
      const booking = bookings.create({
        fromDateTime: input.fromDateTime,
        durationMinutes,
        bookingState,
        price,
        player: { id: input.playerId },
        court: { id: input.courtId },
      });

      const saved = await bookings.save(booking);

      // Partido abierto: el turno queda reservado y, además, se crea el partido
      // asociado con quien lo creó como primer jugador confirmado.
      if (isOpenMatch) {
        const matches = manager.getRepository<Match>("Match");
        const match = await matches.save(
          matches.create({ booking: { id: saved.id }, needPlayers: true }),
        );

        const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
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
    if (error instanceof BlockedPlayerError) {
      return { success: false, error: BLOCKED_PLAYER_MESSAGE };
    }
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

/**
 * Suma a un jugador a un partido abierto (Match.needPlayers = true) hasta
 * completar el cupo máximo de OPEN_MATCH_MAX_PLAYERS jugadores. El jugador
 * puede sumarse con acompañantes sin cuenta propia indicando groupSize
 * (limitado a los lugares libres). Si con esta suma se completa el cupo, el
 * partido deja de necesitar jugadores (el turno ya estaba reservado desde su
 * creación, así que su estado no cambia acá).
 */
export async function joinOpenMatch(
  input: JoinOpenMatchInput,
): Promise<ActionResult<Booking>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      const players = manager.getRepository<Player>("Player");
      const player = await players.findOne({ where: { id: input.playerId } });
      if (player?.isBlocked) {
        throw new BlockedPlayerError();
      }

      // Serializa los intentos de sumarse al mismo partido para no pasarse del cupo máximo.
      await manager.query("SELECT pg_advisory_xact_lock($1, $2)", [
        JOIN_MATCH_LOCK_CLASS,
        input.bookingId,
      ]);

      const bookings = manager.getRepository<Booking>("Booking");
      const booking = await bookings.findOne({ where: { id: input.bookingId } });
      if (!booking) {
        throw new BookingNotFoundError();
      }

      const matches = manager.getRepository<Match>("Match");
      const match = await matches.findOne({
        where: { booking: { id: booking.id } },
        relations: { matchPlayers: true },
      });
      if (!match || !match.needPlayers) {
        throw new NotOpenMatchError();
      }

      const alreadyJoined = match.matchPlayers.some((mp) => mp.playerId === input.playerId);
      if (alreadyJoined) {
        throw new AlreadyJoinedError();
      }

      const confirmedPlayers = match.matchPlayers.reduce(
        (sum, mp) => sum + (mp.playersCount ?? 1),
        0,
      );
      const remainingSpots = OPEN_MATCH_MAX_PLAYERS - confirmedPlayers;
      if (remainingSpots <= 0) {
        throw new MatchFullError();
      }

      const groupSize = input.groupSize ?? 1;
      if (groupSize < 1 || groupSize > remainingSpots) {
        throw new InvalidJoinGroupSizeError(remainingSpots);
      }

      const matchPlayers = manager.getRepository<MatchPlayer>("MatchPlayer");
      await matchPlayers.save(
        matchPlayers.create({
          match: { id: match.id },
          player: { id: input.playerId },
          playersCount: groupSize,
        }),
      );

      // La sala de chat temporal se crea la primera vez que se suma un segundo
      // jugador con cuenta propia: antes de esto (match.matchPlayers.length === 1,
      // solo quien creó el partido) no habría con quién hablar. match.matchPlayers
      // todavía no incluye la fila recién insertada arriba, así que el chequeo se
      // hace contra la cantidad previa a esta suma.
      if (match.matchPlayers.length === 1) {
        const chats = manager.getRepository<Chat>("Chat");
        await chats.save(chats.create({ match: { id: match.id } }));
      }

      if (confirmedPlayers + groupSize >= OPEN_MATCH_MAX_PLAYERS) {
        // Update() en vez de save(match): el match tiene precargado el array
        // matchPlayers de ANTES de insertar la fila de arriba, así que guardar
        // el objeto completo haría que TypeORM borre esa fila recién creada
        // por no figurar en ese array. update() solo toca la columna indicada.
        await matches.update(match.id, { needPlayers: false });
      }

      return booking;
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (error instanceof BlockedPlayerError) {
      return { success: false, error: BLOCKED_PLAYER_MESSAGE };
    }
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
    if (error instanceof InvalidJoinGroupSizeError) {
      return { success: false, error: invalidJoinGroupSizeMessage(error.remainingSpots) };
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
      relations: { player: true, court: true, match: { matchPlayers: true, chat: true } },
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
      relations: { player: true, court: true, match: { matchPlayers: true, chat: true } },
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
      const bookings = manager.getRepository<Booking>("Booking");
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
