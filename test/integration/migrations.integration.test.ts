import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DataSource } from "typeorm";
import * as entities from "@/src/entities";
import { getDataSource } from "@/src/lib/db";

// The CLI loads migrations from disk; here Vite bundles them so the TS sources run as-is.
const migrationModules = import.meta.glob<Record<string, unknown>>("../../src/migrations/*.ts", { eager: true });
const migrations = Object.values(migrationModules).flatMap((module) =>
  Object.values(module).filter((value): value is new () => object => typeof value === "function"),
);

const CHECK_DATABASE = "padel_quento_migrations_check";
// Roles of Supabase's Data API (PostgREST): anyone holding the project's public key acts as them.
const DATA_API_ROLES = ["anon", "authenticated"];

describe("migraciones (integración con Postgres real)", { timeout: 120000 }, () => {
  let migrated: DataSource;

  beforeAll(async () => {
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
    await admin.query(`CREATE DATABASE ${CHECK_DATABASE}`);
    for (const role of DATA_API_ROLES) {
      await admin.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '${role}') THEN CREATE ROLE ${role} NOLOGIN; END IF; END $$`,
      );
    }

    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${CHECK_DATABASE}`;
    migrated = new DataSource({
      type: "postgres",
      url: url.toString(),
      entities: Object.values(entities),
      migrations,
    });
    await migrated.initialize();
    // Like a new Supabase project: every table created later is granted to the Data API roles.
    await migrated.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${DATA_API_ROLES.join(", ")}`);
    await migrated.runMigrations();
  });

  afterAll(async () => {
    await migrated?.destroy();
    const admin = await getDataSource();
    await admin.query(`DROP DATABASE IF EXISTS ${CHECK_DATABASE}`);
  });

  it("aplicadas sobre una base vacía dejan el mismo esquema que declaran las entidades", async () => {
    const pending = await migrated.driver.createSchemaBuilder().log();

    expect(pending.upQueries.map((q) => q.query)).toEqual([]);
  });

  it("la API pública de Supabase no puede leer ni modificar ninguna tabla", async () => {
    const granted: { table_name: string; grantee: string }[] = await migrated.query(
      `SELECT table_name, grantee FROM information_schema.role_table_grants
       WHERE table_schema = 'public' AND grantee = ANY($1)`,
      [DATA_API_ROLES],
    );

    expect(granted).toEqual([]);
  });

  it("las tablas que creen migraciones futuras tampoco quedan expuestas a la API pública", async () => {
    await migrated.query(`CREATE TABLE future_table (id int)`);

    const granted: { grantee: string }[] = await migrated.query(
      `SELECT grantee FROM information_schema.role_table_grants
       WHERE table_name = 'future_table' AND grantee = ANY($1)`,
      [DATA_API_ROLES],
    );

    expect(granted).toEqual([]);
  });
});
