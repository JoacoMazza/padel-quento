"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { Account } from "@/src/entities/Account";
import { Booker } from "@/src/entities/Booker";
import { Player } from "@/src/entities/Player";
import { PlayerCategory } from "@/src/domain/enums";
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

const PLAYER_RELATIONS = { account: true, booker: true } as const;

/**
 * Crea al jugador junto con su cuenta (credenciales) y su booker (datos con los
 * que reserva turnos) en una misma transacción: si falla cualquiera de los
 * tres, no queda ninguno guardado.
 */
export async function createPlayer(
  input: CreatePlayerInput,
): Promise<ActionResult<Player>> {
  try {
    const dataSource = await getDataSource();
    const passwordHash = await bcrypt.hash(input.password, 12);

    const saved = await dataSource.transaction(async (manager) => {
      const accounts = manager.getRepository<Account>("Account");
      const bookers = manager.getRepository<Booker>("Booker");
      const players = manager.getRepository<Player>("Player");

      const account = await accounts.save(
        accounts.create({
          email: input.email,
          passwordHash,
          photoUrl: input.photoUrl ?? null,
        }),
      );
      const booker = await bookers.save(
        bookers.create({
          names: input.names,
          lastnames: input.lastnames,
          phoneNumber: input.phoneNumber,
        }),
      );
      return players.save(
        players.create({
          account,
          booker,
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

/** Reparte los campos a actualizar entre la cuenta, el booker y el jugador. */
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
      if (names !== undefined) player.booker.names = names;
      if (lastnames !== undefined) player.booker.lastnames = lastnames;
      if (phoneNumber !== undefined) player.booker.phoneNumber = phoneNumber;
      if (category !== undefined) player.category = category;

      player.account = await manager.getRepository<Account>("Account").save(player.account);
      player.booker = await manager.getRepository<Booker>("Booker").save(player.booker);
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
 * Elimina al jugador borrando su cuenta (players.account_id tiene ON DELETE
 * CASCADE). El booker se conserva: los turnos que reservó lo siguen referenciando.
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
      names: player.booker.names,
      lastnames: player.booker.lastnames,
      email: player.account.email,
      phoneNumber: player.booker.phoneNumber,
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
