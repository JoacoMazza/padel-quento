import { toWhatsAppNumber } from "@/src/domain/notifications";

/** Enlace para escribirle al jugador por WhatsApp (contacto directo desde su ficha). */
export function whatsappUrl(phoneNumber: string): string {
  return `https://wa.me/${toWhatsAppNumber(phoneNumber)}`;
}

export function mailtoUrl(email: string): string {
  return `mailto:${email}`;
}
