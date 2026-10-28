import { MigrationInterface, QueryRunner } from "typeorm";

const DATA_API_ROLES = ["anon", "authenticated"];

/**
 * Supabase expone las tablas de "public" por su API REST (Data API) a los roles
 * anon y authenticated, y cualquiera con la clave pública del proyecto actúa
 * como ellos. La app no usa esa API (se conecta directo a Postgres), así que se
 * les quitan los permisos sobre las tablas actuales y las que creen migraciones
 * futuras. En Postgres local esos roles no existen y la migración no hace nada.
 */
export class RevokeDataApiAccess1793196789342 implements MigrationInterface {
    name = 'RevokeDataApiAccess1793196789342'

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const role of DATA_API_ROLES) {
            await queryRunner.query(`DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
                    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${role};
                    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM ${role};
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM ${role};
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${role};
                END IF;
            END $$`);
        }
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        for (const role of DATA_API_ROLES) {
            await queryRunner.query(`DO $$ BEGIN
                IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN
                    GRANT ALL ON ALL TABLES IN SCHEMA public TO ${role};
                    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${role};
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${role};
                    ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${role};
                END IF;
            END $$`);
        }
    }

}
