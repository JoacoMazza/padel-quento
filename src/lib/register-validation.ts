const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Sin espacios, guiones ni paréntesis: así un mismo teléfono se guarda siempre
// igual y identifica a un único booker (bookers.phone_number es único).
const PHONE_NUMBER_PATTERN = /^\+?\d{8,15}$/;

export type RegisterInput = {
  names: string;
  lastnames: string;
  email: string;
  password: string;
  phoneNumber: string;
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
  const phoneNumber = String(formData.get("phoneNumber") ?? "").replace(/[\s()-]/g, "");

  const errors: FieldErrors = {};

  if (!names) errors.names = "El nombre es obligatorio.";
  if (!lastnames) errors.lastnames = "El apellido es obligatorio.";
  if (!email) errors.email = "El email es obligatorio.";
  else if (!EMAIL_PATTERN.test(email)) {
    errors.email = "Ingresá un email con formato válido.";
  }
  if (!password) {
    errors.password = "La contraseña es obligatoria.";
  } else if (password.length < 6 || password.length > 25) {
    errors.password = "La contraseña debe tener entre 6 y 25 caracteres.";
  }
  if (!phoneNumber) errors.phoneNumber = "El teléfono es obligatorio.";
  else if (!PHONE_NUMBER_PATTERN.test(phoneNumber)) {
    errors.phoneNumber = "Ingresá un teléfono válido, de 8 a 15 dígitos.";
  }

  if (Object.keys(errors).length > 0) {
    return { errors };
  }

  return { data: { names, lastnames, email, password, phoneNumber } };
}
