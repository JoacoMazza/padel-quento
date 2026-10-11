"use server";

import "reflect-metadata";
import { Court } from "@/src/entities/Court";
import { BookingState, CourtState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { isUniqueViolation } from "@/src/lib/db-errors";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { notifyCourtUnavailable } from "@/src/lib/match-notifications";

export type CreateCourtInput = {
  number: number;
  state?: CourtState;
  price: number;
};

export type UpdateCourtInput = Partial<CreateCourtInput>;

export async function createCourt(
  input: CreateCourtInput,
): Promise<ActionResult<Court>> {
  if (
    input.price === undefined ||
    input.price === null ||
    typeof input.price !== "number" ||
    isNaN(input.price) ||
    input.price <= 0
  ) {
    return { success: false, error: "El precio de la cancha es obligatorio y debe ser mayor a 0." };
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
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    const court = await courts.findOne({ where: { id } });
    if (!court) {
      return { success: false, error: "La cancha no existe." };
    }

    const closingDown = input.state === CourtState.CLOSED_DOWN && court.state !== CourtState.CLOSED_DOWN;
    courts.merge(court, input);
    if (!closingDown) {
      const saved = await courts.save(court);
      return { success: true, data: toPlain(saved) };
    }

    // Una cancha dada de baja no se puede usar: en la misma transacción se
    // cancelan sus turnos futuros, sin penalizar a nadie, y después se avisa.
    const { saved, cancelledBookingIds } = await dataSource.transaction(async (manager) => {
      const savedCourt = await manager.getRepository<Court>("Court").save(court);
      const cancelled = await manager
        .createQueryBuilder()
        .update("Booking")
        .set({ bookingState: BookingState.CANCELLED })
        .where('"court_id" = :courtId', { courtId: id })
        .andWhere('"booking_state" != :cancelled', { cancelled: BookingState.CANCELLED })
        .andWhere('"datetime" > :now', { now: new Date() })
        .returning("id")
        .execute();
      const rows: { id: number }[] = cancelled.raw ?? [];
      return { saved: savedCourt, cancelledBookingIds: rows.map((row) => row.id) };
    });

    if (cancelledBookingIds.length > 0) {
      await notifyCourtUnavailable(cancelledBookingIds);
    }
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { success: false, error: "Ya existe una cancha con ese número." };
    }
    console.error("updateCourt", error);
    return { success: false, error: "No se pudo actualizar la cancha." };
  }
}
