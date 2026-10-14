import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Nivel de los administradores: dueño (owner) o trabajador (staff). Los
 * administradores que ya existían quedan como dueños, para que nadie pierda
 * acceso; los nuevos arrancan como trabajadores.
 */
export class AddAdminAccessLevel1791995559155 implements MigrationInterface {
    name = 'AddAdminAccessLevel1791995559155'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."admins_access_level_enum" AS ENUM('owner', 'staff')`);
        await queryRunner.query(`ALTER TABLE "admins" ADD "access_level" "public"."admins_access_level_enum" NOT NULL DEFAULT 'staff'`);
        await queryRunner.query(`UPDATE "admins" SET "access_level" = 'owner'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admins" DROP COLUMN "access_level"`);
        await queryRunner.query(`DROP TYPE "public"."admins_access_level_enum"`);
    }

}
