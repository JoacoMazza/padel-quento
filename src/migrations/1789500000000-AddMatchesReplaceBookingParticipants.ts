import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Separa el concepto de "partido abierto" de Booking, alineado con el DER
 * (docs/der/DER Padel Quento.drawio): matchs.need_players reemplaza al estado
 * "pending_players" de bookings, y match_players reemplaza a booking_participants,
 * ligando a los jugadores confirmados con el partido en vez de con el turno.
 * match_players usa id autogenerado (no una clave primaria compuesta): con
 * TypeORM, guardar filas nuevas mediante una PK compuesta armada a partir de
 * relaciones puede terminar pisando una fila existente en vez de insertar una
 * nueva. La combinación (match, player) sigue siendo única por restricción.
 * players_count sigue contando los acompañantes sin cuenta propia que trae
 * quien crea el partido.
 */
export class AddMatchesReplaceBookingParticipants1789500000000 implements MigrationInterface {
  name = "AddMatchesReplaceBookingParticipants1789500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "matchs" ("id" SERIAL NOT NULL, "need_players" boolean NOT NULL DEFAULT true, "booking_id" integer, CONSTRAINT "UQ_matchs_booking_id" UNIQUE ("booking_id"), CONSTRAINT "PK_matchs_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "matchs" ADD CONSTRAINT "FK_matchs_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // Un partido por cada turno que ya tenía participantes; need_players sigue el estado actual del turno.
    await queryRunner.query(
      `INSERT INTO "matchs" ("need_players", "booking_id")
       SELECT DISTINCT (b.booking_state = 'pending_players'), bp.booking_id
       FROM "booking_participants" bp
       JOIN "bookings" b ON b.id = bp.booking_id`,
    );

    await queryRunner.query(
      `CREATE TABLE "match_players" ("id" SERIAL NOT NULL, "players_count" integer NOT NULL DEFAULT '1', "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "match_id" integer, "player_id" integer, CONSTRAINT "UQ_match_players_match_player" UNIQUE ("match_id", "player_id"), CONSTRAINT "PK_match_players_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_match_id" FOREIGN KEY ("match_id") REFERENCES "matchs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_player_id" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "match_players" ("players_count", "joined_at", "match_id", "player_id")
       SELECT bp.players_count, bp.joined_at, m.id, bp.player_id
       FROM "booking_participants" bp
       JOIN "matchs" m ON m.booking_id = bp.booking_id`,
    );

    await queryRunner.query(`DROP TABLE "booking_participants"`);

    // "pending_players" deja de ser un estado de Booking: ahora vive en matchs.need_players.
    await queryRunner.query(`UPDATE "bookings" SET "booking_state" = 'reserved' WHERE "booking_state" = 'pending_players'`);
    await queryRunner.query(`ALTER TYPE "public"."bookings_booking_state_enum" RENAME TO "bookings_booking_state_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."bookings_booking_state_enum" AS ENUM('reserved', 'available', 'paid', 'cancelled')`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_booking_state_enum" USING "booking_state"::"text"::"public"."bookings_booking_state_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_booking_state_enum_old"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TYPE "public"."bookings_booking_state_enum" RENAME TO "bookings_booking_state_enum_old"`);
    await queryRunner.query(`CREATE TYPE "public"."bookings_booking_state_enum" AS ENUM('reserved', 'available', 'paid', 'cancelled', 'pending_players')`);
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_booking_state_enum" USING "booking_state"::"text"::"public"."bookings_booking_state_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."bookings_booking_state_enum_old"`);

    await queryRunner.query(
      `CREATE TABLE "booking_participants" ("id" SERIAL NOT NULL, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "players_count" integer NOT NULL DEFAULT '1', "booking_id" integer, "player_id" integer, CONSTRAINT "UQ_booking_participants_booking_player" UNIQUE ("booking_id", "player_id"), CONSTRAINT "PK_booking_participants_id" PRIMARY KEY ("id"))`,
    );

    await queryRunner.query(
      `INSERT INTO "booking_participants" ("joined_at", "players_count", "booking_id", "player_id")
       SELECT mp.joined_at, mp.players_count, m.booking_id, mp.player_id
       FROM "match_players" mp
       JOIN "matchs" m ON m.id = mp.match_id`,
    );

    await queryRunner.query(
      `UPDATE "bookings" b SET "booking_state" = 'pending_players'
       FROM "matchs" m
       WHERE m.booking_id = b.id AND m.need_players = true`,
    );

    await queryRunner.query(
      `ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_booking_participants_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_booking_participants_player_id" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`DROP TABLE "match_players"`);
    await queryRunner.query(`DROP TABLE "matchs"`);
  }
}
