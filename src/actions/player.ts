"use server";

import "reflect-metadata";
import bcrypt from "bcrypt";
import { Player } from "@/src/entities/Player";
import { PlayerCategory, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import type { ActionResult } from "@/src/lib/action-result";

export type CreatePlayerInput = {
  email: string;
  password: string;
  names: string;
  lastnames: string;
  dni?: number | null;
  phoneNumber?: string | null;
  photoUrl?: string | null;
  category?: PlayerCategory;
};

export type UpdatePlayerInput = Partial<
  Omit<CreatePlayerInput, "email" | "password">
> & {
  email?: string;
  password?: string;
};

export async function createPlayer(
  input: CreatePlayerInput,
): Promise<ActionResult<Player>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const passwordHash = await bcrypt.hash(input.password, 12);

    const player = players.create({
      email: input.email,
      passwordHash,
      names: input.names,
      lastnames: input.lastnames,
      dni: input.dni ?? null,
      phoneNumber: input.phoneNumber ?? null,
      photoUrl: input.photoUrl ?? null,
      role: Role.PLAYER,
      category: input.category ?? PlayerCategory.WITHOUT_CATEGORY,
      scoring: 0,
    });

    const saved = await players.save(player);
    return { success: true, data: saved };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "El correo ya está en uso." };
    }
    console.error("createPlayer", error);
    return { success: false, error: "No se pudo crear el jugador." };
  }
}

export async function getPlayers(): Promise<ActionResult<Player[]>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");
    const data = await players.find();
    return { success: true, data };
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
    const data = await players.findOne({ where: { id } });
    return { success: true, data };
  } catch (error) {
    console.error("getPlayerById", error);
    return { success: false, error: "No se pudo obtener el jugador." };
  }
}

export async function updatePlayer(
  id: number,
  input: UpdatePlayerInput,
): Promise<ActionResult<Player>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const player = await players.findOne({ where: { id } });
    if (!player) {
      return { success: false, error: "El jugador no existe." };
    }

    const { password, ...rest } = input;
    players.merge(player, rest);
    if (password) {
      player.passwordHash = await bcrypt.hash(password, 12);
    }

    const saved = await players.save(player);
    return { success: true, data: saved };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "El correo ya está en uso." };
    }
    console.error("updatePlayer", error);
    return { success: false, error: "No se pudo actualizar el jugador." };
  }
}

export async function deletePlayer(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const players = dataSource.getRepository<Player>("Player");

    const result = await players.delete(id);
    if (!result.affected) {
      return { success: false, error: "El jugador no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deletePlayer", error);
    return { success: false, error: "No se pudo eliminar el jugador." };
  }
}
