import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AdminAccessLevel, CourtState, Role } from "@/src/domain/enums";
import { getDataSource } from "@/src/lib/db";
import {
  createCourt,
  getCourts,
  getCourtById,
  updateAllCourtsPrice,
  updateCourt,
} from "@/src/actions/court";
import type { Court } from "@/src/entities/Court";
import { createTestAdmin, createTestCourt, ensureTestComplex, uniqueCourtNumber } from "./helpers";

vi.mock("next-auth/next", () => ({ getServerSession: vi.fn() }));

import { getServerSession } from "next-auth/next";

describe("court actions (integración con Postgres real)", () => {
  // Editar canchas es solo para administradores; precios, altas y bajas, solo para el dueño.
  let ownerEmail: string;
  let staffEmail: string;
  let complexId: number;

  function signInAs(email: string) {
    vi.mocked(getServerSession).mockResolvedValue({ user: { email, role: Role.ADMIN } } as never);
  }

  beforeAll(async () => {
    ownerEmail = (await createTestAdmin(AdminAccessLevel.OWNER)).email;
    staffEmail = (await createTestAdmin(AdminAccessLevel.STAFF)).email;
    complexId = (await ensureTestComplex()).id;
  });

  beforeEach(() => {
    signInAs(ownerEmail);
  });

  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("genera números de cancha distintos en llamadas consecutivas", () => {
    const numbers = Array.from({ length: 1000 }, () => uniqueCourtNumber());

    expect(new Set(numbers).size).toBe(numbers.length);
  });

  it("un archivo que arranca después no repite números ya usados por otro anterior, aunque haya usado muchos", async () => {
    // Cada archivo de test carga su propia copia de helpers (como en la suite): se simulan dos, el segundo 300 ms después.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(1_793_236_924_000);
      vi.resetModules();
      const earlierFile = await import("./helpers");
      const used = Array.from({ length: 1100 }, () => earlierFile.uniqueCourtNumber());

      vi.setSystemTime(1_793_236_924_300);
      vi.resetModules();
      const laterFile = await import("./helpers");

      expect(laterFile.uniqueCourtNumber()).toBeGreaterThan(Math.max(...used));
    } finally {
      vi.useRealTimers();
    }
  });

  it("crea una cancha con el estado AVAILABLE por defecto y la persiste", async () => {
    const number = uniqueCourtNumber();

    const result = await createCourt({ number, price: 10000 });

    expect(result.success).toBe(true);
    if (!result.success) throw new Error("expected success");
    expect(result.data).toMatchObject({ number, state: CourtState.AVAILABLE, price: 10000 });
    expect(result.data.id).toBeDefined();
  });

  it("asocia la cancha nueva al complejo del club", async () => {
    const result = await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    if (!result.success) throw new Error(result.error);

    const dataSource = await getDataSource();
    const saved = await dataSource
      .getRepository<Court>("Court")
      .findOneOrFail({ where: { id: result.data.id }, relations: { complex: true } });
    expect(saved.complex.id).toBe(complexId);
  });

  it("lista las canchas con su complejo y su ubicación", async () => {
    const number = uniqueCourtNumber();
    await createCourt({ number, price: 10000 });

    const result = await getCourts();

    if (!result.success) throw new Error(result.error);
    expect(result.data.find((c) => c.number === number)?.complex).toMatchObject({
      id: complexId,
      name: expect.any(String),
      address: expect.any(String),
      city: expect.any(String),
      latitude: expect.any(Number),
      longitude: expect.any(Number),
    });
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

  it("un administrador cambia el precio de todas las canchas a la vez", async () => {
    await createCourt({ number: uniqueCourtNumber(), price: 10000 });
    await createCourt({ number: uniqueCourtNumber(), state: CourtState.CLOSED_DOWN, price: 12000 });

    const result = await updateAllCourtsPrice(17500);

    expect(result).toEqual({ success: true, data: null });
    const courts = await getCourts();
    if (!courts.success) throw new Error("expected success");
    expect(courts.data.every((court) => court.price === 17500)).toBe(true);
  });

  describe("trabajador (no dueño)", () => {
    const OWNER_ONLY = "Solo el dueño del complejo puede hacer esto.";

    it("no puede dar de alta canchas", async () => {
      signInAs(staffEmail);

      expect(await createCourt({ number: uniqueCourtNumber(), price: 10000 })).toEqual({ success: false, error: OWNER_ONLY });
    });

    it("no puede cambiar precios, ni de una cancha ni de todas", async () => {
      const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
      signInAs(staffEmail);

      expect(await updateCourt(court.data.id, { price: 12000 })).toEqual({ success: false, error: OWNER_ONLY });
      expect(await updateAllCourtsPrice(12000)).toEqual({ success: false, error: OWNER_ONLY });
      const after = await getCourtById(court.data.id);
      expect(after.success && after.data?.price).toBe(10000);
    });

    it("no puede dar de baja una cancha ni volver a habilitar una dada de baja", async () => {
      const open = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
      const closed = await createTestCourt({ number: uniqueCourtNumber(), price: 10000, state: CourtState.CLOSED_DOWN });
      signInAs(staffEmail);

      expect(await updateCourt(open.data.id, { state: CourtState.CLOSED_DOWN })).toEqual({ success: false, error: OWNER_ONLY });
      expect(await updateCourt(closed.data.id, { state: CourtState.AVAILABLE })).toEqual({ success: false, error: OWNER_ONLY });
    });

    it("puede pasar una cancha a mantenimiento y volverla a habilitar", async () => {
      const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
      signInAs(staffEmail);

      const maintenance = await updateCourt(court.data.id, { state: CourtState.MAINTENANCE });
      const available = await updateCourt(court.data.id, { state: CourtState.AVAILABLE });

      expect(maintenance.success && maintenance.data.state).toBe(CourtState.MAINTENANCE);
      expect(available.success && available.data.state).toBe(CourtState.AVAILABLE);
    });

    it("puede mandar el mismo precio que ya tiene la cancha al editar otra cosa", async () => {
      const court = await createTestCourt({ number: uniqueCourtNumber(), price: 10000 });
      signInAs(staffEmail);

      const result = await updateCourt(court.data.id, { state: CourtState.MAINTENANCE, price: 10000 });

      expect(result.success).toBe(true);
    });
  });
});
