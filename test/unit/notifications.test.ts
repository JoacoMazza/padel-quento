import { afterEach, describe, expect, it, vi } from "vitest";
import {
  channelsFromEnv,
  createEmailChannel,
  createWhatsAppChannel,
  notify,
  type NotificationChannel,
} from "@/src/lib/notifications";
import type { NotificationMessage, NotificationRecipient } from "@/src/domain/notifications";

const ana: NotificationRecipient = { names: "Ana", email: "ana@test.com", phoneNumber: "2215550101" };

const message: NotificationMessage = {
  subject: "Asunto",
  text: "Texto del aviso",
  whatsappTemplate: { name: "quento_turno_cancelado", parameters: ["Ana", "sábado 17 de octubre"] },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("createWhatsAppChannel", () => {
  it("envía la plantilla con sus parámetros a la API de WhatsApp Cloud", async () => {
    const fetchFn = vi.fn(async () => new Response("{}", { status: 200 }));
    const channel = createWhatsAppChannel({ accessToken: "token", phoneNumberId: "123", language: "es_AR" }, fetchFn);

    await channel.send(ana, message);

    expect(fetchFn).toHaveBeenCalledWith("https://graph.facebook.com/v23.0/123/messages", {
      method: "POST",
      headers: { Authorization: "Bearer token", "Content-Type": "application/json" },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: "5492215550101",
        type: "template",
        template: {
          name: "quento_turno_cancelado",
          language: { code: "es_AR" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: "Ana" },
                { type: "text", text: "sábado 17 de octubre" },
              ],
            },
          ],
        },
      }),
    });
  });

  it("falla con el detalle de la API si WhatsApp rechaza el envío", async () => {
    const fetchFn = vi.fn(async () => new Response('{"error":"bad"}', { status: 400 }));
    const channel = createWhatsAppChannel({ accessToken: "token", phoneNumberId: "123", language: "es_AR" }, fetchFn);

    await expect(channel.send(ana, message)).rejects.toThrow('WhatsApp API 400: {"error":"bad"}');
  });

  it("no envía nada a quien no tiene teléfono", async () => {
    const fetchFn = vi.fn();
    const channel = createWhatsAppChannel({ accessToken: "token", phoneNumberId: "123", language: "es_AR" }, fetchFn);

    await channel.send({ ...ana, phoneNumber: null }, message);

    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("createEmailChannel", () => {
  it("envía el asunto y el texto al correo del destinatario", async () => {
    const sendMail = vi.fn(async () => ({}));
    const channel = createEmailChannel("Quento <avisos@quento.com>", { sendMail });

    await channel.send(ana, message);

    expect(sendMail).toHaveBeenCalledWith({
      from: "Quento <avisos@quento.com>",
      to: "ana@test.com",
      subject: "Asunto",
      text: "Texto del aviso",
    });
  });

  it("no envía nada a quien no tiene correo", async () => {
    const sendMail = vi.fn();
    const channel = createEmailChannel("Quento <avisos@quento.com>", { sendMail });

    await channel.send({ ...ana, email: null }, message);

    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("notify", () => {
  it("envía el aviso de cada destinatario por todos los canales", async () => {
    const email: NotificationChannel = { name: "email", send: vi.fn(async () => {}) };
    const whatsapp: NotificationChannel = { name: "whatsapp", send: vi.fn(async () => {}) };
    const bruno = { names: "Bruno", email: null, phoneNumber: "2215550102" };
    const build = vi.fn((recipient: NotificationRecipient) => ({ ...message, text: `Hola ${recipient.names}` }));

    await notify([ana, bruno], build, [email, whatsapp]);

    expect(email.send).toHaveBeenCalledWith(ana, { ...message, text: "Hola Ana" });
    expect(email.send).toHaveBeenCalledWith(bruno, { ...message, text: "Hola Bruno" });
    expect(whatsapp.send).toHaveBeenCalledWith(ana, { ...message, text: "Hola Ana" });
    expect(whatsapp.send).toHaveBeenCalledWith(bruno, { ...message, text: "Hola Bruno" });
  });

  it("no falla si un canal no puede enviar: sigue con los demás y lo registra", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const broken: NotificationChannel = { name: "whatsapp", send: vi.fn(async () => Promise.reject(new Error("caído"))) };
    const email: NotificationChannel = { name: "email", send: vi.fn(async () => {}) };

    await expect(notify([ana], () => message, [broken, email])).resolves.toBeUndefined();

    expect(email.send).toHaveBeenCalledWith(ana, message);
    expect(console.error).toHaveBeenCalled();
  });
});

describe("channelsFromEnv", () => {
  it("no configura canales si faltan las credenciales", () => {
    expect(channelsFromEnv({ NODE_ENV: "test" })).toEqual([]);
  });

  it("configura el correo con los datos SMTP y WhatsApp con el token y el id del número", () => {
    const channels = channelsFromEnv({
      NODE_ENV: "production",
      SMTP_HOST: "smtp.test.com",
      SMTP_PORT: "587",
      SMTP_USER: "user",
      SMTP_PASSWORD: "secret",
      SMTP_FROM: "Quento <avisos@quento.com>",
      WHATSAPP_ACCESS_TOKEN: "token",
      WHATSAPP_PHONE_NUMBER_ID: "123",
    });

    expect(channels.map((channel) => channel.name)).toEqual(["email", "whatsapp"]);
  });

  it("en desarrollo, sin credenciales, muestra los avisos por consola", () => {
    expect(channelsFromEnv({ NODE_ENV: "development" }).map((channel) => channel.name)).toEqual(["console"]);
  });
});
