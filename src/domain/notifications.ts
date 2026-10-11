/** Persona a la que se le avisa: cada canal usa el dato de contacto que le corresponde. */
export type NotificationRecipient = {
  names: string;
  email: string | null;
  phoneNumber: string | null;
};

/**
 * Contenido de un aviso. El correo usa `subject` y `text`; WhatsApp no admite
 * texto libre en mensajes que inicia el club, así que usa una plantilla
 * aprobada por Meta con los mismos datos como parámetros.
 */
export type NotificationMessage = {
  subject: string;
  text: string;
  whatsappTemplate: { name: string; parameters: string[] };
};

export type NoticeBooking = {
  fromDateTime: Date;
  courtNumber: number;
};

// Prefijo para WhatsApp de los celulares argentinos cargados sin código de país.
const DEFAULT_COUNTRY_PREFIX = "549";

/** Número en formato internacional, solo dígitos, como lo esperan wa.me y la API de WhatsApp. */
export function toWhatsAppNumber(phoneNumber: string): string {
  const digits = phoneNumber.replace(/\D/g, "");
  return phoneNumber.trim().startsWith("+") ? digits : DEFAULT_COUNTRY_PREFIX + digits;
}

const DAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });

// Los turnos se guardan como hora de pared del club, así que se formatean con la hora local.
function describeBooking(booking: NoticeBooking) {
  const day = DAY_FORMATTER.format(booking.fromDateTime).replace(",", "");
  const hours = String(booking.fromDateTime.getHours()).padStart(2, "0");
  const minutes = String(booking.fromDateTime.getMinutes()).padStart(2, "0");
  return { day, time: `${hours}:${minutes}`, court: String(booking.courtNumber) };
}

/** Turno cancelado porque la cancha quedó fuera de servicio. */
export function courtUnavailableNotice(recipientName: string, booking: NoticeBooking): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `Tu turno del ${day} fue cancelado`,
    text: `Hola ${recipientName}, tu turno del ${day} a las ${time} en la cancha ${court} fue cancelado porque la cancha no va a estar disponible. No se aplicó ninguna penalización.`,
    whatsappTemplate: { name: "quento_turno_cancelado", parameters: [recipientName, day, time, court] },
  };
}

/** Alguien se sumó a un partido abierto del que el destinatario forma parte. */
export function playerJoinedNotice(
  recipientName: string,
  playerName: string,
  booking: NoticeBooking,
  freeSpots: number,
): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `${playerName} se sumó a tu partido del ${day}`,
    text: `Hola ${recipientName}, ${playerName} se sumó al partido del ${day} a las ${time} en la cancha ${court}. Lugares libres: ${freeSpots}.`,
    whatsappTemplate: {
      name: "quento_jugador_se_sumo",
      parameters: [recipientName, playerName, day, time, court, String(freeSpots)],
    },
  };
}

/** Alguien se bajó de un partido abierto del que el destinatario forma parte. */
export function playerLeftNotice(
  recipientName: string,
  playerName: string,
  booking: NoticeBooking,
  freeSpots: number,
): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `${playerName} se bajó de tu partido del ${day}`,
    text: `Hola ${recipientName}, ${playerName} se bajó del partido del ${day} a las ${time} en la cancha ${court}. Lugares libres: ${freeSpots}.`,
    whatsappTemplate: {
      name: "quento_jugador_se_bajo",
      parameters: [recipientName, playerName, day, time, court, String(freeSpots)],
    },
  };
}
