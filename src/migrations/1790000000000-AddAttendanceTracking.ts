import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAttendanceTracking1790000000000 implements MigrationInterface {
  name = "AddAttendanceTracking1790000000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "attended" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "points_awarded" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "match_players" ADD "attended" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "match_players" DROP COLUMN "attended"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "points_awarded"`);
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "attended"`);
  }
}
