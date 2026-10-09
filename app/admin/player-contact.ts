// Prefijo para WhatsApp de los celulares argentinos cargados sin código de país.
const DEFAULT_COUNTRY_PREFIX = "549";

/** Enlace para escribirle al jugador por WhatsApp (contacto directo desde su ficha). */
export function whatsappUrl(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return `https://wa.me/${phoneNumber.startsWith("+") ? digits : DEFAULT_COUNTRY_PREFIX + digits}`;
}

export function mailtoUrl(email: string): string {
  return `mailto:${email}`;
}
