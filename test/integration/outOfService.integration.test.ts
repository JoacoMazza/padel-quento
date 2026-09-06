import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { OutOfServiceReason } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import { createCourt } from "@/src/actions/court";
import {
  createOutOfService,
  getOutOfServices,
  getOutOfServiceById,
  updateOutOfService,
  deleteOutOfService,
} from "@/src/actions/outOfService";

function uniqueCourtNumber() {
  return Math.floor(Date.now() % 1_000_000) + Math.floor(Math.random() * 1000);
}

const fromDateTime = new Date("2026-01-01T09:00:00Z");
const toDateTime = new Date("2026-01-01T12:00:00Z");

describe("outOfService actions (integración con Postgres real)", () => {
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

  it("crea un bloqueo asociado a la cancha y lo persiste", async () => {
    const result = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.MAINTENANCE,
      description: "Arreglo de red",
      courtId,
    });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({
      reason: OutOfServiceReason.MAINTENANCE,
      description: "Arreglo de red",
    });
    expect(result.data.id).toBeDefined();
  });

  it("lista los bloqueos con la cancha asociada cargada", async () => {
    await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.CLEANING,
      courtId,
    });

    const result = await getOutOfServices();

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    const created = result.data.find(
      (o) => o.reason === OutOfServiceReason.CLEANING && o.court?.id === courtId,
    );
    expect(created?.court).toMatchObject({ id: courtId });
  });

  it("obtiene un bloqueo por id y null si no existe", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.OTHER,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const found = await getOutOfServiceById(created.data.id);
    expect(found.success).toBe(true);
    if (!found.success) throw new Error("expected success");
    expect(found.data?.reason).toBe(OutOfServiceReason.OTHER);

    const notFound = await getOutOfServiceById(999_999_999);
    expect(notFound).toEqual({ success: true, data: null });
  });

  it("actualiza el motivo de un bloqueo existente", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.FREE_DAY,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await updateOutOfService(created.data.id, {
      reason: OutOfServiceReason.MAINTENANCE,
    });

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ reason: OutOfServiceReason.MAINTENANCE }),
    });
  });

  it("devuelve error al actualizar un bloqueo inexistente", async () => {
    const result = await updateOutOfService(999_999_999, { reason: OutOfServiceReason.OTHER });

    expect(result).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
  });

  it("elimina un bloqueo existente y falla al eliminarlo de nuevo", async () => {
    const created = await createOutOfService({
      fromDateTime,
      toDateTime,
      reason: OutOfServiceReason.OTHER,
      courtId,
    });
    if (!created.success) throw new Error("expected success");

    const result = await deleteOutOfService(created.data.id);
    expect(result).toEqual({ success: true, data: null });

    const secondAttempt = await deleteOutOfService(created.data.id);
    expect(secondAttempt).toEqual({ success: false, error: "El bloqueo de cancha no existe." });
  });
});
