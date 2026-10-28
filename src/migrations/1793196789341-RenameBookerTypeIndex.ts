import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * TypeORM crea solo el índice de la columna discriminadora de bookers (herencia
 * de Player) y no permite elegirle nombre desde la entidad: se le pone el que
 * espera, para que migration:generate no lo vuelva a renombrar en cada cambio.
 */
export class RenameBookerTypeIndex1793196789341 implements MigrationInterface {
    name = 'RenameBookerTypeIndex1793196789341'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "public"."IDX_bookers_type" RENAME TO "IDX_e0d09e7a3ee26f687978fd60a2"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER INDEX "public"."IDX_e0d09e7a3ee26f687978fd60a2" RENAME TO "IDX_bookers_type"`);
    }

}
