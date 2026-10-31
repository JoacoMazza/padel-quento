import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Profesores (HU-42): el rol de profesor de un jugador, que el administrador
 * puede desactivar o quitar.
 */
export class AddTeachers1793414211013 implements MigrationInterface {
    name = 'AddTeachers1793414211013'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "teachers" ("id" SERIAL NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "player_id" integer NOT NULL, CONSTRAINT "REL_2ab26ff51d54331eec59c249a8" UNIQUE ("player_id"), CONSTRAINT "PK_a8d4f83be3abe4c687b0a0093c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "FK_2ab26ff51d54331eec59c249a88" FOREIGN KEY ("player_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "teachers" DROP CONSTRAINT "FK_2ab26ff51d54331eec59c249a88"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
    }

}
