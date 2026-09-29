import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Alinea el esquema con el DER (docs/der/DER Padel Quento.drawio):
 * - "matchs" pasa a llamarse "matches" (junto con su secuencia y restricciones).
 * - Crea "penalties", que hasta ahora solo existía vía synchronize y no tenía
 *   migración: el jugador se referencia por player_id y se guarda created_at.
 */
export class AlignSchemaWithDer1790100000000 implements MigrationInterface {
  name = "AlignSchemaWithDer1790100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "matchs" RENAME TO "matches"`);
    await queryRunner.query(`ALTER SEQUENCE "matchs_id_seq" RENAME TO "matches_id_seq"`);
    await queryRunner.query(`ALTER TABLE "matches" RENAME CONSTRAINT "PK_matchs_id" TO "PK_matches_id"`);
    await queryRunner.query(
      `ALTER TABLE "matches" RENAME CONSTRAINT "UQ_matchs_booking_id" TO "UQ_matches_booking_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" RENAME CONSTRAINT "FK_matchs_booking_id" TO "FK_matches_booking_id"`,
    );

    await queryRunner.query(
      `CREATE TABLE "penalties" ("id" SERIAL NOT NULL, "penalized_scoring" double precision NOT NULL, "reason" character varying NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "player_id" integer, CONSTRAINT "PK_penalties_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "penalties" ADD CONSTRAINT "FK_penalties_player_id" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "penalties"`);

    await queryRunner.query(
      `ALTER TABLE "matches" RENAME CONSTRAINT "FK_matches_booking_id" TO "FK_matchs_booking_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "matches" RENAME CONSTRAINT "UQ_matches_booking_id" TO "UQ_matchs_booking_id"`,
    );
    await queryRunner.query(`ALTER TABLE "matches" RENAME CONSTRAINT "PK_matches_id" TO "PK_matchs_id"`);
    await queryRunner.query(`ALTER SEQUENCE "matches_id_seq" RENAME TO "matchs_id_seq"`);
    await queryRunner.query(`ALTER TABLE "matches" RENAME TO "matchs"`);
  }
}
