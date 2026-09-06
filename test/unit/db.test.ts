import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("typeorm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("typeorm")>();
  return {
    ...actual,
    DataSource: vi.fn().mockImplementation(function (
      this: { options: unknown; isInitialized: boolean; initialize?: () => Promise<unknown> },
      options: unknown,
    ) {
      this.options = options;
      this.isInitialized = false;
      this.initialize = vi.fn(async () => {
        this.isInitialized = true;
        return this;
      });
    }),
  };
});

const ORIGINAL_ENV = process.env;

describe("getDataSource", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV };
    (globalThis as unknown as { dataSource?: unknown }).dataSource = undefined;
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("lanza un error descriptivo cuando falta DATABASE_URL", async () => {
    delete process.env.DATABASE_URL;
    const { getDataSource } = await import("@/src/lib/db");

    await expect(getDataSource()).rejects.toThrow(/DATABASE_URL/);
  });

  it("inicializa una sola vez y reutiliza la misma instancia en llamadas sucesivas", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    const { getDataSource } = await import("@/src/lib/db");

    const first = await getDataSource();
    const second = await getDataSource();

    expect(first).toBe(second);
    expect(
      (first as unknown as { initialize: ReturnType<typeof vi.fn> }).initialize,
    ).toHaveBeenCalledTimes(1);
  });
});
