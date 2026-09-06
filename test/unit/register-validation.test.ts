import { describe, expect, it } from "vitest";
import { parseRegisterForm } from "@/src/lib/register-validation";

function buildFormData(fields: Partial<Record<"names" | "lastnames" | "email" | "password", string>>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) formData.set(key, value);
  }
  return formData;
}

describe("parseRegisterForm", () => {
  it("devuelve los datos parseados cuando el formulario es válido", () => {
    const result = parseRegisterForm(
      buildFormData({
        names: " Ana ",
        lastnames: " Gomez ",
        email: " Ana.Gomez@Test.com ",
        password: "secreto123",
      }),
    );

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      names: "Ana",
      lastnames: "Gomez",
      email: "ana.gomez@test.com",
      password: "secreto123",
    });
  });

  it("reporta todos los campos obligatorios faltantes", () => {
    const result = parseRegisterForm(buildFormData({}));

    expect(result.data).toBeUndefined();
    expect(result.errors).toEqual({
      names: "El nombre es obligatorio.",
      lastnames: "El apellido es obligatorio.",
      email: "El email es obligatorio.",
      password: "La contraseña es obligatoria.",
    });
  });

  it("rechaza un email con formato inválido", () => {
    const result = parseRegisterForm(
      buildFormData({ names: "Ana", lastnames: "Gomez", email: "no-es-un-email", password: "secreto123" }),
    );

    expect(result.errors?.email).toBe("Ingresá un email con formato válido.");
  });

  it.each([
    ["12345", "corta"],
    ["a".repeat(26), "larga"],
  ])("rechaza una contraseña demasiado %s (%s)", (password) => {
    const result = parseRegisterForm(
      buildFormData({ names: "Ana", lastnames: "Gomez", email: "ana@test.com", password }),
    );

    expect(result.errors?.password).toBe("La contraseña debe tener entre 6 y 25 caracteres.");
  });

  it("acepta contraseñas en los límites de longitud (6 y 25 caracteres)", () => {
    for (const password of ["123456", "a".repeat(25)]) {
      const result = parseRegisterForm(
        buildFormData({ names: "Ana", lastnames: "Gomez", email: "ana@test.com", password }),
      );
      expect(result.errors?.password).toBeUndefined();
    }
  });
});
