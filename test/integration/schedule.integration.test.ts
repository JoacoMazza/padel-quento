import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "@/src/actions/schedule";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

const openingTime = new Date("1970-01-01T09:00:00Z");
const closingTime = new Date("1970-01-01T23:00:00Z");

describe("schedule actions (integración con Postgres real)", () => {
  let courtId: number;

  beforeAll(async () => {
    const court = await createCourt({ number: uniqueCourtNumber() });
    if (!court.success) throw new Error("no se pudo crear la cancha de prueba");
    courtId = court.data.id;
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("crea un horario asociado a la cancha y lo persiste", async () => {
    const result = await createSchedule({
      dayOfWeek: DayOfWeek.MONDAY,
      openingTime,
      closingTime,
      courtId,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.dayOfWeek).toBe(DayOfWeek.MONDAY);
    expect(result.data.id).toBeDefined();
  });

  it("lista los horarios con la cancha asociada cargada", async () => {
    await createSchedule({ dayOfWeek: DayOfWeek.TUESDAY, openingTime, closingTime, courtId });

    const result = await getSchedules();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const created = result.data.find((s) => s.dayOfWeek === DayOfWeek.TUESDAY && s.court?.id === courtId);
    expect(created?.court).toMatchObject({ id: courtId });
  });

  it("obtiene un horario por id y null si no existe", async () => {
    const created = await createSchedule({
      dayOfWeek: DayOfWeek.WEDNESDAY,
      openingTime,
      closingTime,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const found = await getScheduleById(created.data.id);
    expect(found.success).toBe(true);
    if (!found.success) throw new Error("expected success");
    expect(found.data?.dayOfWeek).toBe(DayOfWeek.WEDNESDAY);

    const notFound = await getScheduleById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el día de un horario existente", async () => {
    const created = await createSchedule({
      dayOfWeek: DayOfWeek.THURSDAY,
      openingTime,
      closingTime,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateSchedule(created.data.id, { dayOfWeek: DayOfWeek.FRIDAY });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ dayOfWeek: DayOfWeek.FRIDAY }),
    });
  });

  it("devuelve error al actualizar un horario inexistente", async () => {
    const result = await updateSchedule(999_999_999, { dayOfWeek: DayOfWeek.SATURDAY });

    expect(result).toEqual({ success: false, error: "El horario no existe." });
  });

  it("elimina un horario existente y falla al eliminarlo de nuevo", async () => {
    const created = await createSchedule({
      dayOfWeek: DayOfWeek.SUNDAY,
      openingTime,
      closingTime,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await deleteSchedule(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteSchedule(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El horario no existe." });
  });
});
