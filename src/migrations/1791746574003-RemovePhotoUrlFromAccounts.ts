import { MigrationInterface, QueryRunner } from "typeorm";

export class RemovePhotoUrlFromAccounts1791746574003 implements MigrationInterface {
  name = "RemovePhotoUrlFromAccounts1791746574003";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" DROP COLUMN "photo_url"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "accounts" ADD "photo_url" character varying`);
  }
}
