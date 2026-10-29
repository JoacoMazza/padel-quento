import { afterAll, describe, expect, it } from "vitest";
import { QueryFailedError } from "typeorm";
import { CourtState } from "@/src/domain/enums";
import type { Complex } from "@/src/entities/Complex";
import type { Court } from "@/src/entities/Court";
import { getDataSource } from "@/src/lib/db";
import { uniqueCourtNumber } from "./helpers";

const VALID = {
  name: "Complejo de prueba",
  address: "Calle 1 123",
  city: "La Plata",
  province: "Buenos Aires",
  postalCode: "1900",
  latitude: -34.9214,
  longitude: -57.9545,
  mapsUrl: null,
};

async function saveComplex(overrides: Partial<typeof VALID>) {
  const dataSource = await getDataSource();
  const complexes = dataSource.getRepository<Complex>("Complex");
  return complexes.save(complexes.create({ ...VALID, ...overrides }));
}

describe("complejos (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.getRepository<Complex>("Complex").delete({ name: VALID.name });
  });

  it("guarda la ubicación con la latitud y la longitud como números", async () => {
    const saved = await saveComplex({});
    const dataSource = await getDataSource();

    const found = await dataSource.getRepository<Complex>("Complex").findOneByOrFail({ id: saved.id });
    expect(found).toMatchObject({ ...VALID, id: saved.id });
  });

  it("acepta los extremos de los rangos válidos", async () => {
    await expect(saveComplex({ latitude: 90, longitude: 180 })).resolves.toBeTruthy();
    await expect(saveComplex({ latitude: -90, longitude: -180 })).resolves.toBeTruthy();
  });

  it.each([
    ["latitud mayor a 90", { latitude: 90.5 }],
    ["latitud menor a -90", { latitude: -91 }],
    ["longitud mayor a 180", { longitude: 181 }],
    ["longitud menor a -180", { longitude: -180.5 }],
  ])("rechaza una %s", async (_, overrides) => {
    await expect(saveComplex(overrides)).rejects.toBeInstanceOf(QueryFailedError);
  });

  it("una cancha no se puede guardar sin complejo", async () => {
    const dataSource = await getDataSource();
    const courts = dataSource.getRepository<Court>("Court");

    await expect(
      courts.save(courts.create({ number: uniqueCourtNumber(), state: CourtState.AVAILABLE, price: 10000 })),
    ).rejects.toBeInstanceOf(QueryFailedError);
  });
});
