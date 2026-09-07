import "reflect-metadata";
import path from "node:path";
import { config as loadEnv } from "dotenv";
import { DataSource } from "typeorm";
import * as entities from "@/src/entities";

loadEnv({ path: path.resolve(__dirname, "../../.env") });

if (!process.env.DATABASE_URL) {
  throw new Error("Falta DATABASE_URL. Copiá .env.example a .env y levantá Postgres.");
}

export default new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  entities: Object.values(entities),
  migrations: [path.resolve(__dirname, "../migrations/*.{ts,js}")],
  synchronize: false,
  logging: true,
});
