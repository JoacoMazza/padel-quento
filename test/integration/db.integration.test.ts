import { afterAll, describe, expect, it } from "vitest";
import { getDataSource } from "@/src/lib/db";

describe("getDataSource (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  it("se conecta y sincroniza el esquema de la tabla users", async () => {
    const dataSource = await getDataSource();
    expect(dataSource.isInitialized).toBe(true);

    const columns: { column_name: string }[] = await dataSource.query(
      "select column_name from information_schema.columns where table_name = 'users'",
    );
    const columnNames = columns.map((c) => c.column_name);

    expect(columnNames).toEqual(
      expect.arrayContaining(["id", "email", "names", "last_names", "role", "type", "password_hashed"]),
    );
  });

  it("reutiliza la misma instancia de DataSource en llamadas sucesivas", async () => {
    const first = await getDataSource();
    const second = await getDataSource();
    expect(first).toBe(second);
  });
});
