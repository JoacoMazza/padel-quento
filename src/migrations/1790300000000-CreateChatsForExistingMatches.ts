import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * HU-40: la sala de chat se crea junto con el partido (antes, recién al sumarse
 * un segundo jugador con cuenta). Crea la sala de los partidos existentes que
 * todavía no la tienen, para que también se puedan compartir. Solo datos: el
 * esquema no cambia.
 */
export class CreateChatsForExistingMatches1790300000000 implements MigrationInterface {
  name = "CreateChatsForExistingMatches1790300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "chats" ("match_id")
       SELECT "matches"."id" FROM "matches"
       LEFT JOIN "chats" ON "chats"."match_id" = "matches"."id"
       WHERE "chats"."id" IS NULL`,
    );
  }

  public async down(): Promise<void> {
    // No se borran: no se distingue una sala creada acá de una creada por la app,
    // y una sala con mensajes perdería su historial.
  }
}
