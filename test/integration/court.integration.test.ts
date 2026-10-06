import { afterAll, describe, expect, it } from "vitest";
import { CourtState } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import {
  createCourt,
  getCourts,
  getCourtById,
  updateCourt,
} from "@/src/actions/court";
import { uniqueCourtNumber } from "./helpers";

describe("court actions (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("genera números de cancha distintos en llamadas consecutivas", () => {
    const numbers = Array.from({ length: 1000 }, () => uniqueCourtNumber());

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("crea una cancha con el estado AVAILABLE por defecto y la persiste", async () => {
    const number = uniqueCourtNumber();

    const result = await createCourt({ number, price: 10000 });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ number, state: CourtState.AVAILABLE, price: 10000 });
    expect(result.data.id).toBeDefined();
  });

  it("no permite crear dos canchas con el mismo número", async () => {
    const number = uniqueCourtNumber();
    await createCourt({ number, price: 10000 });

    const result = await createCourt({ number, price: 10000 });

    expect(result).toEqual({ success: false, error: "Ya existe una cancha con ese número." });
  });

  it("lista las canchas creadas", async () => {
    const number = uniqueCourtNumber();
    await createCourt({ number, state: CourtState.MAINTENANCE, price: 10000 });

    const result = await getCourts();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data.some((court) => court.number === number)).toBe(true);
  });

  it("obtiene una cancha por id y null si no existe", async () => {
    const number = uniqueCourtNumber();
    const created = await createCourt({ number, price: 10000 });
    if (!created.success) throw new Error("expected success");

    const found = await getCourtById(created.data.id);
    expect(found).toEqual({ success: true, data: expect.objectContaining({ number }) });

    const notFound = await getCourtById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el estado de una cancha existente", async () => {
    const created = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!created.success) throw new Error("expected success");

    const result = await updateCourt(created.data.id, { state: CourtState.CLOSED_DOWN });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ state: CourtState.CLOSED_DOWN }),
    });
  });

  it("devuelve error al actualizar una cancha inexistente", async () => {
    const result = await updateCourt(999_999_999, { state: CourtState.AVAILABLE });

    expect(result).toEqual({ success: false, error: "La cancha no existe." });
  });
});
