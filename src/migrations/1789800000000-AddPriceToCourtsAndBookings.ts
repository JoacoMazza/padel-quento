import { MigrationInterface, QueryRunner } from "typeorm";

export class AddPriceToCourtsAndBookings1789800000000 implements MigrationInterface {
  name = "AddPriceToCourtsAndBookings1789800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "courts" ADD "price" numeric(10,2) NOT NULL DEFAULT 10000`,
    );
    await queryRunner.query(
      `ALTER TABLE "courts" ALTER COLUMN "price" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ADD "price" numeric(10,2) NOT NULL DEFAULT 10000`,
    );
    await queryRunner.query(
      `ALTER TABLE "bookings" ALTER COLUMN "price" DROP DEFAULT`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "price"`);
    await queryRunner.query(`ALTER TABLE "courts" DROP COLUMN "price"`);
  }
}
