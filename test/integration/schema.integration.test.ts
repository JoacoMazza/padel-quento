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

  it("las cuentas se dividen en accounts, admins, players y bookers, y ya no existe users", async () => {
    expect(await columnsOf("accounts")).toEqual(
      expect.arrayContaining(["id", "email", "photo_url", "password_hashed", "is_blocked"]),
    );
    expect(await columnsOf("admins")).toEqual(
      expect.arrayContaining(["id", "account_id", "dni", "names", "last_names"]),
    );
    expect(await columnsOf("players")).toEqual(
      expect.arrayContaining(["id", "account_id", "booker_id", "category", "scoring"]),
    );
    expect(await columnsOf("bookers")).toEqual(
      expect.arrayContaining(["id", "names", "last_names", "phone_number"]),
    );
    expect(await columnsOf("users")).toEqual([]);
  });

  it("bookings referencia a quien reservó por booker_phone_number, no por player_id", async () => {
    const columns = await columnsOf("bookings");

    expect(columns).toContain("booker_phone_number");
    expect(columns).not.toContain("player_id");

    const dataSource = await getDataSource();
    const rows: { referenced_table: string; referenced_column: string }[] = await dataSource.query(
      `SELECT ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = kcu.constraint_name
        WHERE kcu.table_name = 'bookings' AND kcu.column_name = 'booker_phone_number'`,
    );
    expect(rows).toEqual([{ referenced_table: "bookers", referenced_column: "phone_number" }]);
  });

  it("email y phone_number son únicos con restricciones nombradas", async () => {
    const dataSource = await getDataSource();
    const rows: { conname: string }[] = await dataSource.query(
      `SELECT conname FROM pg_constraint WHERE contype = 'u' AND conrelid IN ('accounts'::regclass, 'bookers'::regclass)`,
    );

    expect(rows.map((row) => row.conname)).toEqual(
      expect.arrayContaining(["UQ_accounts_email", "UQ_bookers_phone_number"]),
    );
  });

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
