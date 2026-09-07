import "reflect-metadata";
import { DataSource } from "typeorm";
import * as entities from "@/src/entities";

const globalForDb = globalThis as unknown as {
  dataSource?: DataSource;
};

function createDataSource() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("Falta DATABASE_URL. Copiá .env.example a .env y levantá Postgres.");
  }

  return new DataSource({
    type: "postgres",
    url,
    entities: entities,
    synchronize: process.env.NODE_ENV !== "production",
    logging: process.env.NODE_ENV === "development",
  });
}

export async function getDataSource() {
  if (globalForDb.dataSource?.isInitialized) {
    return globalForDb.dataSource;
  }

  const dataSource = globalForDb.dataSource ?? createDataSource();
  if (!dataSource.isInitialized) {
    await dataSource.initialize();
  }
  globalForDb.dataSource = dataSource;
  return dataSource;
}
