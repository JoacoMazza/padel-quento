import { PlayerCategory } from "@/src/domain/enums";

export type ProfileFormValues = {
  names: string;
  lastnames: string;
  category: PlayerCategory;
};

export type ProfileFieldErrors = {
  names?: string;
  lastnames?: string;
  category?: string;
};

export type ProfileValidationResult = {
  data?: ProfileFormValues;
  errors?: ProfileFieldErrors;
};

const VALID_CATEGORIES = new Set<string>(Object.values(PlayerCategory));

export function parseProfileForm(formData: FormData): ProfileValidationResult {
  const names = (formData.get("names") as string)?.trim() ?? "";
  const lastnames = (formData.get("lastnames") as string)?.trim() ?? "";
  const categoryRaw = (formData.get("category") as string)?.trim() ?? "";

  const errors: ProfileFieldErrors = {};

  if (!names) {
    errors.names = "El nombre es obligatorio.";
  } else if (names.length < 2) {
    errors.names = "El nombre debe tener al menos 2 caracteres.";
  }

  if (!lastnames) {
    errors.lastnames = "El apellido es obligatorio.";
  } else if (lastnames.length < 2) {
    errors.lastnames = "El apellido debe tener al menos 2 caracteres.";
  }

  if (!categoryRaw || !VALID_CATEGORIES.has(categoryRaw)) {
    errors.category = "Categoría inválida.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      names,
      lastnames,
      category: categoryRaw as PlayerCategory,
    },
  };
}

