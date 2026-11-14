import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Turnos y asistencia como en el DER. Escrita a mano para convertir los datos:
 * - booking_state queda reserved / finished / cancelled. "paid" pasa a
 *   is_paid, y los turnos que el job de asistencia ya procesó
 *   (points_awarded) quedan finalizados. Los de una clase se crearon como
 *   procesados para que no movieran puntos: siguen reservados y el job los
 *   finaliza al terminar.
 * - La asistencia sale de los turnos: una inasistencia es una penalización
 *   ligada a su turno (penalties.booking_id). Las que el job ya descontó se
 *   ligan a su turno; las marcadas que todavía no procesó se descuentan ahora
 *   (20 puntos por ausente, sin bajar el saldo de 0), como hace ahora el admin.
 * - En un partido, match_players.attended pasa a attended_count (cuántos del
 *   grupo asistieron) y points_awarded guarda los puntos que el job acreditó
 *   (10 por asistencia, más 5 a quien se sumó al partido de otro).
 */
export class MoveAttendanceToPenaltiesAndFinishBookings1794517586889 implements MigrationInterface {
    name = 'MoveAttendanceToPenaltiesAndFinishBookings1794517586889'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookings" ADD "is_paid" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "match_players" ADD "attended_count" integer NOT NULL DEFAULT '1'`);
        await queryRunner.query(`ALTER TABLE "match_players" ADD "points_awarded" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`ALTER TABLE "penalties" ADD "booking_id" integer`);
        await queryRunner.query(`ALTER TABLE "penalties" ADD CONSTRAINT "FK_penalties_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);

        await queryRunner.query(`UPDATE "bookings" SET "is_paid" = true WHERE "booking_state" = 'paid'`);
        await queryRunner.query(`UPDATE "match_players" SET "attended_count" = CASE WHEN "attended" THEN "players_count" ELSE 0 END`);
        await queryRunner.query(`UPDATE "match_players" "mp" SET "points_awarded" = 10 + CASE WHEN "mp"."player_id" IS DISTINCT FROM "b"."booker_id" THEN 5 ELSE 0 END
            FROM "matches" "m" INNER JOIN "bookings" "b" ON "b"."id" = "m"."booking_id"
            WHERE "m"."id" = "mp"."match_id" AND "mp"."attended" AND "b"."points_awarded" AND "b"."booking_state" <> 'cancelled'`);

        // Inasistencias: quien reservó un turno sin partido, o cada jugador de un partido.
        await queryRunner.query(`CREATE TEMPORARY TABLE "absences" AS
            SELECT "b"."id" AS "booking_id", "b"."booker_id" AS "player_id", 1 AS "absent_count", "b"."points_awarded" AS "processed", "b"."datetime"
              FROM "bookings" "b"
             WHERE NOT "b"."attended" AND "b"."booking_state" <> 'cancelled' AND "b"."booker_id" IS NOT NULL
               AND NOT EXISTS (SELECT 1 FROM "matches" "m" WHERE "m"."booking_id" = "b"."id")
            UNION ALL
            SELECT "b"."id", "mp"."player_id", "mp"."players_count", "b"."points_awarded", "b"."datetime"
              FROM "match_players" "mp"
              INNER JOIN "matches" "m" ON "m"."id" = "mp"."match_id"
              INNER JOIN "bookings" "b" ON "b"."id" = "m"."booking_id"
             WHERE NOT "mp"."attended" AND "b"."booking_state" <> 'cancelled'`);
        await queryRunner.query(`DO $$
            DECLARE
                absence RECORD;
                penalty_id integer;
                balance double precision;
                amount double precision;
            BEGIN
                FOR absence IN SELECT * FROM "absences" ORDER BY "datetime", "booking_id", "player_id" LOOP
                    IF absence."processed" THEN
                        -- El job ya la descontó: se liga la primera penalización libre posterior al turno.
                        SELECT "id" INTO penalty_id FROM "penalties"
                         WHERE "player_id" = absence."player_id" AND "booking_id" IS NULL
                           AND "reason" = 'Inasistencia a turno reservado' AND "created_at" >= absence."datetime"
                         ORDER BY "created_at", "id" LIMIT 1;
                        IF penalty_id IS NOT NULL THEN
                            UPDATE "penalties" SET "booking_id" = absence."booking_id" WHERE "id" = penalty_id;
                        END IF;
                    ELSE
                        SELECT COALESCE(SUM("penalized_scoring"), 0) INTO balance FROM "penalties" WHERE "player_id" = absence."player_id";
                        amount := -LEAST(20 * absence."absent_count", GREATEST(balance, 0));
                        INSERT INTO "penalties" ("player_id", "penalized_scoring", "reason", "booking_id")
                        VALUES (absence."player_id", amount, 'Inasistencia a turno reservado', absence."booking_id");
                        UPDATE "bookers" SET "scoring" = balance + amount WHERE "id" = absence."player_id";
                    END IF;
                END LOOP;
            END $$`);
        await queryRunner.query(`DROP TABLE "absences"`);

        await queryRunner.query(`ALTER TYPE "public"."bookings_booking_state_enum" RENAME TO "bookings_booking_state_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_booking_state_enum" AS ENUM('reserved', 'finished', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_booking_state_enum" USING (CASE
                WHEN "booking_state"::"text" = 'cancelled' THEN 'cancelled'
                WHEN "points_awarded" AND "lesson_id" IS NULL THEN 'finished'
                ELSE 'reserved' END)::"public"."bookings_booking_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_booking_state_enum_old"`);

        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "attended"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "points_awarded"`);
        await queryRunner.query(`ALTER TABLE "match_players" DROP COLUMN "attended"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Las penalizaciones que descontó up se conservan (son parte del historial de puntos).
        await queryRunner.query(`ALTER TABLE "match_players" ADD "attended" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "points_awarded" boolean NOT NULL DEFAULT false`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "attended" boolean NOT NULL DEFAULT true`);
        await queryRunner.query(`UPDATE "match_players" SET "attended" = "attended_count" > 0`);
        await queryRunner.query(`UPDATE "bookings" "b" SET "attended" = NOT EXISTS (
                SELECT 1 FROM "penalties" "p" WHERE "p"."booking_id" = "b"."id" AND "p"."reason" = 'Inasistencia a turno reservado'),
            "points_awarded" = "b"."booking_state" = 'finished' OR "b"."lesson_id" IS NOT NULL`);

        await queryRunner.query(`ALTER TYPE "public"."bookings_booking_state_enum" RENAME TO "bookings_booking_state_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_booking_state_enum" AS ENUM('reserved', 'available', 'paid', 'cancelled')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_booking_state_enum" USING (CASE
                WHEN "booking_state"::"text" = 'cancelled' THEN 'cancelled'
                WHEN "is_paid" THEN 'paid'
                ELSE 'reserved' END)::"public"."bookings_booking_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_booking_state_enum_old"`);

        await queryRunner.query(`ALTER TABLE "penalties" DROP CONSTRAINT "FK_penalties_booking_id"`);
        await queryRunner.query(`ALTER TABLE "penalties" DROP COLUMN "booking_id"`);
        await queryRunner.query(`ALTER TABLE "match_players" DROP COLUMN "points_awarded"`);
        await queryRunner.query(`ALTER TABLE "match_players" DROP COLUMN "attended_count"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "is_paid"`);
    }
}
