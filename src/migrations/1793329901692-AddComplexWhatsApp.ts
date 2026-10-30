import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * WhatsApp de contacto de cada complejo (número y mensaje inicial), que lo
 * cargan los administradores desde el panel. Se carga el del club.
 */
export class AddComplexWhatsApp1793329901692 implements MigrationInterface {
    name = 'AddComplexWhatsApp1793329901692'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "complexes" ADD "whatsapp_number" character varying(15)`);
        await queryRunner.query(`ALTER TABLE "complexes" ADD "whatsapp_message" character varying(500)`);
        await queryRunner.query(`UPDATE "complexes" SET "whatsapp_number" = '5492216049987', "whatsapp_message" = 'Hola, quiero hacer una consulta sobre Quento Club.' WHERE "id" = (SELECT MIN("id") FROM "complexes")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "complexes" DROP COLUMN "whatsapp_message"`);
        await queryRunner.query(`ALTER TABLE "complexes" DROP COLUMN "whatsapp_number"`);
    }

}
