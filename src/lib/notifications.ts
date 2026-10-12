import nodemailer from "nodemailer";
import {
  toWhatsAppNumber,
  type NotificationMessage,
  type NotificationRecipient,
} from "@/src/domain/notifications";

export type NotificationChannel = {
  name: string;
  send(recipient: NotificationRecipient, message: NotificationMessage): Promise<void>;
};

const WHATSAPP_API_URL = "https://graph.facebook.com/v23.0";

type WhatsAppConfig = { accessToken: string; phoneNumberId: string; language: string };

/** Canal de WhatsApp Cloud API (Meta): envía la plantilla del aviso al teléfono del destinatario. */
export function createWhatsAppChannel(config: WhatsAppConfig, fetchFn: typeof fetch = fetch): NotificationChannel {
  return {
    name: "whatsapp",
    async send(recipient, message) {
      if (!recipient.phoneNumber) return;

      const response = await fetchFn(`${WHATSAPP_API_URL}/${config.phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${config.accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toWhatsAppNumber(recipient.phoneNumber),
          type: "template",
          template: {
            name: message.whatsappTemplate.name,
            language: { code: config.language },
            components: [
              {
                type: "body",
                parameters: message.whatsappTemplate.parameters.map((text) => ({ type: "text", text })),
              },
            ],
          },
        }),
      });
      if (!response.ok) {
        throw new Error(`WhatsApp API ${response.status}: ${await response.text()}`);
      }
    },
  };
}

type MailTransport = { sendMail(options: { from: string; to: string; subject: string; text: string }): Promise<unknown> };

/** Canal de correo: envía el aviso como texto plano a través del transporte SMTP. */
export function createEmailChannel(from: string, transport: MailTransport): NotificationChannel {
  return {
    name: "email",
    async send(recipient, message) {
      if (!recipient.email) return;
      await transport.sendMail({ from, to: recipient.email, subject: message.subject, text: message.text });
    },
  };
}

const consoleChannel: NotificationChannel = {
  name: "console",
  async send(recipient, message) {
    console.info(`[aviso] para ${recipient.names}: ${message.text}`);
  },
};

type Env = Record<string, string | undefined>;

/**
 * Canales activos según las variables de entorno: cada uno se habilita solo si
 * tiene sus credenciales. En desarrollo, sin ninguno configurado, los avisos se
 * muestran por consola; en tests no se envía nada.
 */
export function channelsFromEnv(env: Env = process.env): NotificationChannel[] {
  const channels: NotificationChannel[] = [];

  if (env.SMTP_HOST && env.SMTP_FROM) {
    const port = Number(env.SMTP_PORT ?? 587);
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
    });
    channels.push(createEmailChannel(env.SMTP_FROM, transport));
  }

  if (env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID) {
    channels.push(
      createWhatsAppChannel({
        accessToken: env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
        language: env.WHATSAPP_TEMPLATE_LANGUAGE ?? "es_AR",
      }),
    );
  }

  if (channels.length === 0 && env.NODE_ENV === "development") {
    channels.push(consoleChannel);
  }

  return channels;
}

/**
 * Envía a cada destinatario su aviso por todos los canales. Nunca falla: un
 * aviso que no se pudo mandar se registra, pero no debe deshacer ni frenar la
 * operación que lo originó.
 */
export async function notify(
  recipients: NotificationRecipient[],
  buildMessage: (recipient: NotificationRecipient) => NotificationMessage,
  channels: NotificationChannel[] = channelsFromEnv(),
): Promise<void> {
  const deliveries = recipients.flatMap((recipient) => {
    const message = buildMessage(recipient);
    return channels.map((channel) =>
      channel.send(recipient, message).catch((error) => {
        console.error(`notify (${channel.name})`, error);
      }),
    );
  });
  await Promise.all(deliveries);
}
