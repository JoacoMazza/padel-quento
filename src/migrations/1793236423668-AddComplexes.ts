import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Complejos (con su ubicación) y la cancha de cada uno: courts.complex_id es
 * obligatoria. Se crea el complejo del club con sus datos y se le asignan las
 * canchas que ya existían, sin tocar sus turnos.
 */
export class AddComplexes1793236423668 implements MigrationInterface {
    name = 'AddComplexes1793236423668'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "complexes" ("id" SERIAL NOT NULL, "name" character varying(100) NOT NULL, "address" character varying(255) NOT NULL, "city" character varying(100) NOT NULL, "province" character varying(100) NOT NULL, "postal_code" character varying(10) NOT NULL, "latitude" numeric(9,6) NOT NULL, "longitude" numeric(9,6) NOT NULL, "maps_url" character varying(500), CONSTRAINT "CHK_complexes_longitude" CHECK ("longitude" BETWEEN -180 AND 180), CONSTRAINT "CHK_complexes_latitude" CHECK ("latitude" BETWEEN -90 AND 90), CONSTRAINT "PK_827279403de1d9e761e247e03fd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`INSERT INTO "complexes" ("name", "address", "city", "province", "postal_code", "latitude", "longitude", "maps_url") VALUES ('Quento Club', 'Cam. Centenario 8907', 'Villa Elisa', 'Buenos Aires', 'B1894', -34.863726, -58.061057, 'https://maps.app.goo.gl/G4LpSDfyxCWAJHDSA')`);
        await queryRunner.query(`ALTER TABLE "courts" ADD "complex_id" integer`);
        await queryRunner.query(`UPDATE "courts" SET "complex_id" = (SELECT MIN("id") FROM "complexes")`);
        await queryRunner.query(`ALTER TABLE "courts" ALTER COLUMN "complex_id" SET NOT NULL`);
        await queryRunner.query(`ALTER TABLE "courts" ADD CONSTRAINT "FK_1c0f5b3611b033c05bb4905dc97" FOREIGN KEY ("complex_id") REFERENCES "complexes"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "courts" DROP CONSTRAINT "FK_1c0f5b3611b033c05bb4905dc97"`);
        await queryRunner.query(`ALTER TABLE "courts" DROP COLUMN "complex_id"`);
        await queryRunner.query(`DROP TABLE "complexes"`);
    }

}
