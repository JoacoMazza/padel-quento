"use server";

import "reflect-metadata";
import { OutOfService } from "@/src/entities/OutOfService";
import { Booking } from "@/src/entities/Booking";
import { OutOfServiceReason } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";
import { cancelBookingsInRange } from "@/src/actions/booking";

export type CreateOutOfServiceInput = {
  fromDateTime: Date;
  toDateTime: Date;
  reason: OutOfServiceReason;
  description?: string | null;
  courtId: number;
};

export type UpdateOutOfServiceInput = Partial<
  Omit<CreateOutOfServiceInput, "courtId">
> & {
  courtId?: number;
};

export type OutOfServiceWithCancellations = {
  outOfService: OutOfService;
  cancelledBookings: Booking[];
};

export async function createOutOfService(
  input: CreateOutOfServiceInput,
): Promise<ActionResult<OutOfServiceWithCancellations>> {
  try {
    const dataSource = await getDataSource();

    const result = await dataSource.transaction(async (manager) => {
      const outOfServices = manager.getRepository<OutOfService>("OutOfService");

      const outOfService = outOfServices.create({
        fromDateTime: input.fromDateTime,
        toDateTime: input.toDateTime,
        reason: input.reason,
        description: input.description ?? null,
        court: { id: input.courtId },
      });

      const saved = await outOfServices.save(outOfService);

      // RF-13: al bloquearse el horario, las reservas ya hechas en ese rango se
      // cancelan automáticamente sin penalizar al jugador (la causa es ajena a él).
      const cancelledBookings = await cancelBookingsInRange(manager, {
        courtId: input.courtId,
        from: input.fromDateTime,
        to: input.toDateTime,
      });

      return { outOfService: saved, cancelledBookings };
    });

    return { success: true, data: toPlain(result) };
  } catch (error) {
    console.error("createOutOfService", error);
    return { success: false, error: "No se pudo crear el bloqueo de cancha." };
  }
}

export async function getOutOfServices(): Promise<ActionResult<OutOfService[]>> {
  try {
    const dataSource = await getDataSource();
    const outOfServices = dataSource.getRepository<OutOfService>("OutOfService");
    const data = await outOfServices.find({ relations: { court: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getOutOfServices", error);
    return { success: false, error: "No se pudieron obtener los bloqueos de cancha." };
  }
}

export async function getOutOfServiceById(
  id: number,
): Promise<ActionResult<OutOfService | null>> {
  try {
    const dataSource = await getDataSource();
    const outOfServices = dataSource.getRepository<OutOfService>("OutOfService");
    const data = await outOfServices.findOne({
      where: { id },
      relations: { court: true },
    });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getOutOfServiceById", error);
    return { success: false, error: "No se pudo obtener el bloqueo de cancha." };
  }
}

export async function updateOutOfService(
  id: number,
  input: UpdateOutOfServiceInput,
): Promise<ActionResult<OutOfServiceWithCancellations>> {
  try {
    const dataSource = await getDataSource();

    const result = await dataSource.transaction(async (manager) => {
      const outOfServices = manager.getRepository<OutOfService>("OutOfService");

      const outOfService = await outOfServices.findOne({
        where: { id },
        relations: { court: true },
      });
      if (!outOfService) {
        throw new Error("NOT_FOUND");
      }

      const { courtId, ...rest } = input;
      outOfServices.merge(outOfService, {
        ...rest,
        ...(courtId ? { court: { id: courtId } } : {}),
      });

      const saved = await outOfServices.save(outOfService);

      // Si se amplía el rango o se reasigna la cancha, también hay que cancelar
      // (sin penalizar) las reservas que pasan a quedar dentro del bloqueo.
      const cancelledBookings = saved.court?.id
        ? await cancelBookingsInRange(manager, {
            courtId: saved.court.id,
            from: saved.fromDateTime,
            to: saved.toDateTime,
          })
        : [];

      return { outOfService: saved, cancelledBookings };
    });

    return { success: true, data: toPlain(result) };
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_FOUND") {
      return { success: false, error: "El bloqueo de cancha no existe." };
    }
    console.error("updateOutOfService", error);
    return { success: false, error: "No se pudo actualizar el bloqueo de cancha." };
  }
}

export async function deleteOutOfService(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const outOfServices = dataSource.getRepository<OutOfService>("OutOfService");

    const result = await outOfServices.delete(id);
    if (!result.affected) {
      return { success: false, error: "El bloqueo de cancha no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deleteOutOfService", error);
    return { success: false, error: "No se pudo eliminar el bloqueo de cancha." };
  }
}
