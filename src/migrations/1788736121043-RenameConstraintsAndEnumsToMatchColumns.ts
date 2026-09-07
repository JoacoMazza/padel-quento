import { MigrationInterface, QueryRunner } from "typeorm";

export class RenameConstraintsAndEnumsToMatchColumns1788736121043 implements MigrationInterface {
    name = 'RenameConstraintsAndEnumsToMatchColumns1788736121043'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_51cff11be4b4695da672218e174"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_e8e9a995f2078e6c39793a7f16b"`);
        await queryRunner.query(`ALTER TABLE "out_of_services" DROP CONSTRAINT "FK_7570138f8668b3ee2fa8a47f72f"`);
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_f78b3b8cd4922c8011abef1c2e6"`);
        await queryRunner.query(`ALTER TYPE "public"."bookings_bookingstate_enum" RENAME TO "bookings_bookingstate_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_booking_state_enum" AS ENUM('reserved', 'available', 'paid', 'cancelled', 'pending_players')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_booking_state_enum" USING "booking_state"::"text"::"public"."bookings_booking_state_enum"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_bookingstate_enum_old"`);
        await queryRunner.query(`ALTER TYPE "public"."schedules_dayofweek_enum" RENAME TO "schedules_dayofweek_enum_old"`);
        await queryRunner.query(`CREATE TYPE "public"."schedules_day_of_week_enum" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`);
        await queryRunner.query(`ALTER TABLE "schedules" ALTER COLUMN "day_of_week" TYPE "public"."schedules_day_of_week_enum" USING "day_of_week"::"text"::"public"."schedules_day_of_week_enum"`);
        await queryRunner.query(`DROP TYPE "public"."schedules_dayofweek_enum_old"`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_129e7fe11e40d931c7bfdcf7e04" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_2bd7e9c03db9f51a4765974abb8" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "out_of_services" ADD CONSTRAINT "FK_7ce1ea2d4d6a36066dee3814411" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schedules" ADD CONSTRAINT "FK_c8848897087779f4e5cdb2bd8ee" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_c8848897087779f4e5cdb2bd8ee"`);
        await queryRunner.query(`ALTER TABLE "out_of_services" DROP CONSTRAINT "FK_7ce1ea2d4d6a36066dee3814411"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_2bd7e9c03db9f51a4765974abb8"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_129e7fe11e40d931c7bfdcf7e04"`);
        await queryRunner.query(`CREATE TYPE "public"."schedules_dayofweek_enum_old" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`);
        await queryRunner.query(`ALTER TABLE "schedules" ALTER COLUMN "day_of_week" TYPE "public"."schedules_dayofweek_enum_old" USING "day_of_week"::"text"::"public"."schedules_dayofweek_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."schedules_day_of_week_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."schedules_dayofweek_enum_old" RENAME TO "schedules_dayofweek_enum"`);
        await queryRunner.query(`CREATE TYPE "public"."bookings_bookingstate_enum_old" AS ENUM('reserved', 'available', 'paid', 'cancelled', 'pending_players')`);
        await queryRunner.query(`ALTER TABLE "bookings" ALTER COLUMN "booking_state" TYPE "public"."bookings_bookingstate_enum_old" USING "booking_state"::"text"::"public"."bookings_bookingstate_enum_old"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_booking_state_enum"`);
        await queryRunner.query(`ALTER TYPE "public"."bookings_bookingstate_enum_old" RENAME TO "bookings_bookingstate_enum"`);
        await queryRunner.query(`ALTER TABLE "schedules" ADD CONSTRAINT "FK_f78b3b8cd4922c8011abef1c2e6" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "out_of_services" ADD CONSTRAINT "FK_7570138f8668b3ee2fa8a47f72f" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_e8e9a995f2078e6c39793a7f16b" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_51cff11be4b4695da672218e174" FOREIGN KEY ("player_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

}
