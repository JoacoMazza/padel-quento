import "reflect-metadata";
import pg from "pg";
import { DataSource } from "typeorm";
import * as entities from "@/src/entities";
import { databaseSsl } from "@/src/lib/db-ssl";

const globalForDb = globalThis as unknown as {
  dataSource?: DataSource;
  dataSourceInit?: Promise<DataSource>;
};

function createDataSource() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copiá .env.example a .env y levantá Postgres.");
  }

  return new DataSource({
    type: "postgres",
    // TypeORM carga pg dinámicamente, y en Vercel solo se incluyen los paquetes
    // importados en el código: sin esto falla con DriverPackageNotInstalledError.
    driver: pg,
    url,
    ssl: databaseSsl(),
    entities: entities,
    // La base es compartida por el equipo: el esquema cambia solo con migraciones
    // corridas a mano (pnpm migration:run), nunca al levantar la app.
    synchronize: false,
    logging: process.env.NODE_ENV === "development",
    // En Vercel cada instancia abre su propio pool: con pocas conexiones por
    // instancia no se agotan las del session pooler de Supabase.
    extra: process.env.VERCEL ? { max: 2 } : undefined,
  });
}

async function initializeDataSource() {
  const dataSource = globalForDb.dataSource ?? createDataSource();
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  globalForDb.dataSource = dataSource;
  return dataSource;
}

export async function getDataSource() {
  if (globalForDb.dataSource?.isInitialized) {
    return globalForDb.dataSource;
  }

  // Los procesos en segundo plano piden la conexión todos juntos al arrancar:
  // comparten la misma inicialización en curso para no crear varias conexiones
  // a la vez. Si falla, se descarta para reintentar.
  globalForDb.dataSourceInit ??= initializeDataSource().finally(() => {
    globalForDb.dataSourceInit = undefined;
  });
  return globalForDb.dataSourceInit;
}
