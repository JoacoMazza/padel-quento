import { describe, expect, it } from "vitest";
import { readOwnerFromEnv } from "@/scripts/production-seed";

const fullEnv = {
  SEED_OWNER_EMAIL: "duenio@quento.com",
  SEED_OWNER_PASSWORD: "una-contraseña-segura",
  SEED_OWNER_NAMES: "María",
  SEED_OWNER_LASTNAMES: "Gómez",
  SEED_OWNER_DNI: "30111222",
};

describe("readOwnerFromEnv", () => {
  it("arma los datos del dueño a partir de las variables de entorno", () => {
    expect(readOwnerFromEnv(fullEnv)).toEqual({
      owner: {
        email: "duenio@quento.com",
        password: "una-contraseña-segura",
        names: "María",
        lastnames: "Gómez",
        dni: 30111222,
      },
    });
  });

  it("sin ninguna variable cargada no hay dueño para crear", () => {
    expect(readOwnerFromEnv({})).toEqual({ owner: null });
  });

  it("si faltan algunas variables informa cuáles", () => {
    const partial = { ...fullEnv, SEED_OWNER_PASSWORD: undefined, SEED_OWNER_DNI: "" };

    expect(readOwnerFromEnv(partial)).toEqual({
      error: "Faltan variables para crear al dueño: SEED_OWNER_PASSWORD, SEED_OWNER_DNI",
    });
  });

  it("rechaza un DNI que no es un número", () => {
    expect(readOwnerFromEnv({ ...fullEnv, SEED_OWNER_DNI: "30.111.222" })).toEqual({
      error: "SEED_OWNER_DNI debe ser un número sin puntos",
    });
  });
});
