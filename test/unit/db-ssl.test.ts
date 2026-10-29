import { describe, expect, it } from "vitest";
import { databaseSsl } from "@/src/lib/db-ssl";

const PEM = "-----BEGIN CERTIFICATE-----\nMIIDxTCCAq2gAwIBAgIU\n-----END CERTIFICATE-----";

describe("databaseSsl", () => {
  it("sin DATABASE_SSL_CA no configura SSL (Postgres local)", () => {
    expect(databaseSsl({})).toBeUndefined();
  });

  it("con DATABASE_SSL_CA verifica el certificado del servidor contra esa CA", () => {
    expect(databaseSsl({ DATABASE_SSL_CA: PEM })).toEqual({ ca: PEM, rejectUnauthorized: true });
  });

  it("acepta la CA en una sola línea, con los saltos escritos como \\n", () => {
    const singleLine = PEM.replace(/\n/g, "\\n");

    expect(databaseSsl({ DATABASE_SSL_CA: singleLine })).toEqual({ ca: PEM, rejectUnauthorized: true });
  });
});
