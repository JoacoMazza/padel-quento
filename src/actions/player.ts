"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { Account } from "@/src/entities/Account";
import { Player } from "@/src/entities/Player";
import { Booking } from "@/src/entities/Booking";
import { MatchPlayer } from "@/src/entities/MatchPlayer";
import { Penalty } from "@/src/entities/Penalty";
import { BookingState, PlayerCategory } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { duplicateAccountMessage, isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";

export type CreatePlayerInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  phoneNumber: string;
  photoUrl?: string | null;
  category?: PlayerCategory;
};

export type UpdatePlayerInput = Partial<Omit<CreatePlayerInput, "password">> & {
  password?: string;
};

const PLAYER_RELATIONS = { account: true } as const;

/**
 * Crea al jugador (un Booker con cuenta) junto con su cuenta en una misma
 * transacción: si falla cualquiera de los dos, no queda ninguno guardado.
 */
export async function createPlayer(
  input: CreatePlayerInput,
): Promise<ActionResult<Player>> {
  try {
    const dataSource = await getDataSource();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const saved = await dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository<Account>("Account");
      const players = manager.getRepository<Player>("Player");

      const account = await accounts.save(
        accounts.create({
          email: input.email,
          passwordHash,
          photoUrl: input.photoUrl ?? null,
        }),
      );
      return players.save(
        players.create({
          account,
          names: input.names,
          lastnames: input.lastnames,
          phoneNumber: input.phoneNumber,
          category: input.category ?? PlayerCategory.WITHOUT_CATEGORY,
          scoring: 0,
        }),
      );
    });

    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: duplicateAccountMessage(error) };
    }
    console.error("createPlayer", error);
    return { success: false, error: "No se pudo crear el jugador." };
  }
}

export async function getPlayers(): Promise<ActionResult<Player[]>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const data = await players.find({ relations: PLAYER_RELATIONS });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getPlayers", error);
    return { success: false, error: "No se pudieron obtener los jugadores." };
  }
}

export async function getPlayerById(
  id: number,
): Promise<ActionResult<Player | null>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const data = await players.findOne({ where: { id }, relations: PLAYER_RELATIONS });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getPlayerById", error);
    return { success: false, error: "No se pudo obtener el jugador." };
  }
}

/** Reparte los campos a actualizar entre la cuenta y el jugador. */
export async function updatePlayer(
  id: number,
  input: UpdatePlayerInput,
): Promise<ActionResult<Player>> {
  try {
    const dataSource = await getDataSource();

    const saved = await dataSource.transaction(async (manager) => {
      const players = manager.getRepository<Player>("Player");
      const player = await players.findOne({ where: { id }, relations: PLAYER_RELATIONS });
      if (!player) {
        return null;
      }

      const { email, password, photoUrl, names, lastnames, phoneNumber, category } = input;

      if (email !== undefined) player.account.email = email;
      if (photoUrl !== undefined) player.account.photoUrl = photoUrl;
      if (password) player.account.passwordHash = await bcrypt.hash(password, 12);
      if (names !== undefined) player.names = names;
      if (lastnames !== undefined) player.lastnames = lastnames;
      if (phoneNumber !== undefined) player.phoneNumber = phoneNumber;
      if (category !== undefined) player.category = category;

      player.account = await manager.getRepository<Account>("Account").save(player.account);
      return players.save(player);
    });

    if (!saved) {
      return { success: false, error: "El jugador no existe." };
    }
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: duplicateAccountMessage(error) };
    }
    console.error("updatePlayer", error);
    return { success: false, error: "No se pudo actualizar el jugador." };
  }
}

/**
 * Elimina al jugador borrando su cuenta (bookers.account_id tiene ON DELETE
 * CASCADE). Si el jugador tiene turnos, la FK de bookings impide borrarlo.
 */
export async function deletePlayer(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const player = await players.findOne({ where: { id }, relations: { account: true } });
    if (!player) {
      return { success: false, error: "El jugador no existe." };
    }

    await dataSource.getRepository<Account>("Account").delete(player.account.id);
    return { success: true, data: null };
  } catch (error) {
    console.error("deletePlayer", error);
    return { success: false, error: "No se pudo eliminar el jugador." };
  }
}

// ─── Administración ────────────────────────────────────────────────────────────

export type PlayerAdminItem = {
  id: number;
  names: string;
  lastnames: string;
  email: string;
  phoneNumber: string;
  category: PlayerCategory;
  scoring: number;
  isBlocked: boolean;
};

/** Lista todos los jugadores. Solo accesible por administradores. */
export async function getPlayersAdmin(): Promise<ActionResult<PlayerAdminItem[]>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const found = await players.find({ relations: PLAYER_RELATIONS });
    // Solo los campos que muestra el panel: nunca el hash de la contraseña.
    const data: PlayerAdminItem[] = found.map((player) => ({
      id: player.id,
      names: player.names,
      lastnames: player.lastnames,
      email: player.account.email,
      phoneNumber: player.phoneNumber,
      category: player.category,
      scoring: player.scoring,
      isBlocked: player.account.isBlocked,
    }));
    return { success: true, data };
  } catch (error) {
    console.error("getPlayersAdmin", error);
    return { success: false, error: "No se pudieron obtener los jugadores." };
  }
}

export type PlayerRecordBooking = {
  id: number;
  fromDateTime: string;
  durationMinutes: number;
  courtNumber: number | null;
  bookingState: BookingState;
  isOpenMatch: boolean;
  attended: boolean;
};

export type PlayerRecordAdmin = PlayerAdminItem & {
  noShows: number;
  bookings: PlayerRecordBooking[];
  movements: Array<{ id: number; amount: number; description: string; createdAt: string }>;
};

function toRecordBooking(booking: Booking, isOpenMatch: boolean, attended: boolean): PlayerRecordBooking {
  return {
    id: booking.id,
    fromDateTime: new Date(booking.fromDateTime).toISOString(),
    durationMinutes: booking.durationMinutes,
    courtNumber: booking.court?.number ?? null,
    bookingState: booking.bookingState,
    isOpenMatch,
    attended,
  };
}

/**
 * Ficha del jugador para el panel de administración: los turnos que reservó y
 * los partidos abiertos en los que participa (con su asistencia), la cantidad
 * de inasistencias y su historial de puntos. Solo accesible por administradores.
 */
export async function getPlayerRecordAdmin(id: number): Promise<ActionResult<PlayerRecordAdmin>> {
  try {
    await requireAdmin();
    const dataSource = await getDataSource();

    const player = await dataSource
      .getRepository<Player>("Player")
      .findOne({ where: { id }, relations: PLAYER_RELATIONS });
    if (!player) {
      return { success: false, error: "El jugador no existe." };
    }

    const ownBookings = await dataSource.getRepository<Booking>("Booking").find({
      where: { booker: { id } },
      relations: { court: true, match: true },
    });
    const participations = await dataSource.getRepository<MatchPlayer>("MatchPlayer").find({
      where: { player: { id } },
      relations: { match: { booking: { court: true } } },
    });
    const penalties = await dataSource.getRepository<Penalty>("Penalty").find({
      where: { player: { id } },
      order: { createdAt: "DESC" },
    });

    // En un partido abierto la asistencia es la del jugador dentro del partido
    // (MatchPlayer.attended), incluso si fue quien lo creó.
    const recordBookings = new Map<number, PlayerRecordBooking>();
    for (const participation of participations) {
      const booking = participation.match.booking;
      recordBookings.set(booking.id, toRecordBooking(booking, true, participation.attended));
    }
    for (const booking of ownBookings) {
      if (!recordBookings.has(booking.id)) {
        recordBookings.set(booking.id, toRecordBooking(booking, Boolean(booking.match), booking.attended));
      }
    }
    const bookings = [...recordBookings.values()].sort((a, b) => b.fromDateTime.localeCompare(a.fromDateTime));

    return {
      success: true,
      data: {
        id: player.id,
        names: player.names,
        lastnames: player.lastnames,
        email: player.account.email,
        phoneNumber: player.phoneNumber,
        category: player.category,
        scoring: player.scoring,
        isBlocked: player.account.isBlocked,
        noShows: bookings.filter((b) => !b.attended && b.bookingState !== BookingState.CANCELLED).length,
        bookings,
        movements: penalties.map((p) => ({
          id: p.id,
          amount: Number(p.penalizedScoring),
          description: p.reason,
          createdAt: new Date(p.createdAt).toISOString(),
        })),
      },
    };
  } catch (error) {
    console.error("getPlayerRecordAdmin", error);
    return { success: false, error: "No se pudo obtener la ficha del jugador." };
  }
}

async function setPlayerBlocked(id: number, isBlocked: boolean): Promise<boolean> {
  const dataSource = await getDataSource();
  const players = dataSource.getRepository<Player>("Player");
  const player = await players.findOne({ where: { id }, relations: { account: true } });
  if (!player) {
    return false;
  }
  await dataSource.getRepository<Account>("Account").update(player.account.id, { isBlocked });
  return true;
}

/** Bloquea la cuenta de un jugador. Solo accesible por administradores. */
export async function blockPlayer(id: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    if (!(await setPlayerBlocked(id, true))) {
      return { success: false, error: "El jugador no existe." };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error("blockPlayer", error);
    return { success: false, error: "No se pudo bloquear el jugador." };
  }
}

/** Desbloquea la cuenta de un jugador. Solo accesible por administradores. */
export async function unblockPlayer(id: number): Promise<ActionResult<null>> {
  try {
    await requireAdmin();
    if (!(await setPlayerBlocked(id, false))) {
      return { success: false, error: "El jugador no existe." };
    }
    return { success: true, data: null };
  } catch (error) {
    console.error("unblockPlayer", error);
    return { success: false, error: "No se pudo desbloquear el jugador." };
  }
}
