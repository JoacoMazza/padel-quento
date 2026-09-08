import { PlayerCategory } from "@/src/domain/enums";

export type ProfileFormValues = {
  names: string;
  lastnames: string;
  category: PlayerCategory;
  photoUrl: string | null;
};

export type ProfileFieldErrors = {
  names?: string;
  lastnames?: string;
  category?: string;
  photoUrl?: string;
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
  const photoUrlRaw = (formData.get("photoUrl") as string)?.trim() ?? "";

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

  let photoUrl: string | null = null;
  if (photoUrlRaw) {
    try {
      // Validate string URL or relative path
      if (!photoUrlRaw.startsWith("http://") && !photoUrlRaw.startsWith("https://") && !photoUrlRaw.startsWith("/")) {
        errors.photoUrl = "La URL de la foto debe comenzar con http://, https:// o /";
      } else {
        photoUrl = photoUrlRaw;
      }
    } catch {
      errors.photoUrl = "URL de foto inválida.";
    }
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return {
    data: {
      names,
      lastnames,
      category: categoryRaw as PlayerCategory,
      photoUrl,
    },
  };
}

