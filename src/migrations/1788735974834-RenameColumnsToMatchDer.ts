import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Alinea los nombres de columna con el DER (docs/der/DER Padel Quento.png).
 * Usa RENAME COLUMN en vez de recrear columnas para no perder datos existentes.
 */
export class RenameColumnsToMatchDer1788735974834 implements MigrationInterface {
  name = "RenameColumnsToMatchDer1788735974834";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "lastnames" TO "last_names"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "phoneNumber" TO "phone_number"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "photoUrl" TO "photo_url"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hashed"`);

    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "fromDateTime" TO "datetime"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "durationMinutes" TO "duration_minutes"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "bookingState" TO "booking_state"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "playerId" TO "player_id"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "courtId" TO "court_id"`);

    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "dayOfWeek" TO "day_of_week"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "openingTime" TO "opening_time"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "closingTime" TO "closing_time"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "courtId" TO "court_id"`);

    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "fromDateTime" TO "from_datetime"`);
    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "toDateTime" TO "to_datetime"`);
    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "courtId" TO "court_id"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "court_id" TO "courtId"`);
    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "to_datetime" TO "toDateTime"`);
    await queryRunner.query(`ALTER TABLE "out_of_services" RENAME COLUMN "from_datetime" TO "fromDateTime"`);

    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "court_id" TO "courtId"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "closing_time" TO "closingTime"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "opening_time" TO "openingTime"`);
    await queryRunner.query(`ALTER TABLE "schedules" RENAME COLUMN "day_of_week" TO "dayOfWeek"`);

    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "court_id" TO "courtId"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "player_id" TO "playerId"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "booking_state" TO "bookingState"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "duration_minutes" TO "durationMinutes"`);
    await queryRunner.query(`ALTER TABLE "bookings" RENAME COLUMN "datetime" TO "fromDateTime"`);

    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "password_hashed" TO "passwordHash"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "photo_url" TO "photoUrl"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "phone_number" TO "phoneNumber"`);
    await queryRunner.query(`ALTER TABLE "users" RENAME COLUMN "last_names" TO "lastnames"`);
  }
}
