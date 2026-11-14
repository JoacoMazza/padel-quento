import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Una cancha queda disponible o dada de baja, como en el DER: los bloqueos
 * temporales (mantenimiento, fuera de servicio) son out_of_services. Las
 * canchas que estaban en mantenimiento o fuera de servicio pasan a disponibles.
 */
export class ReduceCourtStates1794516751856 implements MigrationInterface {
    name = 'ReduceCourtStates1794516751856'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TYPE "public"."courts_state_enum" RENAME TO "courts_state_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."courts_state_enum" AS ENUM('available', 'closed_down')`);
        await queryRunner.query(`ALTER TABLE "courts" ALTER COLUMN "state" TYPE "public"."courts_state_enum" USING (CASE WHEN "state"::"text" IN ('maintenance', 'out_of_service') THEN 'available' ELSE "state"::"text" END)::"public"."courts_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."courts_state_enum_old"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."courts_state_enum_old" AS ENUM('available', 'out_of_service', 'maintenance', 'closed_down')`);
        await queryRunner.query(`ALTER TABLE "courts" ALTER COLUMN "state" TYPE "public"."courts_state_enum_old" USING "state"::"text"::"public"."courts_state_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."courts_state_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."courts_state_enum_old" RENAME TO "courts_state_enum"`);
    }

}
