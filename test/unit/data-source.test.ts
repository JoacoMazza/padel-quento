import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("typeorm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("typeorm")>();
  return {
    ...actual,
    DataSource: vi.fn().mockImplementation(function (this: { options: unknown }, options: unknown) {
      this.options = options;
    }),
  };
});

const ORIGINAL_ENV = process.env;

// The DataSource used by the TypeORM CLI (migrations) and the seeds.
describe("data-source (CLI)", { timeout: 20000 }, () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = { ...ORIGINAL_ENV, DATABASE_URL: "postgres://user:pass@localhost:5432/db" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("con DATABASE_SSL_CA corre las migraciones por SSL verificando el certificado", async () => {
    process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----";

    const { default: dataSource } = await import("@/src/lib/data-source");

    expect((dataSource.options as { ssl?: unknown }).ssl).toEqual({
      ca: process.env.DATABASE_SSL_CA,
      rejectUnauthorized: true,
    });
  });
});
