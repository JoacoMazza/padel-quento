import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Clases (HU-43 y HU-44): el cupo de alumnos en el turno de clase de un
 * profesor (de 1 a 8; null en cualquier otro turno) y los alumnos registrados.
 */
export class AddClasses1793417798357 implements MigrationInterface {
    name = 'AddClasses1793417798357'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "class_students" ("id" SERIAL NOT NULL, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "booking_id" integer NOT NULL, "player_id" integer NOT NULL, CONSTRAINT "UQ_class_students_booking_player" UNIQUE ("booking_id", "player_id"), CONSTRAINT "PK_f1ef7a4fd2eabf7ef3c6bc7cae3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD "class_capacity" integer`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "CHK_bookings_class_capacity" CHECK ("class_capacity" BETWEEN 1 AND 8)`);
        await queryRunner.query(`ALTER TABLE "class_students" ADD CONSTRAINT "FK_d5c2f03f346ff6fe4cb48736e48" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "class_students" ADD CONSTRAINT "FK_0436c8dd9bf27e66f061e90d6bc" FOREIGN KEY ("player_id") REFERENCES "bookers"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "class_students" DROP CONSTRAINT "FK_0436c8dd9bf27e66f061e90d6bc"`);
        await queryRunner.query(`ALTER TABLE "class_students" DROP CONSTRAINT "FK_d5c2f03f346ff6fe4cb48736e48"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "CHK_bookings_class_capacity"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP COLUMN "class_capacity"`);
        await queryRunner.query(`DROP TABLE "class_students"`);
    }

}
