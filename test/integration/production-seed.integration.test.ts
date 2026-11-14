import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { In } from "typeorm";
import { AdminAccessLevel, CourtState, DayOfWeek } from "@/src/domain/enums";
import { Account } from "@/src/entities/Account";
import { Admin } from "@/src/entities/Admin";
import { Court } from "@/src/entities/Court";
import { Schedule } from "@/src/entities/Schedule";
import { getDataSource } from "@/src/lib/db";
import { seedCourts, seedOwner } from "@/scripts/production-seed";
import { ensureTestComplex, uniqueCourtNumber } from "./helpers";

const SEEDED_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8];
const ALL_DAYS = Object.values(DayOfWeek);

// Other test files share the database: leave no seeded courts behind.
async function removeSeededCourts() {
  const dataSource = await getDataSource();
  const courts = await dataSource.getRepository(Court).find({ where: { number: In(SEEDED_NUMBERS) } });
  if (courts.length === 0) return;
  const ids = courts.map((c) => c.id);
  await dataSource.getRepository(Schedule).delete({ court: { id: In(ids) } });
  await dataSource.getRepository(Court).delete({ id: In(ids) });
}

describe("seedCourts", () => {
  // Como después de las migraciones, que crean el complejo del club.
  beforeEach(async () => {
    await removeSeededCourts();
    await ensureTestComplex();
  });
  afterAll(removeSeededCourts);

  it("crea las 8 canchas disponibles, cada una con horario de 09:00 a 23:00 los 7 días", async () => {
    const dataSource = await getDataSource();

    const result = await seedCourts(dataSource);

    const courts = await dataSource.getRepository(Court).find({ where: { number: In(SEEDED_NUMBERS) } });
    expect(courts).toHaveLength(8);
    expect(courts.every((c) => c.state === CourtState.AVAILABLE)).toBe(true);

    const schedules = await dataSource.getRepository(Schedule).find({
      where: { court: { id: In(courts.map((c) => c.id)) } },
    });
    expect(schedules).toHaveLength(8 * ALL_DAYS.length);
    expect(schedules.every((s) => String(s.openingTime) === "09:00:00" && String(s.closingTime) === "23:00:00")).toBe(true);
    expect(result).toEqual({ courtsCreated: 8, schedulesCreated: 8 * ALL_DAYS.length });
  });

  it("crea las canchas en el complejo del club", async () => {
    const dataSource = await getDataSource();
    const complex = await ensureTestComplex();

    await seedCourts(dataSource);

    const courts = await dataSource
      .getRepository(Court)
      .find({ where: { number: In(SEEDED_NUMBERS) }, relations: { complex: true } });
    expect(courts.map((c) => c.complex.id)).toEqual(SEEDED_NUMBERS.map(() => complex.id));
  });

  it("es idempotente: correrlo de nuevo no duplica canchas ni horarios", async () => {
    const dataSource = await getDataSource();
    await seedCourts(dataSource);

    const result = await seedCourts(dataSource);

    expect(result).toEqual({ courtsCreated: 0, schedulesCreated: 0 });
    expect(await dataSource.getRepository(Court).count({ where: { number: In(SEEDED_NUMBERS) } })).toBe(8);
  });

  it("no le agrega horarios a canchas que no son las del seed", async () => {
    const dataSource = await getDataSource();
    const other = await dataSource
      .getRepository(Court)
      .save({ number: uniqueCourtNumber(), state: CourtState.AVAILABLE, price: 10000, complex: await ensureTestComplex() });

    await seedCourts(dataSource);

    expect(await dataSource.getRepository(Schedule).count({ where: { court: { id: other.id } } })).toBe(0);
    await dataSource.getRepository(Court).delete({ id: other.id });
  });
});

describe("seedOwner", () => {
  const input = () => ({
    email: `owner.${Date.now()}@test.com`,
    password: "una-contraseña-segura",
    names: "María",
    lastnames: "Gómez",
    dni: Date.now() % 100_000_000,
  });

  it("crea la cuenta del dueño con la contraseña hasheada y nivel dueño", async () => {
    const dataSource = await getDataSource();
    const owner = input();

    const created = await seedOwner(dataSource, owner);

    expect(created).toBe(true);
    const admin = await dataSource
      .getRepository(Admin)
      .findOne({ where: { account: { email: owner.email } }, relations: { account: true } });
    expect(admin).toMatchObject({ names: "María", lastnames: "Gómez", dni: owner.dni, accessLevel: AdminAccessLevel.OWNER });
    const bcrypt = await import("bcrypt");
    expect(await bcrypt.compare(owner.password, admin!.account.passwordHash)).toBe(true);
  });

  it("si ya existe una cuenta con ese email no crea nada", async () => {
    const dataSource = await getDataSource();
    const owner = input();
    await seedOwner(dataSource, owner);

    const created = await seedOwner(dataSource, { ...owner, dni: owner.dni + 1 });

    expect(created).toBe(false);
    expect(await dataSource.getRepository(Account).count({ where: { email: owner.email } })).toBe(1);
  });
});
