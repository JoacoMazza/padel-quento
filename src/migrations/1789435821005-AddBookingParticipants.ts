import { MigrationInterface, QueryRunner } from "typeorm";

export class AddBookingParticipants1789435821005 implements MigrationInterface {
    name = 'AddBookingParticipants1789435821005'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "booking_participants" ("id" SERIAL NOT NULL, "joined_at" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" integer, "player_id" integer, CONSTRAINT "UQ_50a396cfcae129e833cc559a691" UNIQUE ("booking_id", "player_id"), CONSTRAINT "PK_9cc32a61bd698b5831f4e5d66e8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_d0c6f1f0892061f1cc2d325c1c9" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "booking_participants" ADD CONSTRAINT "FK_6a66d1668325e58b9c73eeeab0c" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "booking_participants" DROP CONSTRAINT "FK_6a66d1668325e58b9c73eeeab0c"`);
        await queryRunner.query(`ALTER TABLE "booking_participants" DROP CONSTRAINT "FK_d0c6f1f0892061f1cc2d325c1c9"`);
        await queryRunner.query(`DROP TABLE "booking_participants"`);
    }

}
