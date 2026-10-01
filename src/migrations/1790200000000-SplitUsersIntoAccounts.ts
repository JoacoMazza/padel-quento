import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Alinea el manejo de usuarios con el DER (docs/der/DER Padel Quento.drawio):
 * - "users" (herencia por tabla única User/Player) se divide en "accounts"
 *   (credenciales), "admins", "players" y "bookers" (quien reserva turnos).
 * - Los turnos pasan a referenciar a quien reservó por bookings.booker_phone_number
 *   -> bookers.phone_number, en lugar de bookings.player_id -> users.id.
 * - penalties, match_players y messages pasan a referenciar a "players".
 *
 * Los datos existentes se conservan reutilizando el id de cada fila de "users"
 * como id de su cuenta, su administrador o su jugador (y de su booker), así las
 * FKs que ya apuntaban a users.id siguen siendo válidas contra players.id.
 */
export class SplitUsersIntoAccounts1790200000000 implements MigrationInterface {
  name = "SplitUsersIntoAccounts1790200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "accounts" ("id" SERIAL NOT NULL, "email" character varying NOT NULL, "photo_url" character varying, "password_hashed" character varying NOT NULL, "is_blocked" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_accounts_email" UNIQUE ("email"), CONSTRAINT "PK_accounts_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "admins" ("id" SERIAL NOT NULL, "dni" integer, "names" character varying NOT NULL, "last_names" character varying NOT NULL, "account_id" integer, CONSTRAINT "UQ_admins_account_id" UNIQUE ("account_id"), CONSTRAINT "PK_admins_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "bookers" ("id" SERIAL NOT NULL, "names" character varying NOT NULL, "last_names" character varying NOT NULL, "phone_number" character varying NOT NULL, CONSTRAINT "UQ_bookers_phone_number" UNIQUE ("phone_number"), CONSTRAINT "PK_bookers_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "players" ("id" SERIAL NOT NULL, "category" character varying NOT NULL DEFAULT 'without_category', "scoring" double precision NOT NULL DEFAULT '0', "account_id" integer, "booker_id" integer, CONSTRAINT "UQ_players_account_id" UNIQUE ("account_id"), CONSTRAINT "UQ_players_booker_id" UNIQUE ("booker_id"), CONSTRAINT "PK_players_id" PRIMARY KEY ("id"))`,
    );

    // ─── Datos: users -> accounts / admins / players + bookers ────────────────
    await queryRunner.query(
      `INSERT INTO "accounts" ("id", "email", "photo_url", "password_hashed", "is_blocked")
       SELECT "id", "email", "photo_url", "password_hashed", "is_blocked" FROM "users"`,
    );
    await queryRunner.query(
      `INSERT INTO "admins" ("id", "account_id", "dni", "names", "last_names")
       SELECT "id", "id", "dni", "names", "last_names" FROM "users" WHERE "type" <> 'Player'`,
    );
    // phone_number pasa a ser obligatorio y único: a los jugadores sin teléfono
    // (o con uno repetido) se les asigna uno provisorio hasta que lo actualicen.
    await queryRunner.query(
      `INSERT INTO "bookers" ("id", "names", "last_names", "phone_number")
       SELECT "id", "names", "last_names",
              CASE
                WHEN "phone_number" IS NULL
                  OR ROW_NUMBER() OVER (PARTITION BY "phone_number" ORDER BY "id") > 1
                THEN 'sin-telefono-' || "id"
                ELSE "phone_number"
              END
       FROM "users" WHERE "type" = 'Player'`,
    );
    await queryRunner.query(
      `INSERT INTO "players" ("id", "account_id", "booker_id", "category", "scoring")
       SELECT "id", "id", "id", COALESCE("category", 'without_category'), COALESCE("scoring", 0)
       FROM "users" WHERE "type" = 'Player'`,
    );
    for (const table of ["accounts", "admins", "bookers", "players"]) {
      await queryRunner.query(
        `SELECT setval('${table}_id_seq', COALESCE((SELECT MAX("id") FROM "${table}"), 0) + 1, false)`,
      );
    }

    await queryRunner.query(
      `ALTER TABLE "admins" ADD CONSTRAINT "FK_admins_account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_players_account_id" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "players" ADD CONSTRAINT "FK_players_booker_id" FOREIGN KEY ("booker_id") REFERENCES "bookers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    // ─── bookings.player_id -> bookings.booker_phone_number ──────────────────
    await queryRunner.query(`ALTER TABLE "bookings" ADD "booker_phone_number" character varying`);
    await queryRunner.query(
      `UPDATE "bookings" SET "booker_phone_number" = "bookers"."phone_number"
       FROM "players" JOIN "bookers" ON "bookers"."id" = "players"."booker_id"
       WHERE "players"."id" = "bookings"."player_id"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_129e7fe11e40d931c7bfdcf7e04"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "player_id"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_booker_phone_number" FOREIGN KEY ("booker_phone_number") REFERENCES "bookers"("phone_number") ON DELETE NO ACTION ON UPDATE CASCADE`,
    );

    // ─── penalties / match_players / messages pasan a referenciar players ─────
    // Solo los jugadores podían tener filas acá; por las dudas se descartan las
    // que apunten a un usuario que no pasó a "players" (no cumplirían la FK nueva).
    for (const [table, column, constraint] of [
      ["penalties", "player_id", "FK_penalties_player_id"],
      ["match_players", "player_id", "FK_match_players_player_id"],
      ["messages", "sender_id", "FK_messages_sender_id"],
    ]) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${constraint}"`);
      await queryRunner.query(
        `DELETE FROM "${table}" WHERE "${column}" IS NOT NULL AND "${column}" NOT IN (SELECT "id" FROM "players")`,
      );
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" FOREIGN KEY ("${column}") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(`DROP TABLE "users"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "users" ("id" SERIAL NOT NULL, "dni" integer, "email" character varying NOT NULL, "names" character varying NOT NULL, "last_names" character varying NOT NULL, "phone_number" character varying, "role" character varying NOT NULL DEFAULT 'player', "photo_url" character varying, "password_hashed" character varying NOT NULL, "category" character varying DEFAULT 'without_category', "scoring" double precision DEFAULT '0', "type" character varying NOT NULL, "is_blocked" boolean NOT NULL DEFAULT false, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_94e2000b5f7ee1f9c491f0f8a8" ON "users" ("type")`);

    // Los bookers sin cuenta (reservas sin jugador registrado) no tienen lugar
    // en "users": sus turnos quedan sin jugador asociado.
    await queryRunner.query(
      `INSERT INTO "users" ("id", "dni", "email", "names", "last_names", "phone_number", "role", "photo_url", "password_hashed", "type", "is_blocked")
       SELECT "admins"."id", "admins"."dni", "accounts"."email", "admins"."names", "admins"."last_names", NULL, 'admin', "accounts"."photo_url", "accounts"."password_hashed", 'User', "accounts"."is_blocked"
       FROM "admins" JOIN "accounts" ON "accounts"."id" = "admins"."account_id"`,
    );
    await queryRunner.query(
      `INSERT INTO "users" ("id", "dni", "email", "names", "last_names", "phone_number", "role", "photo_url", "password_hashed", "category", "scoring", "type", "is_blocked")
       SELECT "players"."id", NULL, "accounts"."email", "bookers"."names", "bookers"."last_names", "bookers"."phone_number", 'player', "accounts"."photo_url", "accounts"."password_hashed", "players"."category", "players"."scoring", 'Player', "accounts"."is_blocked"
       FROM "players"
       JOIN "accounts" ON "accounts"."id" = "players"."account_id"
       JOIN "bookers" ON "bookers"."id" = "players"."booker_id"`,
    );
    await queryRunner.query(
      `SELECT setval('users_id_seq', COALESCE((SELECT MAX("id") FROM "users"), 0) + 1, false)`,
    );

    for (const [table, column, constraint] of [
      ["penalties", "player_id", "FK_penalties_player_id"],
      ["match_players", "player_id", "FK_match_players_player_id"],
      ["messages", "sender_id", "FK_messages_sender_id"],
    ]) {
      await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${constraint}"`);
      await queryRunner.query(
        `ALTER TABLE "${table}" ADD CONSTRAINT "${constraint}" FOREIGN KEY ("${column}") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
      );
    }

    await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_booker_phone_number"`);
    await queryRunner.query(`ALTER TABLE "bookings" ADD "player_id" integer`);
    await queryRunner.query(
      `UPDATE "bookings" SET "player_id" = "players"."id"
       FROM "bookers" JOIN "players" ON "players"."booker_id" = "bookers"."id"
       WHERE "bookers"."phone_number" = "bookings"."booker_phone_number"`,
    );
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "booker_phone_number"`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD CONSTRAINT "FK_129e7fe11e40d931c7bfdcf7e04" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP TABLE "players"`);
    await queryRunner.query(`DROP TABLE "bookers"`);
    await queryRunner.query(`DROP TABLE "admins"`);
    await queryRunner.query(`DROP TABLE "accounts"`);
  }
}
