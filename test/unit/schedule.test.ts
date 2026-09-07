import { beforeEach, describe, expect, it, vi } from "vitest";
import { DayOfWeek } from "@/src/domain/enums";

const { create, save, find, findOne, merge, deleteFn, getDataSource } = vi.hoisted(() => {
  const create = vi.fn((data: unknown) => data);
  const save = vi.fn(async (entity: unknown) => entity);
  const find = vi.fn();
  const findOne = vi.fn();
  const merge = vi.fn((entity: any, dto: any) => Object.assign(entity, dto));
  const deleteFn = vi.fn();
  const getRepository = vi.fn(() => ({ create, save, find, findOne, merge, delete: deleteFn }));
  const getDataSource = vi.fn(async () => ({ getRepository }));
  return { create, save, find, findOne, merge, deleteFn, getDataSource };
});

vi.mock("@/src/lib/db", () => ({ getDataSource }));

import {
  createSchedule,
  getSchedules,
  getScheduleById,
  updateSchedule,
  deleteSchedule,
} from "@/src/actions/schedule";

const openingTime = new Date("1970-01-01T09:00:00Z");
const closingTime = new Date("1970-01-01T23:00:00Z");

describe("schedule actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    create.mockImplementation((data: unknown) => data);
    merge.mockImplementation((entity: any, dto: any) => Object.assign(entity, dto));
  });

  describe("createSchedule", () => {
    it("crea un horario asociado a la cancha indicada", async () => {
      const result = await createSchedule({
        dayOfWeek: DayOfWeek.MONDAY,
        openingTime,
        closingTime,
        courtId: 1,
      });

      expect(create).toHaveBeenCalledWith({
        dayOfWeek: DayOfWeek.MONDAY,
        openingTime,
        closingTime,
        court: { id: 1 },
      });
      expect(result).toEqual({
        success: true,
        data: { dayOfWeek: DayOfWeek.MONDAY, openingTime, closingTime, court: { id: 1 } },
      });
    });

    it("devuelve un error genérico si falla el guardado", async () => {
      save.mockRejectedValueOnce(new Error("boom"));

      const result = await createSchedule({
        dayOfWeek: DayOfWeek.TUESDAY,
        openingTime,
        closingTime,
        courtId: 1,
      });

      expect(result).toEqual({ success: false, error: "No se pudo crear el horario." });
    });
  });

  describe("getSchedules", () => {
    it("devuelve todos los horarios con su cancha", async () => {
      find.mockResolvedValueOnce([{ id: 1, court: { id: 1 } }]);

      const result = await getSchedules();

      expect(find).toHaveBeenCalledWith({ relations: { court: true } });
      expect(result).toEqual({ success: true, data: [{ id: 1, court: { id: 1 } }] });
    });

    it("devuelve un error si falla la consulta", async () => {
      find.mockRejectedValueOnce(new Error("db down"));

      const result = await getSchedules();

      expect(result).toEqual({ success: false, error: "No se pudieron obtener los horarios." });
    });
  });

  describe("getScheduleById", () => {
    it("devuelve el horario encontrado", async () => {
      findOne.mockResolvedValueOnce({ id: 1 });

      const result = await getScheduleById(1);

      expect(findOne).toHaveBeenCalledWith({ where: { id: 1 }, relations: { court: true } });
      expect(result).toEqual({ success: true, data: { id: 1 } });
    });

    it("devuelve data null cuando no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await getScheduleById(999);

      expect(result).toEqual({ success: true, data: null });
    });
  });

  describe("updateSchedule", () => {
    it("actualiza los campos escalares provistos", async () => {
      findOne.mockResolvedValueOnce({ id: 1, dayOfWeek: DayOfWeek.MONDAY });

      const result = await updateSchedule(1, { dayOfWeek: DayOfWeek.FRIDAY });

      expect(result).toEqual({ success: true, data: { id: 1, dayOfWeek: DayOfWeek.FRIDAY } });
    });

    it("reasigna la cancha cuando se provee courtId", async () => {
      findOne.mockResolvedValueOnce({ id: 1, court: { id: 1 } });

      const result = await updateSchedule(1, { courtId: 2 });

      expect(result).toEqual({ success: true, data: { id: 1, court: { id: 2 } } });
    });

    it("devuelve error si el horario no existe", async () => {
      findOne.mockResolvedValueOnce(null);

      const result = await updateSchedule(999, { dayOfWeek: DayOfWeek.SUNDAY });

      expect(result).toEqual({ success: false, error: "El horario no existe." });
      expect(save).not.toHaveBeenCalled();
    });
  });

  describe("deleteSchedule", () => {
    it("elimina el horario", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 1 });

      const result = await deleteSchedule(1);

      expect(result).toEqual({ success: true, data: null });
    });

    it("devuelve error si el horario no existe", async () => {
      deleteFn.mockResolvedValueOnce({ affected: 0 });

      const result = await deleteSchedule(999);

      expect(result).toEqual({ success: false, error: "El horario no existe." });
    });
  });
});
