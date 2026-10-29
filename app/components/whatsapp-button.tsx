import { MessageCircle } from "lucide-react";

/**
 * Link de wa.me para el número (se quedan solo los dígitos, como lo espera
 * wa.me) con el mensaje inicial opcional. Sin número no hay link.
 */
export function whatsAppContactUrl(number: string | undefined, message?: string): string | null {
  const digits = number?.replace(/\D/g, "");
  if (!digits) return null;
  const text = message?.trim();
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
}

/**
 * Botón flotante de WhatsApp para contactar al complejo, en todas las páginas.
 * El número y el mensaje inicial salen de NEXT_PUBLIC_WHATSAPP_CONTACT_NUMBER y
 * NEXT_PUBLIC_WHATSAPP_CONTACT_MESSAGE; sin número no se muestra.
 */
export function WhatsAppButton() {
  const href = whatsAppContactUrl(
    process.env.NEXT_PUBLIC_WHATSAPP_CONTACT_NUMBER,
    process.env.NEXT_PUBLIC_WHATSAPP_CONTACT_MESSAGE,
  );
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      title="Contactar por WhatsApp"
      className="fixed right-4 bottom-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-lg transition-transform hover:scale-105 focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none sm:right-6 sm:bottom-6"
    >
      <MessageCircle className="h-7 w-7" aria-hidden="true" />
    </a>
  );
}
