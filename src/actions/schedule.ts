"use server";

import "reflect-metadata";
import { Schedule } from "@/src/entities/Schedule";
import { DayOfWeek } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { toPlain, type ActionResult } from "@/src/lib/action-result";

export type CreateScheduleInput = {
  dayOfWeek: DayOfWeek;
  openingTime: Date;
  closingTime: Date;
  courtId: number;
};

export type UpdateScheduleInput = Partial<
  Omit<CreateScheduleInput, "courtId">
> & {
  courtId?: number;
};

export async function createSchedule(
  input: CreateScheduleInput,
): Promise<ActionResult<Schedule>> {
  try {
    const dataSource = await getDataSource();
    const schedules = dataSource.getRepository<Schedule>("Schedule");

    const schedule = schedules.create({
      dayOfWeek: input.dayOfWeek,
      openingTime: input.openingTime,
      closingTime: input.closingTime,
      court: { id: input.courtId },
    });

    const saved = await schedules.save(schedule);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    console.error("createSchedule", error);
    return { success: false, error: "No se pudo crear el horario." };
  }
}

export async function getSchedules(): Promise<ActionResult<Schedule[]>> {
  try {
    const dataSource = await getDataSource();
    const schedules = dataSource.getRepository<Schedule>("Schedule");
    const data = await schedules.find({ relations: { court: true } });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getSchedules", error);
    return { success: false, error: "No se pudieron obtener los horarios." };
  }
}

export async function getScheduleById(
  id: number,
): Promise<ActionResult<Schedule | null>> {
  try {
    const dataSource = await getDataSource();
    const schedules = dataSource.getRepository<Schedule>("Schedule");
    const data = await schedules.findOne({
      where: { id },
      relations: { court: true },
    });
    return { success: true, data: toPlain(data) };
  } catch (error) {
    console.error("getScheduleById", error);
    return { success: false, error: "No se pudo obtener el horario." };
  }
}

export async function updateSchedule(
  id: number,
  input: UpdateScheduleInput,
): Promise<ActionResult<Schedule>> {
  try {
    const dataSource = await getDataSource();
    const schedules = dataSource.getRepository<Schedule>("Schedule");

    const schedule = await schedules.findOne({ where: { id } });
    if (!schedule) {
      return { success: false, error: "El horario no existe." };
    }

    const { courtId, ...rest } = input;
    schedules.merge(schedule, {
      ...rest,
      ...(courtId ? { court: { id: courtId } } : {}),
    });

    const saved = await schedules.save(schedule);
    return { success: true, data: toPlain(saved) };
  } catch (error) {
    console.error("updateSchedule", error);
    return { success: false, error: "No se pudo actualizar el horario." };
  }
}

export async function deleteSchedule(id: number): Promise<ActionResult<null>> {
  try {
    const dataSource = await getDataSource();
    const schedules = dataSource.getRepository<Schedule>("Schedule");

    const result = await schedules.delete(id);
    if (!result.affected) {
      return { success: false, error: "El horario no existe." };
    }

    return { success: true, data: null };
  } catch (error) {
    console.error("deleteSchedule", error);
    return { success: false, error: "No se pudo eliminar el horario." };
  }
}
