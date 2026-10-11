import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";

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

/**
 * Alguien se bajó con menos de 3 horas para el turno: el partido no vuelve a
 * buscar jugadores (ver leaveMatch), así que no se ofrecen lugares libres.
 */
export function playerLeftLateNotice(
  recipientName: string,
  playerName: string,
  booking: NoticeBooking,
): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `${playerName} se bajó de tu partido del ${day}`,
    text: `Hola ${recipientName}, ${playerName} se bajó a último momento del partido del ${day} a las ${time} en la cancha ${court}.`,
    whatsappTemplate: {
      name: "quento_jugador_se_bajo_tarde",
      parameters: [recipientName, playerName, day, time, court],
    },
  };
}

/** Quien armó el partido canceló el turno (HU-19); la penalización, si corresponde, es solo para él. */
export function matchCancelledByCreatorNotice(
  recipientName: string,
  creatorName: string,
  booking: NoticeBooking,
): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `Se canceló el partido del ${day}`,
    text: `Hola ${recipientName}, ${creatorName} canceló el partido del ${day} a las ${time} en la cancha ${court}. No se aplicó ninguna penalización para vos.`,
    whatsappTemplate: {
      name: "quento_partido_cancelado",
      parameters: [recipientName, creatorName, day, time, court],
    },
  };
}

/** El partido se canceló solo por no completar el cupo a tiempo (ver cancelExpiredMatches). */
export function matchExpiredNotice(recipientName: string, booking: NoticeBooking): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `Se canceló el partido del ${day}`,
    text: `Hola ${recipientName}, el partido del ${day} a las ${time} en la cancha ${court} se canceló porque no se completó el cupo de jugadores. No se aplicó ninguna penalización.`,
    whatsappTemplate: { name: "quento_partido_sin_cupo", parameters: [recipientName, day, time, court] },
  };
}

/** Quien armó el partido lo cerró: se juega con los anotados y no se suman más jugadores. */
export function matchClosedNotice(recipientName: string, booking: NoticeBooking): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `El partido del ${day} ya no busca jugadores`,
    text: `Hola ${recipientName}, el partido del ${day} a las ${time} en la cancha ${court} ya no busca más jugadores. Se juega con los que están anotados.`,
    whatsappTemplate: { name: "quento_partido_cerrado", parameters: [recipientName, day, time, court] },
  };
}

/** Con quien se acaba de sumar el partido llegó al cupo (HU-17): se avisa a todos sus jugadores. */
export function matchCompleteNotice(
  recipientName: string,
  playerName: string,
  booking: NoticeBooking,
): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `¡El partido del ${day} está completo!`,
    text: `Hola ${recipientName}, ¡el partido del ${day} a las ${time} en la cancha ${court} está completo! ${playerName} se sumó y ya son ${OPEN_MATCH_MAX_PLAYERS} jugadores.`,
    whatsappTemplate: { name: "quento_partido_completo", parameters: [recipientName, day, time, court, playerName] },
  };
}

/** El admin liberó una sola fecha de un turno fijo (HU-41): las demás siguen reservadas. */
export function fixedDateReleasedNotice(recipientName: string, booking: NoticeBooking): NotificationMessage {
  const { day, time, court } = describeBooking(booking);
  return {
    subject: `Liberamos tu turno fijo del ${day}`,
    text: `Hola ${recipientName}, liberamos tu turno fijo del ${day} a las ${time} en la cancha ${court}. Tus próximos turnos fijos siguen reservados.`,
    whatsappTemplate: { name: "quento_turno_fijo_liberado", parameters: [recipientName, day, time, court] },
  };
}

const WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "long", timeZone: "UTC" });

export type NoticeFixedBooking = { startDate: string; startTime: string; courtNumber: number };

/** El admin dio de baja el turno fijo completo (HU-41). */
export function fixedBookingCancelledNotice(recipientName: string, fixedBooking: NoticeFixedBooking): NotificationMessage {
  const weekday = WEEKDAY_FORMATTER.format(new Date(`${fixedBooking.startDate}T00:00:00Z`));
  // "lunes" a "viernes" ya están en plural; "sábado" y "domingo" no.
  const weekdays = weekday.endsWith("s") ? weekday : `${weekday}s`;
  const time = fixedBooking.startTime.slice(0, 5);
  const court = String(fixedBooking.courtNumber);
  return {
    subject: `Se dio de baja tu turno fijo de los ${weekdays}`,
    text: `Hola ${recipientName}, se dio de baja tu turno fijo de los ${weekdays} a las ${time} en la cancha ${court}. Se cancelaron todas sus próximas fechas.`,
    whatsappTemplate: { name: "quento_turno_fijo_cancelado", parameters: [recipientName, weekdays, time, court] },
  };
}
