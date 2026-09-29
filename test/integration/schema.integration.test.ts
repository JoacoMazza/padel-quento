import { afterAll, describe, expect, it } from "vitest";
import { getDataSource } from "@/src/lib/db";

// La DB de test se crea con synchronize a partir de las entidades, así que estos
// tests verifican que los nombres de tablas, columnas y restricciones de las
// entidades coincidan con el DER (docs/der) y con las migraciones.
describe("schema alineado con el DER (integración con Postgres real)", () => {
  afterAll(async () => {
    const dataSource = await getDataSource();
    await dataSource.destroy();
  });

  async function columnsOf(table: string): Promise<string[]> {
    const dataSource = await getDataSource();
    const rows: { column_name: string }[] = await dataSource.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
      [table],
    );
    return rows.map((row) => row.column_name);
  }

  it("la tabla de partidos se llama matches", async () => {
    expect(await columnsOf("matches")).toEqual(expect.arrayContaining(["id", "booking_id", "need_players"]));
    expect(await columnsOf("matchs")).toEqual([]);
  });

  it("penalties referencia al jugador solo por player_id y guarda created_at", async () => {
    const columns = await columnsOf("penalties");

    expect(columns).toEqual(
      expect.arrayContaining(["id", "player_id", "penalized_scoring", "reason", "created_at"]),
    );
    expect(columns).not.toContain("playerId");
    expect(columns).not.toContain("createdAt");
  });

  it("match_players tiene la restricción única nombrada UQ_match_players_match_player", async () => {
    const dataSource = await getDataSource();
    const rows: { conname: string }[] = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE conrelid = 'match_players'::regclass AND contype = 'u'`,
    );

    expect(rows.map((row) => row.conname)).toContain("UQ_match_players_match_player");
  });

  it("messages tiene el índice nombrado IDX_messages_chat_id", async () => {
    const dataSource = await getDataSource();
    const rows: { indexname: string }[] = await dataSource.query(
      `SELECT indexname FROM pg_indexes WHERE tablename = 'messages'`,
    );

    expect(rows.map((row) => row.indexname)).toContain("IDX_messages_chat_id");
  });
});
