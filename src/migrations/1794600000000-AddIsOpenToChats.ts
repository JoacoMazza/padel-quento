import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Estado abierto/cerrado de la sala de chat de un partido abierto. Las salas
 * existentes quedan abiertas: las de turnos ya terminados o cancelados las
 * cierra closeFinishedChats (src/actions/chat.ts) en su primera corrida, que
 * compara las fechas en la zona horaria del club (datetime no guarda zona).
 */
export class AddIsOpenToChats1794600000000 implements MigrationInterface {
    name = 'AddIsOpenToChats1794600000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chats" ADD "is_open" boolean NOT NULL DEFAULT true`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chats" DROP COLUMN "is_open"`);
    }
}
