import "reflect-metadata";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import { Player } from "../../src/entities/Player";
import { User } from "../../src/entities/User";

export default async function globalSetup() {
  loadEnv({ path: path.resolve(__dirname, "../../.env.test"), quiet: true });

  if (!process.env.DATABASE_URL) {
    throw new Error(
      "Falta DATABASE_URL para los tests de integración. Copiá .env.test.example a .env.test " +
        "y levantá `docker compose -f docker-compose.test.yml up -d` antes de correr `pnpm test:integration`.",
    );
  }

  const dataSource = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities: [User, Player],
    synchronize: true,
    dropSchema: true,
  });

  try {
    await dataSource.initialize();
  } catch (error) {
    throw new Error(
      `No se pudo conectar a la base de datos de test (${process.env.DATABASE_URL}). ` +
        "¿Está corriendo `docker compose -f docker-compose.test.yml up -d`?\n" +
        String(error),
    );
  }

  await dataSource.destroy();
}
