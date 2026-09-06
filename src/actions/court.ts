"use server";

import "reflect-metadata";
import { Court } from "@/src/entities/Court";
import { CourtState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import type { ActionResult } from "@/src/lib/action-result";

export type CreateCourtInput = {
  number: number;
  state?: CourtState;
};

export type UpdateCourtInput = Partial<CreateCourtInput>;

export async function createCourt(
  input: CreateCourtInput,
): Promise<ActionResult<Court>> {
  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const court = courts.create({
      number: input.number,
      state: input.state ?? CourtState.AVAILABLE,
    });

    const saved = await courts.save(court);
    return { success: true, data: saved };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "Ya existe una cancha con ese número." };
    }
    console.error("createCourt", error);
    return { success: false, error: "No se pudo crear la cancha." };
  }
}

export async function getCourts(): Promise<ActionResult<Court[]>> {
  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");
    const data = await courts.find();
    return { success: true, data };
  } catch (error) {
    console.error("getCourts", error);
    return { success: false, error: "No se pudieron obtener las canchas." };
  }
}

export async function getCourtById(id: number): Promise<ActionResult<Court | null>> {
  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");
    const data = await courts.findOne({ where: { id } });
    return { success: true, data };
  } catch (error) {
    console.error("getCourtById", error);
    return { success: false, error: "No se pudo obtener la cancha." };
  }
}

export async function updateCourt(
  id: number,
  input: UpdateCourtInput,
): Promise<ActionResult<Court>> {
  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const court = await courts.findOne({ where: { id } });
    if (!court) {
      return { success: false, error: "La cancha no existe." };
    }

    courts.merge(court, input);
    const saved = await courts.save(court);
    return { success: true, data: saved };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "Ya existe una cancha con ese número." };
    }
    console.error("updateCourt", error);
    return { success: false, error: "No se pudo actualizar la cancha." };
  }
}

export async function deleteCourt(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const result = await courts.delete(id);
    if (!result.affected) {
      return { success: false, error: "La cancha no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deleteCourt", error);
    return { success: false, error: "No se pudo eliminar la cancha." };
  }
}
