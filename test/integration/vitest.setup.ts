import { afterAll } from "vitest";

afterAll(async () => {
  const { getDataSource } = await import("@/src/lib/db");
  try {
    const dataSource = await getDataSource();
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  } catch {
    // Este archivo de test nunca llegó a abrir una conexión: no hay nada que cerrar.
  }
});
