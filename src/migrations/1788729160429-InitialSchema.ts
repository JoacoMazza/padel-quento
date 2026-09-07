import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1788729160429 implements MigrationInterface {
    name = 'InitialSchema1788729160429'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."bookings_bookingstate_enum" AS ENUM('reserved', 'available', 'paid', 'cancelled', 'pending_players')`);
        await queryRunner.query(`CREATE TABLE "bookings" ("id" SERIAL NOT NULL, "fromDateTime" TIMESTAMP NOT NULL, "durationMinutes" integer NOT NULL DEFAULT '90', "bookingState" "public"."bookings_bookingstate_enum" NOT NULL, "playerId" integer, "courtId" integer, CONSTRAINT "PK_bee6805982cc1e248e94ce94957" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."courts_state_enum" AS ENUM('available', 'out_of_service', 'maintenance', 'closed_down')`);
        await queryRunner.query(`CREATE TABLE "courts" ("id" SERIAL NOT NULL, "number" integer NOT NULL, "state" "public"."courts_state_enum" NOT NULL, CONSTRAINT "UQ_74a18c6d202c625dd7d68768cdb" UNIQUE ("number"), CONSTRAINT "PK_948a5d356c3083f3237ecbf9897" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."out_of_services_reason_enum" AS ENUM('maintenance', 'free_day', 'cleaning', 'other')`);
        await queryRunner.query(`CREATE TABLE "out_of_services" ("id" SERIAL NOT NULL, "fromDateTime" TIMESTAMP NOT NULL, "toDateTime" TIMESTAMP NOT NULL, "reason" "public"."out_of_services_reason_enum" NOT NULL, "description" character varying(255), "courtId" integer, CONSTRAINT "PK_b58eeefd068653e24ce6f9a2fe5" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "users" ("id" SERIAL NOT NULL, "dni" integer, "email" character varying NOT NULL, "names" character varying NOT NULL, "lastnames" character varying NOT NULL, "phoneNumber" character varying, "role" character varying NOT NULL DEFAULT 'player', "photoUrl" character varying, "passwordHash" character varying NOT NULL, "category" character varying DEFAULT 'without_category', "scoring" double precision DEFAULT '0', "type" character varying NOT NULL, CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_94e2000b5f7ee1f9c491f0f8a8" ON "users"  ("type") `);
        await queryRunner.query(`CREATE TYPE "public"."schedules_dayofweek_enum" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')`);
        await queryRunner.query(`CREATE TABLE "schedules" ("id" SERIAL NOT NULL, "dayOfWeek" "public"."schedules_dayofweek_enum" NOT NULL, "openingTime" TIME NOT NULL DEFAULT '09:00:00', "closingTime" TIME NOT NULL DEFAULT '23:00:00', "courtId" integer, CONSTRAINT "PK_7e33fc2ea755a5765e3564e66dd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_51cff11be4b4695da672218e174" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "bookings" ADD CONSTRAINT "FK_e8e9a995f2078e6c39793a7f16b" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "out_of_services" ADD CONSTRAINT "FK_7570138f8668b3ee2fa8a47f72f" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "schedules" ADD CONSTRAINT "FK_f78b3b8cd4922c8011abef1c2e6" FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "schedules" DROP CONSTRAINT "FK_f78b3b8cd4922c8011abef1c2e6"`);
        await queryRunner.query(`ALTER TABLE "out_of_services" DROP CONSTRAINT "FK_7570138f8668b3ee2fa8a47f72f"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_e8e9a995f2078e6c39793a7f16b"`);
        await queryRunner.query(`ALTER TABLE "bookings" DROP CONSTRAINT "FK_51cff11be4b4695da672218e174"`);
        await queryRunner.query(`DROP TABLE "schedules"`);
        await queryRunner.query(`DROP TYPE "public"."schedules_dayofweek_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_94e2000b5f7ee1f9c491f0f8a8"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TABLE "out_of_services"`);
        await queryRunner.query(`DROP TYPE "public"."out_of_services_reason_enum"`);
        await queryRunner.query(`DROP TABLE "courts"`);
        await queryRunner.query(`DROP TYPE "public"."courts_state_enum"`);
        await queryRunner.query(`DROP TABLE "bookings"`);
        await queryRunner.query(`DROP TYPE "public"."bookings_bookingstate_enum"`);
    }

}
