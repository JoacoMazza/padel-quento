"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { getComplexContacts, updateComplexContact, type ComplexContact } from "@/src/actions/complex";

/** El número guardado (solo dígitos) como se muestra en el campo, con el "+" del código de país. */
function numberLabel(whatsappNumber: string | null): string {
  return whatsappNumber ? `+${whatsappNumber}` : "";
}

function ContactForm({ contact }: { contact: ComplexContact }) {
  const [whatsappNumber, setWhatsappNumber] = useState(numberLabel(contact.whatsappNumber));
  const [whatsappMessage, setWhatsappMessage] = useState(contact.whatsappMessage ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const numberId = `whatsapp-number-${contact.id}`;
  const messageId = `whatsapp-message-${contact.id}`;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    setNotice(null);
    const result = await updateComplexContact(contact.id, { whatsappNumber, whatsappMessage });
    setIsSaving(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setWhatsappNumber(numberLabel(result.data.whatsappNumber));
    setWhatsappMessage(result.data.whatsappMessage ?? "");
    setNotice("WhatsApp de contacto guardado.");
  }

  return (
    <form onSubmit={save} className="space-y-4 border-t border-line pt-4 first:border-t-0 first:pt-0">
      <p className="font-semibold text-foreground">{contact.name}</p>
      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <div>
          <label htmlFor={numberId} className="field-label">
            Número de WhatsApp
          </label>
          <input
            id={numberId}
            type="tel"
            value={whatsappNumber}
            onChange={(event) => setWhatsappNumber(event.target.value)}
            placeholder="+54 9 221 604-9987"
            className="field"
          />
        </div>
        <div>
          <label htmlFor={messageId} className="field-label">
            Mensaje inicial
          </label>
          <textarea
            id={messageId}
            value={whatsappMessage}
            onChange={(event) => setWhatsappMessage(event.target.value)}
            maxLength={500}
            rows={2}
            className="field"
          />
        </div>
      </div>
      {error ? <div className="alert-error">{error}</div> : null}
      {notice ? <div className="alert-success">{notice}</div> : null}
      <button type="submit" disabled={isSaving} className="btn btn-primary">
        Guardar
      </button>
    </form>
  );
}

/**
 * WhatsApp de contacto de cada complejo: el número y el mensaje con que se abre
 * el chat desde el botón flotante y la landing. Lo carga cualquier administrador.
 */
export function ComplexContactPanel() {
  const [contacts, setContacts] = useState<ComplexContact[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getComplexContacts().then((result) => {
      if (result.success) setContacts(result.data);
      else setError(result.error);
    });
  }, []);

  return (
    <section className="card space-y-4 p-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-bold text-foreground">WhatsApp de contacto</h2>
      </div>
      <p className="text-sm text-foreground/60">
        Número y mensaje con que se abre el chat desde el botón de WhatsApp del sitio. Sin número, el botón de
        WhatsApp no se muestra.
      </p>
      {error ? <div className="alert-error">{error}</div> : null}
      {contacts?.map((contact) => <ContactForm key={contact.id} contact={contact} />)}
    </section>
  );
}
