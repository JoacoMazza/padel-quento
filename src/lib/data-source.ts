import "reflect-metadata";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import * as entities from "@/src/entities";
import { applyClubTimeZone } from "@/src/lib/club-time-zone";
import { databaseSsl } from "@/src/lib/db-ssl";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

// Los seeds y los comandos de TypeORM corren fuera de Next (sin instrumentation.ts)
// y tienen que escribir los timestamps con la misma zona que la app.
applyClubTimeZone();

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copiá .env.example a .env y levantá Postgres.");
}

const dataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  ssl: databaseSsl(),
  entities: Object.values(entities),
  migrations: [path.resolve(__dirname, "../migrations/*.{ts,js}")],
  synchronize: false,
  logging: true,
});

export default dataSource;
