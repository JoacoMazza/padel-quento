"use server";

import "reflect-metadata";
import { OutOfService } from "@/src/entities/OutOfService";
import { OutOfServiceReason } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

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

export async function createOutOfService(
  input: CreateOutOfServiceInput,
): Promise<ActionResult<OutOfService>> {
  try {
    const dataSource = await getDataSource();
    const outOfServices = dataSource.getRepository<OutOfService>("OutOfService");

    const outOfService = outOfServices.create({
      fromDateTime: input.fromDateTime,
      toDateTime: input.toDateTime,
      reason: input.reason,
      description: input.description ?? null,
      court: { id: input.courtId },
    });

    const saved = await outOfServices.save(outOfService);
    return { success: true, data: toPlain(saved) };
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
): Promise<ActionResult<OutOfService>> {
  try {
    const dataSource = await getDataSource();
    const outOfServices = dataSource.getRepository<OutOfService>("OutOfService");

    const outOfService = await outOfServices.findOne({ where: { id } });
    if (!outOfService) {
      return { success: false, error: "El bloqueo de cancha no existe." };
    }

    const { courtId, ...rest } = input;
    outOfServices.merge(outOfService, {
      ...rest,
      ...(courtId ? { court: { id: courtId } } : {}),
    });

    const saved = await outOfServices.save(outOfService);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
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
