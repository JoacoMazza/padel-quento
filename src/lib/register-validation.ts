const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
  names: string;
  lastnames: string;
  email: string;
  password: string;
};

export type FieldErrors = Partial<Record<keyof RegisterInput, string>>;

export function parseRegisterForm(formData: FormData): {
  data?: RegisterInput;
  errors?: FieldErrors;
} {
  const names = String(formData.get("names") ?? "").trim();
  const lastnames = String(formData.get("lastnames") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const errors: FieldErrors = {};

  if (!names) errors.names = "El nombre es obligatorio.";
  if (!lastnames) errors.lastnames = "El apellido es obligatorio.";
  if (!email) errors.email = "El email es obligatorio.";
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Ingresá un email con formato válido.";
  }
  if (!password) errors.password = "La contraseña es obligatoria.";

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { data: { names, lastnames, email, password } };
}
