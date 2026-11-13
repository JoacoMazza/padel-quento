import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DataSource } from "typeorm";
import { getDataSource } from "@/src/lib/db";
import { migrationDataSource, migrations, migrationsBefore } from "./migration-helpers";

const CHECK_DATABASE = "padel_quento_bookers_id_migration_check";

describe("migraciones que alinean la base con el DER (integración con Postgres real)", { timeout: 120000 }, () => {
  let db: DataSource;

  beforeAll(async () => {
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
    await admin.query(`CREATE DATABASE ${CHECK_DATABASE}`);

    // Una base de antes: turnos y turnos fijos referencian a quien reservó por su teléfono,
    // y las canchas tienen los estados de mantenimiento y fuera de servicio.
    const before = migrationDataSource(CHECK_DATABASE, migrationsBefore("ReferenceBookersByIdAndRenameReviews"));
    await before.initialize();
    await before.runMigrations();
    await before.query(
      `INSERT INTO "courts" ("number", "state", "price", "complex_id") SELECT 1, 'available', 10000, MIN("id") FROM "complexes"`,
    );
    await before.query(
      `INSERT INTO "courts" ("number", "state", "price", "complex_id")
       SELECT 2, 'maintenance'::courts_state_enum, 10000, MIN("id") FROM "complexes" UNION ALL
       SELECT 3, 'out_of_service'::courts_state_enum, 10000, MIN("id") FROM "complexes" UNION ALL
       SELECT 4, 'closed_down'::courts_state_enum, 10000, MIN("id") FROM "complexes"`,
    );
    await before.query(
      `INSERT INTO "bookers" ("names", "last_names", "phone_number", "type") VALUES
       ('Ana', 'Uno', '2215550001', 'Player'), ('Beto', 'Dos', '2215550002', 'Player')`,
    );
    await before.query(
      `INSERT INTO "bookings" ("datetime", "duration_minutes", "booking_state", "price", "booker_phone_number", "court_id")
       SELECT '2026-11-03 18:00', 90, 'reserved', 10000, '2215550002', "id" FROM "courts" WHERE "number" = 1`,
    );
    await before.query(
      `INSERT INTO "fixed_bookings" ("court_id", "booker_phone_number", "start_date", "start_time", "duration_minutes", "frequency")
       SELECT "id", '2215550001', '2026-11-02', '10:00', 90, 'weekly' FROM "courts" WHERE "number" = 1`,
    );
    await before.query(`INSERT INTO "matches" ("booking_id", "need_players") SELECT "id", false FROM "bookings"`);
    // Del partido de Beto: él con un acompañante, y Ana marcada ausente antes de que corriera el job.
    await before.query(
      `INSERT INTO "match_players" ("match_id", "player_id", "players_count", "attended")
       SELECT "m"."id", "b"."id", CASE WHEN "b"."names" = 'Beto' THEN 2 ELSE 1 END, "b"."names" = 'Beto'
       FROM "matches" "m", "bookers" "b"`,
    );
    // Turnos sin partido: uno pagado y ya procesado por el job, una inasistencia de Ana ya
    // procesada (con su penalización en el historial, todavía sin turno) y una inasistencia
    // de Beto que el job todavía no procesó.
    await before.query(
      `INSERT INTO "bookings" ("datetime", "duration_minutes", "booking_state", "price", "booker_phone_number", "court_id", "attended", "points_awarded")
       SELECT '2026-10-01 10:00'::timestamp, 90, 'paid'::"bookings_booking_state_enum", 10000, '2215550001', "id", true, true FROM "courts" WHERE "number" = 1 UNION ALL
       SELECT '2026-10-02 10:00', 90, 'reserved', 10000, '2215550001', "id", false, true FROM "courts" WHERE "number" = 1 UNION ALL
       SELECT '2026-10-03 10:00', 90, 'reserved', 10000, '2215550002', "id", false, false FROM "courts" WHERE "number" = 1`,
    );
    await before.query(
      `INSERT INTO "penalties" ("player_id", "penalized_scoring", "reason", "created_at")
       SELECT "id", 50, 'Puntos iniciales', '2026-09-01'::timestamp FROM "bookers" UNION ALL
       SELECT "id", -20, 'Inasistencia a turno reservado', '2026-10-02 12:00' FROM "bookers" WHERE "names" = 'Ana'`,
    );
    await before.query(`UPDATE "bookers" SET "scoring" = CASE WHEN "names" = 'Ana' THEN 30 ELSE 50 END`);
    await before.query(
      `INSERT INTO "player_reviews" ("match_id", "reviewer_id", "reviewed_id", "level", "good_attitude", "on_time")
       SELECT "m"."id", "a"."id", "b"."id", 'higher', true, false
       FROM "matches" "m", "bookers" "a", "bookers" "b" WHERE "a"."phone_number" = '2215550001' AND "b"."phone_number" = '2215550002'`,
    );
    await before.destroy();

    db = migrationDataSource(CHECK_DATABASE, migrations);
    await db.initialize();
    await db.runMigrations();
  });

  afterAll(async () => {
    await db?.destroy();
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
  });

  it("los turnos y los turnos fijos pasan a referenciar a quien reservó por su id", async () => {
    const bookings = await db.query(
      `SELECT "b"."names" FROM "bookings" "t" INNER JOIN "bookers" "b" ON "b"."id" = "t"."booker_id" ORDER BY "t"."datetime"`,
    );
    const fixed = await db.query(
      `SELECT "b"."names" FROM "fixed_bookings" "t" INNER JOIN "bookers" "b" ON "b"."id" = "t"."booker_id"`,
    );

    expect(bookings).toEqual([{ names: "Ana" }, { names: "Ana" }, { names: "Beto" }, { names: "Beto" }]);
    expect(fixed).toEqual([{ names: "Ana" }]);
  });

  it("las canchas en mantenimiento o fuera de servicio quedan disponibles; las dadas de baja, igual", async () => {
    expect(await db.query(`SELECT "number", "state" FROM "courts" ORDER BY "number"`)).toEqual([
      { number: 1, state: "available" },
      { number: 2, state: "available" },
      { number: 3, state: "available" },
      { number: 4, state: "closed_down" },
    ]);
  });

  it("pagado pasa a is_paid y los turnos que el job ya procesó quedan finalizados", async () => {
    expect(
      await db.query(
        `SELECT to_char("datetime", 'MM-DD HH24:MI') AS "at", "booking_state" AS "state", "is_paid" FROM "bookings" ORDER BY "datetime"`,
      ),
    ).toEqual([
      { at: "10-01 10:00", state: "finished", is_paid: true },
      { at: "10-02 10:00", state: "finished", is_paid: false },
      { at: "10-03 10:00", state: "reserved", is_paid: false },
      { at: "11-03 18:00", state: "reserved", is_paid: false },
    ]);
  });

  it("las inasistencias quedan como penalizaciones ligadas a su turno, y las que faltaba procesar se descuentan", async () => {
    expect(
      await db.query(
        `SELECT "b"."names", "p"."penalized_scoring"::int AS "points", to_char("t"."datetime", 'MM-DD HH24:MI') AS "at"
         FROM "penalties" "p" INNER JOIN "bookers" "b" ON "b"."id" = "p"."player_id"
         LEFT JOIN "bookings" "t" ON "t"."id" = "p"."booking_id"
         WHERE "p"."reason" = 'Inasistencia a turno reservado' ORDER BY "at", "b"."names"`,
      ),
    ).toEqual([
      { names: "Ana", points: -20, at: "10-02 10:00" },
      { names: "Beto", points: -20, at: "10-03 10:00" },
      { names: "Ana", points: -20, at: "11-03 18:00" },
    ]);
    expect(await db.query(`SELECT "names", "scoring" FROM "bookers" ORDER BY "names"`)).toEqual([
      { names: "Ana", scoring: 10 },
      { names: "Beto", scoring: 30 },
    ]);
  });

  it("la asistencia de cada jugador de un partido pasa a ser cuántos de su grupo asistieron", async () => {
    expect(
      await db.query(
        `SELECT "b"."names", "mp"."players_count", "mp"."attended_count", "mp"."points_awarded"
         FROM "match_players" "mp" INNER JOIN "bookers" "b" ON "b"."id" = "mp"."player_id" ORDER BY "b"."names"`,
      ),
    ).toEqual([
      { names: "Ana", players_count: 1, attended_count: 0, points_awarded: 0 },
      { names: "Beto", players_count: 2, attended_count: 2, points_awarded: 0 },
    ]);
  });

  it("las calificaciones siguen en players_reviews, y se pueden seguir cargando", async () => {
    expect(await db.query(`SELECT "level", "good_attitude", "on_time" FROM "players_reviews"`)).toEqual([
      { level: "higher", good_attitude: true, on_time: false },
    ]);

    await db.query(
      `INSERT INTO "players_reviews" ("match_id", "reviewer_id", "reviewed_id", "level", "good_attitude", "on_time")
       SELECT "match_id", "reviewed_id", "reviewer_id", 'lower', true, true FROM "players_reviews"`,
    );
    expect(await db.query(`SELECT COUNT(*)::int AS "count" FROM "players_reviews"`)).toEqual([{ count: 2 }]);
  });
});
