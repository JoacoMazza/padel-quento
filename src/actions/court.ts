"use server";

import "reflect-metadata";
import { Court } from "@/src/entities/Court";
import { CourtState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { requireAdmin } from "@/src/lib/rbac";

export type CreateCourtInput = {
  number: number;
  state?: CourtState;
  price: number;
};

export type UpdateCourtInput = Partial<CreateCourtInput>;

const INVALID_PRICE_ERROR = "El precio de la cancha es obligatorio y debe ser mayor a 0.";

function isValidPrice(price: unknown): price is number {
  return typeof price === "number" && !isNaN(price) && price > 0;
}

export async function createCourt(
  input: CreateCourtInput,
): Promise<ActionResult<Court>> {
  if (!isValidPrice(input.price)) {
    return { success: false, error: INVALID_PRICE_ERROR };
  }

  try {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const court = courts.create({
      number: input.number,
      state: input.state ?? CourtState.AVAILABLE,
      price: input.price,
    });

    const saved = await courts.save(court);
    return { success: true, data: toPlain(saved) };
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
    return { success: true, data: toPlain(data) };
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
    return { success: true, data: toPlain(data) };
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
    await requireAdmin();
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const court = await courts.findOne({ where: { id } });
    if (!court) {
      return { success: false, error: "La cancha no existe." };
    }

    courts.merge(court, input);
    const saved = await courts.save(court);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "Ya existe una cancha con ese número." };
    }
    console.error("updateCourt", error);
    return { success: false, error: "No se pudo actualizar la cancha." };
  }
}

/**
 * Aplica el mismo precio a todas las canchas, incluidas las dadas de baja.
 * Las reservas ya hechas conservan el precio con el que se tomaron.
 * Solo accesible por administradores.
 */
export async function updateAllCourtsPrice(price: number): Promise<ActionResult<null>> {
  if (!isValidPrice(price)) {
    return { success: false, error: INVALID_PRICE_ERROR };
  }

  try {
    await requireAdmin();
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const all = await courts.find();
    await courts.save(all.map((court) => ({ ...court, price })));
    return { success: true, data: null };
  } catch (error) {
    console.error("updateAllCourtsPrice", error);
    return { success: false, error: "No se pudo actualizar el precio de las canchas." };
  }
}