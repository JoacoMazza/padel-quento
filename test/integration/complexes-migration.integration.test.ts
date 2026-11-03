import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import { getDataSource } from "@/src/lib/db";

// The CLI loads migrations from disk; here Vite bundles them so the TS sources run as-is.
const migrationModules = import.meta.glob<Record<string, unknown>>("../../src/migrations/*.ts", { eager: true });
const migrations = Object.values(migrationModules).flatMap((module) =>
  Object.values(module).filter((value): value is new () => object => typeof value === "function"),
);
// AddComplexes y las que la siguen (AddComplexWhatsApp y AddComplexCountry, que necesitan la tabla).
const isComplexesMigration = (migration: new () => object) => migration.name.startsWith("AddComplex");

const CHECK_DATABASE = "padel_quento_complexes_migration_check";

function dataSourceFor(selected: (new () => object)[]) {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${CHECK_DATABASE}`;
  return new DataSource({ type: "postgres", url: url.toString(), migrations: selected });
}

describe("migración de complejos (integración con Postgres real)", { timeout: 120000 }, () => {
  let db: DataSource;

  beforeAll(async () => {
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
    await admin.query(`CREATE DATABASE ${CHECK_DATABASE}`);

    // Una base como la de hoy, con canchas y turnos, antes de la migración de complejos.
    const before = dataSourceFor(migrations.filter((m) => !isComplexesMigration(m)));
    await before.initialize();
    await before.runMigrations();
    await before.query(`INSERT INTO "courts" ("number", "state", "price") VALUES (1, 'available', 10000), (2, 'maintenance', 12000)`);
    await before.query(`INSERT INTO "bookers" ("names", "last_names", "phone_number", "type") VALUES ('Ana', 'Gómez', '2215550001', 'Booker')`);
    await before.query(
      `INSERT INTO "bookings" ("datetime", "duration_minutes", "booking_state", "price", "booker_phone_number", "court_id")
       SELECT '2026-11-02 18:00', 90, 'reserved', 10000, '2215550001', "id" FROM "courts" WHERE "number" = 1`,
    );
    await before.destroy();

    db = dataSourceFor(migrations);
    await db.initialize();
    await db.runMigrations();
  });

  afterAll(async () => {
    await db?.destroy();
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
  });

  it("crea el complejo por defecto con los datos del club", async () => {
    const complexes = await db.query(
      `SELECT "name", "address", "city", "province", "country", "postal_code", "latitude"::float AS "latitude",
              "longitude"::float AS "longitude", "maps_url" FROM "complexes"`,
    );

    expect(complexes).toEqual([
      {
        name: "Quento Club",
        address: "Cam. Centenario 8907",
        city: "Villa Elisa",
        province: "Buenos Aires",
        country: "Argentina",
        postal_code: "B1894",
        latitude: -34.863726,
        longitude: -58.061057,
        maps_url: "https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA",
      },
    ]);
  });

  it("carga el WhatsApp de contacto del club, con su mensaje inicial", async () => {
    const complexes = await db.query(`SELECT "whatsapp_number", "whatsapp_message" FROM "complexes"`);

    expect(complexes).toEqual([
      { whatsapp_number: "+54 9 221 604-9987", whatsapp_message: "Hola, quiero hacer una consulta sobre Quento Club." },
    ]);
  });

  it("asigna las canchas existentes al complejo por defecto, sin perder sus datos ni sus turnos", async () => {
    const courts = await db.query(
      `SELECT "c"."number", "c"."state", "c"."price"::float AS "price", "x"."name" AS "complex"
       FROM "courts" "c" INNER JOIN "complexes" "x" ON "x"."id" = "c"."complex_id" ORDER BY "c"."number"`,
    );
    expect(courts).toEqual([
      { number: 1, state: "available", price: 10000, complex: "Quento Club" },
      { number: 2, state: "maintenance", price: 12000, complex: "Quento Club" },
    ]);

    const bookings = await db.query(
      `SELECT "c"."number" FROM "bookings" "b" INNER JOIN "courts" "c" ON "c"."id" = "b"."court_id"`,
    );
    expect(bookings).toEqual([{ number: 1 }]);
  });

  it("se puede revertir sin perder las canchas", async () => {
    await db.undoLastMigration();
    await db.undoLastMigration();
    await db.undoLastMigration();

    const courts = await db.query(`SELECT "number" FROM "courts" ORDER BY "number"`);
    expect(courts).toEqual([{ number: 1 }, { number: 2 }]);
    const complexesTable = await db.query(`SELECT to_regclass('public.complexes') AS "table"`);
    expect(complexesTable).toEqual([{ table: null }]);
  });
});
