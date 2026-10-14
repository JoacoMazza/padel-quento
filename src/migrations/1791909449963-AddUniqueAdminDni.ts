import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * El DNI de los administradores no se puede repetir. La columna sigue siendo
 * nullable por los administradores anteriores a que fuera obligatorio: un
 * índice único en Postgres no considera repetidos los NULL.
 */
export class AddUniqueAdminDni1791909449963 implements MigrationInterface {
    name = 'AddUniqueAdminDni1791909449963'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE UNIQUE INDEX "UQ_admins_dni" ON "admins" ("dni")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."UQ_admins_dni"`);
    }

}
