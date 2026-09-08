import { describe, expect, it } from "vitest";
import { PlayerCategory } from "@/src/domain/enums";
import { parseProfileForm } from "@/src/lib/profile-validation";

function buildProfileFormData(overrides: Record<string, string> = {}) {
  const formData = new FormData();
  formData.set("names", overrides.names ?? "Carlos");
  formData.set("lastnames", overrides.lastnames ?? "Perez");
  formData.set("category", overrides.category ?? PlayerCategory.FIFTH);
  if (overrides.photoUrl !== undefined) {
    formData.set("photoUrl", overrides.photoUrl);
  }
  return formData;
}

describe("parseProfileForm", () => {
  it("valida y retorna datos correctos cuando el formulario es válido", () => {
    const formData = buildProfileFormData({
      names: "Carlos",
      lastnames: "Perez",
      category: PlayerCategory.THIRD,
      photoUrl: "https://example.com/avatar.jpg",
    });

    const result = parseProfileForm(formData);
    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      names: "Carlos",
      lastnames: "Perez",
      category: PlayerCategory.THIRD,
      photoUrl: "https://example.com/avatar.jpg",
    });
  });

  it("retorna error si los nombres o apellidos son demasiado cortos o vacíos", () => {
    const formData = buildProfileFormData({
      names: "A",
      lastnames: "",
    });

    const result = parseProfileForm(formData);
    expect(result.data).toBeUndefined();
    expect(result.errors?.names).toBe("El nombre debe tener al menos 2 caracteres.");
    expect(result.errors?.lastnames).toBe("El apellido es obligatorio.");
  });

  it("retorna error si la categoría no es válida", () => {
    const formData = buildProfileFormData({
      category: "categoria_inexistente",
    });

    const result = parseProfileForm(formData);
    expect(result.errors?.category).toBe("Categoría inválida.");
  });

  it("acepta URL de foto vacía o nula", () => {
    const formData = buildProfileFormData({ photoUrl: "" });
    const result = parseProfileForm(formData);

    expect(result.errors).toBeUndefined();
    expect(result.data?.photoUrl).toBeNull();
  });

  it("rechaza URL de foto sin esquema válido", () => {
    const formData = buildProfileFormData({ photoUrl: "invalid-url-path" });
    const result = parseProfileForm(formData);

    expect(result.errors?.photoUrl).toBe("La URL de la foto debe comenzar con http://, https:// o /");
  });
});

