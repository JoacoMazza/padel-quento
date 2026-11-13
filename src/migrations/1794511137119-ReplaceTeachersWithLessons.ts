import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Clases según el DER: el admin da de alta una clase (lessons) asignando a un
 * jugador como profesor, con sus horarios semanales (lesson_schedules); cada
 * fecha es un turno (bookings.lesson_id) y los alumnos se inscriben en la
 * clase (inscriptions). Reemplaza al rol de profesor (teachers) y a los
 * alumnos por turno (class_students, bookings.class_capacity).
 *
 * Cada turno de clase existente pasa a ser una clase de un solo día con su
 * horario, su cupo, su precio y sus alumnos; queda activa si el turno no
 * estaba cancelado y su profesor seguía activo.
 */
export class ReplaceTeachersWithLessons1794511137119 implements MigrationInterface {
    name = 'ReplaceTeachersWithLessons1794511137119'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "lessons" ("id" SERIAL NOT NULL, "class_capacity" integer NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "from_local_datetime" TIMESTAMP NOT NULL, "to_local_datetime" TIMESTAMP NOT NULL, "price" numeric(10,2) NOT NULL, "teacher_id" integer NOT NULL, CONSTRAINT "CHK_lessons_class_capacity" CHECK ("class_capacity" BETWEEN 1 AND 8), CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."lesson_schedules_day_of_week_enum" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`);
        await queryRunner.query(`CREATE TABLE "lesson_schedules" ("id" SERIAL NOT NULL, "day_of_week" "public"."lesson_schedules_day_of_week_enum" NOT NULL, "start_time" TIME NOT NULL, "end_time" TIME NOT NULL, "lesson_id" integer NOT NULL, "court_id" integer NOT NULL, CONSTRAINT "UQ_lesson_schedules_lesson_day_start" UNIQUE ("lesson_id", "day_of_week", "start_time"), CONSTRAINT "PK_11620e69cb693bb28aa8bf2358f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "inscriptions" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "lesson_id" integer NOT NULL, "player_id" integer NOT NULL, CONSTRAINT "UQ_inscriptions_lesson_player" UNIQUE ("lesson_id", "player_id"), CONSTRAINT "PK_5443e2ee91338d76cac5de12f41" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "lesson_id" integer`);

        // Datos: una clase por cada turno de clase, recordando de qué turno salió.
        await queryRunner.query(`ALTER TABLE "lessons" ADD "legacy_booking_id" integer`);
        await queryRunner.query(`INSERT INTO "lessons" ("teacher_id", "class_capacity", "is_active", "from_local_datetime", "to_local_datetime", "price", "legacy_booking_id")
            SELECT "booker"."id", "booking"."class_capacity",
                   "booking"."booking_state" != 'cancelled' AND COALESCE("teacher"."is_active", false),
                   date_trunc('day', "booking"."datetime"),
                   date_trunc('day', "booking"."datetime") + interval '23 hours 59 minutes',
                   "booking"."price", "booking"."id"
            FROM "bookings" "booking"
            INNER JOIN "bookers" "booker" ON "booker"."phone_number" = "booking"."booker_phone_number"
            LEFT JOIN "teachers" "teacher" ON "teacher"."player_id" = "booker"."id"
            WHERE "booking"."class_capacity" IS NOT NULL`);
        await queryRunner.query(`INSERT INTO "lesson_schedules" ("lesson_id", "court_id", "day_of_week", "start_time", "end_time")
            SELECT "lesson"."id", "booking"."court_id",
                   (ARRAY['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])[EXTRACT(ISODOW FROM "booking"."datetime")]::"public"."lesson_schedules_day_of_week_enum",
                   "booking"."datetime"::time,
                   ("booking"."datetime" + make_interval(mins => "booking"."duration_minutes"))::time
            FROM "lessons" "lesson"
            INNER JOIN "bookings" "booking" ON "booking"."id" = "lesson"."legacy_booking_id"`);
        await queryRunner.query(`UPDATE "bookings" SET "lesson_id" = "lesson"."id" FROM "lessons" "lesson" WHERE "lesson"."legacy_booking_id" = "bookings"."id"`);
        await queryRunner.query(`INSERT INTO "inscriptions" ("lesson_id", "player_id", "created_at")
            SELECT "lesson"."id", "student"."player_id", "student"."created_at"
            FROM "class_students" "student"
            INNER JOIN "lessons" "lesson" ON "lesson"."legacy_booking_id" = "student"."booking_id"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "legacy_booking_id"`);

        await queryRunner.query(`DROP TABLE "class_students"`);
        await queryRunner.query(`DROP TABLE "teachers"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_class_capacity"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "class_capacity"`);

        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_bookings_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inscriptions" ADD CONSTRAINT "FK_inscriptions_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "inscriptions" ADD CONSTRAINT "FK_inscriptions_player_id" FOREIGN KEY ("player_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_teacher_id" FOREIGN KEY ("teacher_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_schedules" ADD CONSTRAINT "FK_lesson_schedules_lesson_id" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "lesson_schedules" ADD CONSTRAINT "FK_lesson_schedules_court_id" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "teachers" ("id" SERIAL NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "player_id" integer NOT NULL, CONSTRAINT "REL_2ab26ff51d54331eec59c249a8" UNIQUE ("player_id"), CONSTRAINT "PK_a8d4f83be3abe4c687b0a0093c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "teachers" ADD CONSTRAINT "FK_2ab26ff51d54331eec59c249a88" FOREIGN KEY ("player_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`CREATE TABLE "class_students" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" integer NOT NULL, "player_id" integer NOT NULL, CONSTRAINT "UQ_class_students_booking_player" UNIQUE ("booking_id", "player_id"), CONSTRAINT "PK_f1ef7a4fd2eabf7ef3c6bc7cae3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "class_students" ADD CONSTRAINT "FK_d5c2f03f346ff6fe4cb48736e48" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "class_students" ADD CONSTRAINT "FK_0436c8dd9bf27e66f061e90d6bc" FOREIGN KEY ("player_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "class_capacity" integer`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_class_capacity" CHECK ("class_capacity" BETWEEN 1 AND 8)`);

        // Datos: cada turno de clase vuelve a tener su cupo y los alumnos de su clase.
        await queryRunner.query(`UPDATE "bookings" SET "class_capacity" = "lesson"."class_capacity" FROM "lessons" "lesson" WHERE "lesson"."id" = "bookings"."lesson_id"`);
        await queryRunner.query(`INSERT INTO "class_students" ("booking_id", "player_id", "created_at")
            SELECT "booking"."id", "inscription"."player_id", "inscription"."created_at"
            FROM "inscriptions" "inscription"
            INNER JOIN "bookings" "booking" ON "booking"."lesson_id" = "inscription"."lesson_id"`);
        await queryRunner.query(`INSERT INTO "teachers" ("player_id", "is_active")
            SELECT "teacher_id", bool_or("is_active") FROM "lessons" GROUP BY "teacher_id"`);

        await queryRunner.query(`ALTER TABLE "lesson_schedules" DROP CONSTRAINT "FK_lesson_schedules_court_id"`);
        await queryRunner.query(`ALTER TABLE "lesson_schedules" DROP CONSTRAINT "FK_lesson_schedules_lesson_id"`);
        await queryRunner.query(`ALTER TABLE "lessons" DROP CONSTRAINT "FK_lessons_teacher_id"`);
        await queryRunner.query(`ALTER TABLE "inscriptions" DROP CONSTRAINT "FK_inscriptions_player_id"`);
        await queryRunner.query(`ALTER TABLE "inscriptions" DROP CONSTRAINT "FK_inscriptions_lesson_id"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_bookings_lesson_id"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "lesson_id"`);
        await queryRunner.query(`DROP TABLE "inscriptions"`);
        await queryRunner.query(`DROP TABLE "lesson_schedules"`);
        await queryRunner.query(`DROP TYPE "public"."lesson_schedules_day_of_week_enum"`);
        await queryRunner.query(`DROP TABLE "lessons"`);
    }

}
