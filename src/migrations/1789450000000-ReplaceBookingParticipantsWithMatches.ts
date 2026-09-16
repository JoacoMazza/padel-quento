import { MigrationInterface, QueryRunner } from "typeorm";

export class ReplaceBookingParticipantsWithMatches1789450000000 implements MigrationInterface {
    name = 'ReplaceBookingParticipantsWithMatches1789450000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "booking_participants"`);

        await queryRunner.query(`CREATE TABLE "matches" ("id" SERIAL NOT NULL, "need_players" boolean NOT NULL DEFAULT true, "booking_id" integer, CONSTRAINT "UQ_matches_booking_id" UNIQUE ("booking_id"), CONSTRAINT "PK_matches_id" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "matches" ADD CONSTRAINT "FK_matches_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);

        await queryRunner.query(`CREATE TABLE "match_players" ("match_id" integer NOT NULL, "player_id" integer NOT NULL, CONSTRAINT "PK_match_players_match_id_player_id" PRIMARY KEY ("match_id", "player_id"))`);
        await queryRunner.query(`ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_match_id" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "match_players" ADD CONSTRAINT "FK_match_players_player_id" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "match_players" DROP CONSTRAINT "FK_match_players_player_id"`);
        await queryRunner.query(`ALTER TABLE "match_players" DROP CONSTRAINT "FK_match_players_match_id"`);
        await queryRunner.query(`DROP TABLE "match_players"`);

        await queryRunner.query(`ALTER TABLE "matches" DROP CONSTRAINT "FK_matches_booking_id"`);
        await queryRunner.query(`DROP TABLE "matches"`);

        await queryRunner.query(`CREATE TABLE "booking_participants" ("id" SERIAL NOT NULL, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "players_count" integer NOT NULL DEFAULT '1', "booking_id" integer, "player_id" integer, CONSTRAINT "UQ_50a396cfcae129e833cc559a691" UNIQUE ("booking_id", "player_id"), CONSTRAINT "PK_9cc32a61bd698b5831f4e5d66e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_d0c6f1f0892061f1cc2d325c1c9" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_6a66d1668325e58b9c73eeeab0c" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

}
