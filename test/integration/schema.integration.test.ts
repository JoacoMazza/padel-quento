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

  it("las cuentas se dividen en accounts, admins y bookers (Player hereda de Booker), y ya no existen users ni players", async () => {
    expect(await columnsOf("accounts")).toEqual(
      expect.arrayContaining(["id", "email", "password_hashed", "is_blocked"]),
    );
    expect(await columnsOf("accounts")).not.toContain("photo_url");
    expect(await columnsOf("admins")).toEqual(
      expect.arrayContaining(["id", "account_id", "dni", "names", "last_names"]),
    );
    expect(await columnsOf("bookers")).toEqual(
      expect.arrayContaining(["id", "type", "names", "last_names", "phone_number", "account_id", "category", "scoring"]),
    );
    expect(await columnsOf("players")).toEqual([]);
    expect(await columnsOf("users")).toEqual([]);
  });

  it("penalties, match_players y messages referencian a los jugadores en bookers", async () => {
    const dataSource = await getDataSource();
    const rows: { table_name: string; referenced_table: string }[] = await dataSource.query(
      `SELECT kcu.table_name, ccu.table_name AS referenced_table
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = kcu.constraint_name
         JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND (kcu.table_name, kcu.column_name) IN (('penalties', 'player_id'), ('match_players', 'player_id'), ('messages', 'sender_id'))
        ORDER BY kcu.table_name`,
    );
    expect(rows).toEqual([
      { table_name: "match_players", referenced_table: "bookers" },
      { table_name: "messages", referenced_table: "bookers" },
      { table_name: "penalties", referenced_table: "bookers" },
    ]);
  });

  it.each(["bookings", "fixed_bookings"])("%s referencia a quien reservó por booker_id, no por su teléfono", async (table) => {
    const columns = await columnsOf(table);

    expect(columns).toContain("booker_id");
    expect(columns).not.toContain("booker_phone_number");
    expect(columns).not.toContain("player_id");

    const dataSource = await getDataSource();
    const rows: { referenced_table: string; referenced_column: string }[] = await dataSource.query(
      `SELECT ccu.table_name AS referenced_table, ccu.column_name AS referenced_column
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = kcu.constraint_name
        WHERE kcu.table_name = $1 AND kcu.column_name = 'booker_id'`,
      [table],
    );
    expect(rows).toEqual([{ referenced_table: "bookers", referenced_column: "id" }]);
  });

  it("la tabla de calificaciones se llama players_reviews", async () => {
    expect(await columnsOf("players_reviews")).toEqual(
      expect.arrayContaining(["id", "match_id", "reviewer_id", "reviewed_id"]),
    );
    expect(await columnsOf("player_reviews")).toEqual([]);
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

  it("bookings guarda si se pagó (is_paid); la asistencia ya no va en el turno", async () => {
    const columns = await columnsOf("bookings");

    expect(columns).toContain("is_paid");
    expect(columns).not.toContain("attended");
    expect(columns).not.toContain("points_awarded");
  });

  it("match_players guarda cuántos del grupo asistieron y los puntos acreditados", async () => {
    const columns = await columnsOf("match_players");

    expect(columns).toEqual(expect.arrayContaining(["players_count", "attended_count", "points_awarded"]));
    expect(columns).not.toContain("attended");
  });

  it("penalties referencia al turno que la originó por booking_id", async () => {
    const dataSource = await getDataSource();
    const rows: { referenced_table: string }[] = await dataSource.query(
      `SELECT ccu.table_name AS referenced_table
         FROM information_schema.key_column_usage kcu
         JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = kcu.constraint_name
        WHERE kcu.table_name = 'penalties' AND kcu.column_name = 'booking_id'`,
    );
    expect(rows).toEqual([{ referenced_table: "bookings" }]);
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
