import { describe, expect, it } from "vitest";
import nextConfig from "@/next.config";

describe("next.config", () => {
  // Issue #85: minificar el servidor renombra las clases de las entidades y TypeORM, que
  // resuelve las relaciones y los repositorios por nombre de clase ("Admin", "Account"),
  // deja de encontrarlas: el login y las páginas con datos fallan en producción.
  it("no minifica el código del servidor, para que TypeORM encuentre las entidades por nombre", () => {
    expect(nextConfig.experimental?.turbopackMinify).toMatchObject({ server: false });
  });

  it("sigue minificando el código que se descarga en el navegador", () => {
    expect(nextConfig.experimental?.turbopackMinify).toMatchObject({ client: true });
  });
});
