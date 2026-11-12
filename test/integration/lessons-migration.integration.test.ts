import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { migrationDataSource, migrations, migrationsBefore } from "./migration-helpers";
import { getDataSource } from "@/src/lib/db";

const CHECK_DATABASE = "padel_quento_lessons_migration_check";

function dataSourceFor(selected: typeof migrations) {
  return migrationDataSource(CHECK_DATABASE, selected);
}

describe("migración de profesores a clases (integración con Postgres real)", { timeout: 120000 }, () => {
  let db: DataSource;

  beforeAll(async () => {
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
    await admin.query(`CREATE DATABASE ${CHECK_DATABASE}`);

    // Una base de antes de la migración (solo las anteriores): un profesor activo con una clase con una alumna, y una clase cancelada.
    const before = dataSourceFor(migrationsBefore("ReplaceTeachersWithLessons"));
    await before.initialize();
    await before.runMigrations();
    // El complejo del club ya lo crea la migración de complejos.
    await before.query(
      `INSERT INTO "courts" ("number", "state", "price", "complex_id") SELECT 1, 'available', 10000, MIN("id") FROM "complexes"`,
    );
    await before.query(
      `INSERT INTO "bookers" ("names", "last_names", "phone_number", "type") VALUES
       ('Lucía', 'Profe', '2215550001', 'Player'), ('Ana', 'Alumna', '2215550002', 'Player')`,
    );
    await before.query(
      `INSERT INTO "teachers" ("player_id", "is_active") SELECT "id", true FROM "bookers" WHERE "phone_number" = '2215550001'`,
    );
    await before.query(
      `INSERT INTO "bookings" ("datetime", "duration_minutes", "booking_state", "price", "booker_phone_number", "court_id", "class_capacity")
       SELECT '2026-11-03 18:00'::timestamp, 90, 'reserved'::bookings_booking_state_enum, 10000, '2215550001', "id", 4 FROM "courts" UNION ALL
       SELECT '2026-11-04 10:00'::timestamp, 60, 'cancelled'::bookings_booking_state_enum, 10000, '2215550001', "id", 2 FROM "courts" UNION ALL
       SELECT '2026-11-05 10:00'::timestamp, 90, 'reserved'::bookings_booking_state_enum, 10000, '2215550002', "id", NULL FROM "courts"`,
    );
    await before.query(
      `INSERT INTO "class_students" ("booking_id", "player_id")
       SELECT "b"."id", "p"."id" FROM "bookings" "b", "bookers" "p"
       WHERE "b"."datetime" = '2026-11-03 18:00' AND "p"."phone_number" = '2215550002'`,
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

  it("cada turno de clase pasa a ser una clase de un día con su profesor, cupo, precio y horario", async () => {
    const lessons = await db.query(
      `SELECT "t"."names" AS "teacher", "l"."class_capacity", "l"."is_active", "l"."price"::float AS "price",
              to_char("l"."from_local_datetime", 'YYYY-MM-DD HH24:MI') AS "from",
              to_char("l"."to_local_datetime", 'YYYY-MM-DD HH24:MI') AS "to",
              "s"."day_of_week", "s"."start_time", "s"."end_time"
       FROM "lessons" "l"
       INNER JOIN "bookers" "t" ON "t"."id" = "l"."teacher_id"
       INNER JOIN "lesson_schedules" "s" ON "s"."lesson_id" = "l"."id"
       ORDER BY "l"."from_local_datetime"`,
    );

    expect(lessons).toEqual([
      {
        teacher: "Lucía",
        class_capacity: 4,
        is_active: true,
        price: 10000,
        from: "2026-11-03 00:00",
        to: "2026-11-03 23:59",
        day_of_week: "tuesday",
        start_time: "18:00:00",
        end_time: "19:30:00",
      },
      {
        teacher: "Lucía",
        class_capacity: 2,
        is_active: false,
        price: 10000,
        from: "2026-11-04 00:00",
        to: "2026-11-04 23:59",
        day_of_week: "wednesday",
        start_time: "10:00:00",
        end_time: "11:00:00",
      },
    ]);
  });

  it("los turnos quedan vinculados a su clase y los demás no", async () => {
    const bookings = await db.query(
      `SELECT to_char("b"."datetime", 'YYYY-MM-DD HH24:MI') AS "datetime", "l"."class_capacity"
       FROM "bookings" "b" LEFT JOIN "lessons" "l" ON "l"."id" = "b"."lesson_id" ORDER BY "b"."datetime"`,
    );

    expect(bookings).toEqual([
      { datetime: "2026-11-03 18:00", class_capacity: 4 },
      { datetime: "2026-11-04 10:00", class_capacity: 2 },
      { datetime: "2026-11-05 10:00", class_capacity: null },
    ]);
  });

  it("los alumnos de cada turno quedan inscriptos en su clase", async () => {
    const inscriptions = await db.query(
      `SELECT "p"."names", "l"."class_capacity" FROM "inscriptions" "i"
       INNER JOIN "bookers" "p" ON "p"."id" = "i"."player_id"
       INNER JOIN "lessons" "l" ON "l"."id" = "i"."lesson_id"`,
    );

    expect(inscriptions).toEqual([{ names: "Ana", class_capacity: 4 }]);
  });

  it("ya no existen las tablas de profesores ni de alumnos por turno", async () => {
    const tables = await db.query(
      `SELECT "table_name" FROM information_schema.tables WHERE "table_schema" = 'public' AND "table_name" IN ('teachers', 'class_students')`,
    );

    expect(tables).toEqual([]);
  });
});
