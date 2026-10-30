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

// After vi.resetModules() the first import loads TypeORM and every entity from scratch,
// which can exceed the default 5s timeout when the whole suite runs in parallel.
describe("getDataSource", { timeout: 20000 }, () => {
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

  it("le pasa el paquete pg a TypeORM: en Vercel solo se incluyen los paquetes importados en el código, y TypeORM lo carga dinámicamente", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    const { getDataSource } = await import("@/src/lib/db");
    const pg = await import("pg");

    const dataSource = await getDataSource();

    expect((dataSource.options as { driver?: unknown }).driver).toBe(pg.default);
  });

  it.each(["development", "production", "test"])(
    "nunca sincroniza el esquema al conectarse (NODE_ENV=%s): se cambia solo con migraciones",
    async (nodeEnv) => {
      process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
      (process.env as Record<string, string>).NODE_ENV = nodeEnv;
      const { getDataSource } = await import("@/src/lib/db");

      const dataSource = await getDataSource();

      expect((dataSource.options as { synchronize?: boolean }).synchronize).toBe(false);
    },
  );

  it("con DATABASE_SSL_CA se conecta por SSL verificando el certificado (Supabase)", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    process.env.DATABASE_SSL_CA = "-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----";
    const { getDataSource } = await import("@/src/lib/db");

    const dataSource = await getDataSource();

    expect((dataSource.options as { ssl?: unknown }).ssl).toEqual({
      ca: process.env.DATABASE_SSL_CA,
      rejectUnauthorized: true,
    });
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

  it("con llamadas simultáneas crea e inicializa una sola conexión", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    const { DataSource } = await import("typeorm");
    const { getDataSource } = await import("@/src/lib/db");

    // Como los procesos en segundo plano al arrancar la app: nadie espera al otro.
    const [first, second, third] = await Promise.all([getDataSource(), getDataSource(), getDataSource()]);

    expect(DataSource).toHaveBeenCalledTimes(1);
    expect(second).toBe(first);
    expect(third).toBe(first);
    expect(
      (first as unknown as { initialize: ReturnType<typeof vi.fn> }).initialize,
    ).toHaveBeenCalledTimes(1);
  });

  it("si la inicialización falla, el próximo pedido vuelve a intentarlo", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    const { DataSource } = await import("typeorm");
    vi.mocked(DataSource).mockImplementationOnce(function (this: { isInitialized: boolean; initialize: () => Promise<unknown> }) {
      this.isInitialized = false;
      this.initialize = vi.fn(async () => {
        throw new Error("Postgres no disponible");
      });
    } as never);
    const { getDataSource } = await import("@/src/lib/db");

    await expect(getDataSource()).rejects.toThrow("Postgres no disponible");
    const retried = await getDataSource();

    expect(retried.isInitialized).toBe(true);
  });

  it("en Vercel usa pocas conexiones por instancia, para no agotar las del pooler de Supabase", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    process.env.VERCEL = "1";
    const { getDataSource } = await import("@/src/lib/db");

    const dataSource = await getDataSource();

    expect((dataSource.options as { extra?: { max?: number } }).extra?.max).toBe(2);
  });

  it("fuera de Vercel deja el tamaño del pool por defecto", async () => {
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/db";
    delete process.env.VERCEL;
    const { getDataSource } = await import("@/src/lib/db");

    const dataSource = await getDataSource();

    expect((dataSource.options as { extra?: { max?: number } }).extra?.max).toBeUndefined();
  });
});
