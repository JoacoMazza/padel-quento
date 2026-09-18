import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Sala de chat temporal de un partido abierto (historia "Creación automática de
 * sala de chat temporal"): una fila por match, creada la primera vez que se suma
 * un segundo jugador con cuenta propia (ver joinOpenMatch en src/actions/booking.ts).
 * match_id es único porque a lo sumo hay una sala por partido, y se borra en cascada
 * si el match se borra.
 */
export class AddChats1789700000000 implements MigrationInterface {
  name = "AddChats1789700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "chats" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "match_id" integer, CONSTRAINT "UQ_chats_match_id" UNIQUE ("match_id"), CONSTRAINT "PK_chats_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "chats" ADD CONSTRAINT "FK_chats_match_id" FOREIGN KEY ("match_id") REFERENCES "matchs"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "chats"`);
  }
}
