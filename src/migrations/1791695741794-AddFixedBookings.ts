import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Turnos fijos (HU-41): `fixed_bookings` guarda cada turno fijo y
 * `fixed_booking_dates` cada fecha generada con su turno en `bookings`. No toca
 * tablas existentes: las fechas se reservan como turnos comunes.
 */
export class AddFixedBookings1791695741794 implements MigrationInterface {
    name = 'AddFixedBookings1791695741794'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."fixed_bookings_frequency_enum" AS ENUM('weekly', 'biweekly')`);
        await queryRunner.query(`CREATE TABLE "fixed_bookings" ("id" SERIAL NOT NULL, "start_date" date NOT NULL, "end_date" date, "start_time" TIME NOT NULL, "duration_minutes" integer NOT NULL DEFAULT '90', "frequency" "public"."fixed_bookings_frequency_enum" NOT NULL, "is_active" boolean NOT NULL DEFAULT true, "created_at" TIMESTAMP NOT NULL DEFAULT now(), "court_id" integer, "booker_phone_number" character varying, CONSTRAINT "PK_fixed_bookings" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."fixed_booking_dates_state_enum" AS ENUM('booked', 'released', 'conflict')`);
        await queryRunner.query(`CREATE TABLE "fixed_booking_dates" ("id" SERIAL NOT NULL, "date" date NOT NULL, "state" "public"."fixed_booking_dates_state_enum" NOT NULL, "fixed_booking_id" integer, "booking_id" integer, CONSTRAINT "UQ_fixed_booking_dates_fixed_booking_id_date" UNIQUE ("fixed_booking_id", "date"), CONSTRAINT "UQ_fixed_booking_dates_booking_id" UNIQUE ("booking_id"), CONSTRAINT "PK_fixed_booking_dates" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "fixed_bookings" ADD CONSTRAINT "FK_fixed_bookings_court_id" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fixed_bookings" ADD CONSTRAINT "FK_fixed_bookings_booker_phone_number" FOREIGN KEY ("booker_phone_number") REFERENCES "bookers"("phone_number") ON DELETE NO ACTION ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "fixed_booking_dates" ADD CONSTRAINT "FK_fixed_booking_dates_fixed_booking_id" FOREIGN KEY ("fixed_booking_id") REFERENCES "fixed_bookings"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "fixed_booking_dates" ADD CONSTRAINT "FK_fixed_booking_dates_booking_id" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "fixed_booking_dates" DROP CONSTRAINT "FK_fixed_booking_dates_booking_id"`);
        await queryRunner.query(`ALTER TABLE "fixed_booking_dates" DROP CONSTRAINT "FK_fixed_booking_dates_fixed_booking_id"`);
        await queryRunner.query(`ALTER TABLE "fixed_bookings" DROP CONSTRAINT "FK_fixed_bookings_booker_phone_number"`);
        await queryRunner.query(`ALTER TABLE "fixed_bookings" DROP CONSTRAINT "FK_fixed_bookings_court_id"`);
        await queryRunner.query(`DROP TABLE "fixed_booking_dates"`);
        await queryRunner.query(`DROP TYPE "public"."fixed_booking_dates_state_enum"`);
        await queryRunner.query(`DROP TABLE "fixed_bookings"`);
        await queryRunner.query(`DROP TYPE "public"."fixed_bookings_frequency_enum"`);
    }

}
