import { MigrationInterface, QueryRunner } from "typeorm";

export class AddCreatedAtToOutOfService1788916514031 implements MigrationInterface {
    name = 'AddCreatedAtToOutOfService1788916514031'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "out_of_services" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "out_of_services" DROP COLUMN "created_at"`);
    }

}
