import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingParticipantsPlayersCount1789437264171 implements MigrationInterface {
    name = 'AddBookingParticipantsPlayersCount1789437264171'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_participants" ADD "players_count" integer NOT NULL DEFAULT '1'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_participants" DROP COLUMN "players_count"`);
    }

}
