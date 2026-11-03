import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * País de cada complejo, obligatorio. Los complejos que ya existían (el del
 * club) están en Argentina.
 */
export class AddComplexCountry1793413526758 implements MigrationInterface {
    name = 'AddComplexCountry1793413526758'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "complexes" ADD "country" character varying(100)`);
        await queryRunner.query(`UPDATE "complexes" SET "country" = 'Argentina'`);
        await queryRunner.query(`ALTER TABLE "complexes" ALTER COLUMN "country" SET NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "complexes" DROP COLUMN "country"`);
    }

}
