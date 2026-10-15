import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Reseñas entre compañeros de partido (HU-36): `player_reviews`. No toca
 * tablas existentes; la reputación se calcula a partir de estas filas.
 */
export class AddPlayerReviews1791824557394 implements MigrationInterface {
    name = 'AddPlayerReviews1791824557394'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."player_reviews_level_enum" AS ENUM('lower', 'as_declared', 'higher')`);
        await queryRunner.query(`CREATE TABLE "player_reviews" ("id" SERIAL NOT NULL, "level" "public"."player_reviews_level_enum" NOT NULL, "good_attitude" boolean NOT NULL, "on_time" boolean NOT NULL, "comment" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "match_id" integer, "reviewer_id" integer, "reviewed_id" integer, CONSTRAINT "UQ_player_reviews_match_reviewer_reviewed" UNIQUE ("match_id", "reviewer_id", "reviewed_id"), CONSTRAINT "PK_player_reviews" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "player_reviews" ADD CONSTRAINT "FK_player_reviews_match_id" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "player_reviews" ADD CONSTRAINT "FK_player_reviews_reviewer_id" FOREIGN KEY ("reviewer_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "player_reviews" ADD CONSTRAINT "FK_player_reviews_reviewed_id" FOREIGN KEY ("reviewed_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "player_reviews" DROP CONSTRAINT "FK_player_reviews_reviewed_id"`);
        await queryRunner.query(`ALTER TABLE "player_reviews" DROP CONSTRAINT "FK_player_reviews_reviewer_id"`);
        await queryRunner.query(`ALTER TABLE "player_reviews" DROP CONSTRAINT "FK_player_reviews_match_id"`);
        await queryRunner.query(`DROP TABLE "player_reviews"`);
        await queryRunner.query(`DROP TYPE "public"."player_reviews_level_enum"`);
    }

}
