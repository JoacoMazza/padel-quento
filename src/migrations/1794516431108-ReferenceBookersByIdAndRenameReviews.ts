import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Turnos y turnos fijos pasan a referenciar a quien reservó por su id
 * (booker_id -> bookers.id) en lugar de por su teléfono, y player_reviews se
 * renombra a players_reviews, como en el DER. Escrita a mano para conservar
 * los datos: booker_id se completa a partir del teléfono y la tabla de
 * calificaciones se renombra en lugar de recrearse.
 */
export class ReferenceBookersByIdAndRenameReviews1794516431108 implements MigrationInterface {
    name = 'ReferenceBookersByIdAndRenameReviews1794516431108'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of ["bookings", "fixed_bookings"]) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_booker_phone_number"`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD "booker_id" integer`);
            await queryRunner.query(`UPDATE "${table}" "t" SET "booker_id" = "b"."id" FROM "bookers" "b" WHERE "b"."phone_number" = "t"."booker_phone_number"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "booker_phone_number"`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_booker_id" FOREIGN KEY ("booker_id") REFERENCES "bookers"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        }

        await queryRunner.query(`ALTER TABLE "player_reviews" RENAME TO "players_reviews"`);
        await queryRunner.query(`ALTER SEQUENCE "player_reviews_id_seq" RENAME TO "players_reviews_id_seq"`);
        await queryRunner.query(`ALTER TYPE "public"."player_reviews_level_enum" RENAME TO "players_reviews_level_enum"`);
        await queryRunner.query(`ALTER TABLE "players_reviews" RENAME CONSTRAINT "PK_player_reviews" TO "PK_b5d448a910c80494210ac5c678f"`);
        for (const suffix of ["match_reviewer_reviewed", "match_id", "reviewer_id", "reviewed_id"]) {
            const prefix = suffix === "match_reviewer_reviewed" ? "UQ" : "FK";
            await queryRunner.query(`ALTER TABLE "players_reviews" RENAME CONSTRAINT "${prefix}_player_reviews_${suffix}" TO "${prefix}_players_reviews_${suffix}"`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const suffix of ["match_reviewer_reviewed", "match_id", "reviewer_id", "reviewed_id"]) {
            const prefix = suffix === "match_reviewer_reviewed" ? "UQ" : "FK";
            await queryRunner.query(`ALTER TABLE "players_reviews" RENAME CONSTRAINT "${prefix}_players_reviews_${suffix}" TO "${prefix}_player_reviews_${suffix}"`);
        }
        await queryRunner.query(`ALTER TABLE "players_reviews" RENAME CONSTRAINT "PK_b5d448a910c80494210ac5c678f" TO "PK_player_reviews"`);
        await queryRunner.query(`ALTER TYPE "public"."players_reviews_level_enum" RENAME TO "player_reviews_level_enum"`);
        await queryRunner.query(`ALTER SEQUENCE "players_reviews_id_seq" RENAME TO "player_reviews_id_seq"`);
        await queryRunner.query(`ALTER TABLE "players_reviews" RENAME TO "player_reviews"`);

        for (const table of ["fixed_bookings", "bookings"]) {
            await queryRunner.query(`ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_booker_id"`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD "booker_phone_number" character varying`);
            await queryRunner.query(`UPDATE "${table}" "t" SET "booker_phone_number" = "b"."phone_number" FROM "bookers" "b" WHERE "b"."id" = "t"."booker_id"`);
            await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "booker_id"`);
            await queryRunner.query(`ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_booker_phone_number" FOREIGN KEY ("booker_phone_number") REFERENCES "bookers"("phone_number") ON DELETE NO ACTION ON UPDATE CASCADE`);
        }
    }
}
