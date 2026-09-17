import { MigrationInterface, QueryRunner } from "typeorm";

export class AddIsBlockedToUsers1789600000000 implements MigrationInterface {
  name = "AddIsBlockedToUsers1789600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_blocked" boolean NOT NULL DEFAULT false`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "is_blocked"`);
  }
}

