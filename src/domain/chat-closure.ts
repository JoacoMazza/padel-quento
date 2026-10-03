import { BookingState } from "@/src/domain/enums";

/**
 * Una sala de chat se cierra sola al finalizar el horario del turno (inicio +
 * duración): desde ese momento queda en solo lectura. Se deriva de la hora del
 * turno en vez de guardarse, así no depende de que corra ningún proceso en
 * segundo plano y el cierre es exacto.
 */
export function isChatClosed(
  booking: { fromDateTime: Date; durationMinutes: number },
  now: Date = new Date(),
): boolean {
  const endsAt = booking.fromDateTime.getTime() + booking.durationMinutes * 60_000;
  return now.getTime() >= endsAt;
}

export type ChatClosureReason = "finished" | "cancelled";

/**
 * Motivo por el que la sala quedó en solo lectura, o null si sigue abierta. Un
 * turno cancelado cierra la sala en el acto (sin borrarla, así se conserva el
 * historial), aunque todavía no haya llegado su horario.
 */
export function getChatClosureReason(
  booking: { fromDateTime: Date; durationMinutes: number; bookingState: BookingState },
  now: Date = new Date(),
): ChatClosureReason | null {
  if (booking.bookingState === BookingState.CANCELLED) return "cancelled";
  return isChatClosed(booking, now) ? "finished" : null;
}
