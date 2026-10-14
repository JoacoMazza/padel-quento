import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Mensajes de la sala de chat de un partido abierto (historia "Privacidad y
 * anonimato en el chat"). Cada mensaje referencia al jugador que lo envió
 * (sender_id) y a la sala (chat_id); se borran en cascada con la sala o con el
 * jugador. Los datos de contacto del jugador no se copian acá: al leer los
 * mensajes solo se expone su nombre y categoría.
 */
export class AddMessages1789800000000 implements MigrationInterface {
  name = "AddMessages1789800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "messages" ("id" SERIAL NOT NULL, "content" text NOT NULL, "sent_at" TIMESTAMP NOT NULL DEFAULT now(), "chat_id" integer, "sender_id" integer, CONSTRAINT "PK_messages_id" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(`CREATE INDEX "IDX_messages_chat_id" ON "messages" ("chat_id")`);
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_chat_id" FOREIGN KEY ("chat_id") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_sender_id" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "messages"`);
  }
}
