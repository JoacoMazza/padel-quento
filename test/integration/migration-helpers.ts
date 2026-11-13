import { DataSource } from "typeorm";

// The CLI loads migrations from disk; here Vite bundles them so the TS sources run as-is.
const migrationModules = import.meta.glob<Record<string, unknown>>("../../src/migrations/*.ts", { eager: true });

type MigrationClass = new () => object;

/** Todas las migraciones del repo, ordenadas por su timestamp. */
export const migrations = Object.values(migrationModules)
  .flatMap((module) => Object.values(module).filter((value): value is MigrationClass => typeof value === "function"))
  .sort((a, b) => timestampOf(a) - timestampOf(b));

function timestampOf(migration: MigrationClass): number {
  return Number(migration.name.match(/\d+$/)![0]);
}

/**
 * Las migraciones anteriores a la primera cuyo nombre empieza con `prefix`:
 * arman una base como era antes de esa migración, para probar cómo convierte
 * los datos que ya había.
 */
export function migrationsBefore(prefix: string): MigrationClass[] {
  const first = migrations.find((migration) => migration.name.startsWith(prefix));
  if (!first) throw new Error(`No hay una migración que empiece con ${prefix}`);
  return migrations.filter((migration) => timestampOf(migration) < timestampOf(first));
}

/** Conexión a otra base del Postgres de test, con las migraciones elegidas. */
export function migrationDataSource(database: string, selected: MigrationClass[]): DataSource {
  const url = new URL(process.env.DATABASE_URL!);
  url.pathname = `/${database}`;
  return new DataSource({ type: "postgres", url: url.toString(), migrations: selected });
}
