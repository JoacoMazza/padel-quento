import { MigrationInterface, QueryRunner } from "typeorm";

export class MakeLessonEndDateOptional1794514574183 implements MigrationInterface {
    name = 'MakeLessonEndDateOptional1794514574183'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "to_local_datetime" DROP NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Las clases sin fecha de fin terminan con su último turno (o el día en que empiezan, si no tienen).
        await queryRunner.query(`UPDATE "lessons" "l" SET "to_local_datetime" = COALESCE(
                (SELECT MAX("b"."datetime" + make_interval(mins => "b"."duration_minutes")) FROM "bookings" "b" WHERE "b"."lesson_id" = "l"."id"),
                "l"."from_local_datetime")
            WHERE "l"."to_local_datetime" IS NULL`);
        await queryRunner.query(`ALTER TABLE "lessons" ALTER COLUMN "to_local_datetime" SET NOT NULL`);
    }

}
