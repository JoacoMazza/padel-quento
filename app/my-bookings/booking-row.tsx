"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Ban, Calendar, CalendarCheck, Clock, Lock, LogOut, MapPin, MessageCircle, Repeat, UserPlus, Users, X } from "lucide-react";
import { CLUB_LOCATION, CLUB_MAPS_URL } from "@/app/components/club-info";
import { BookingState } from "@/src/domain/enums";
import { LATE_CANCELLATION_HOURS, OPEN_MATCH_MAX_PLAYERS, PENALTY_POINTS } from "@/src/domain/constants";
import { isLateCancellation } from "@/src/domain/late-cancellation";
import { updateBooking } from "@/src/actions/booking";
import { closeMatch, leaveMatch } from "@/src/actions/match";
import { formatLongDate, formatPrice } from "@/app/bookings/slot-utils";
import { dateToTimeLabel } from "@/src/domain/time-format";
import {
  getBookingBadgeClasses,
  getBookingEnd,
  getBookingStatusLabel,
  getBookingTone,
} from "@/app/my-bookings/booking-status";
import type { MyBookingItem } from "@/app/my-bookings/types";

const SHORT_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short" });

/** "Mié 14". */
function shortDay(date: Date) {
  return `${SHORT_WEEKDAY_FORMATTER.format(date).replace(".", "")} ${date.getDate()}`;
}

const CONFIRM_LABELS = {
  cancel: { question: "¿Cancelar turno?", confirm: "Sí, cancelar", pending: "Cancelando…" },
  close: { question: "¿Cerrar búsqueda de jugadores?", confirm: "Sí, cerrar", pending: "Cerrando…" },
  leave: { question: "¿Darte de baja del partido?", confirm: "Sí, darme de baja", pending: "Dándote de baja…" },
};

export function BookingRow({
  booking,
  now,
  playerId = null,
}: {
  booking: MyBookingItem;
  now: Date;
  /** Jugador logueado: lo necesita la baja de un partido al que se sumó. */
  playerId?: number | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingAction, setPendingAction] = useState<"cancel" | "close" | "leave" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const end = getBookingEnd(booking);
  const tone = getBookingTone(booking, now);
  // Quien se sumó a un partido de otro jugador no puede cancelar el turno completo.
  const canCancel = (tone === "confirmed" || tone === "pending") && !booking.joinedAsParticipant && !booking.isFixed;
  // En cambio, sí puede darse de baja del partido y liberar su lugar.
  const canLeave =
    (tone === "confirmed" || tone === "pending") &&
    booking.joinedAsParticipant &&
    booking.matchId !== null &&
    playerId !== null;
  // El cierre manual es una acción del creador del partido, no de quien se sumó.
  const canCloseManually =
    booking.needPlayers &&
    booking.matchId !== null &&
    !booking.joinedAsParticipant &&
    booking.confirmedPlayers >= 1 &&
    booking.confirmedPlayers < OPEN_MATCH_MAX_PLAYERS;

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await updateBooking(booking.id, { bookingState: BookingState.CANCELLED });
      // La fila sigue montada tras el refresh (los cancelados se siguen listando),
      // así que la confirmación se cierra siempre, salga bien o mal.
      setPendingAction(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleLeave() {
    if (booking.matchId === null || playerId === null) return;
    setError(null);
    startTransition(async () => {
      const result = await leaveMatch(booking.matchId!, playerId);
      setPendingAction(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleClose() {
    if (booking.matchId === null) return;
    setError(null);
    startTransition(async () => {
      const result = await closeMatch(booking.matchId!);
      setPendingAction(null);
      if (!result.success) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  const isToday = booking.fromDateTime.toDateString() === now.toDateString();
  const isInactive = tone === "completed" || tone === "cancelled";

  return (
    <div className={`card flex flex-col gap-4 p-5 sm:flex-row sm:items-center ${isInactive ? "opacity-75" : ""}`}>
      <div
        className={`flex h-16 w-20 shrink-0 flex-col items-center justify-center rounded-xl ${
          isInactive ? "bg-line/70 text-foreground/60" : "bg-ink text-white"
        }`}
      >
        <span className="text-[10px] font-semibold tracking-wider uppercase opacity-70" suppressHydrationWarning>
          {isToday ? "Hoy" : shortDay(booking.fromDateTime)}
        </span>
        <span className="text-lg font-extrabold tabular-nums">{dateToTimeLabel(booking.fromDateTime)}</span>
      </div>

      <div className="flex flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-lg font-bold text-foreground">Cancha {booking.courtNumber}</p>
          <span className={`badge ${getBookingBadgeClasses(tone)}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
            {getBookingStatusLabel(tone)}
          </span>
          {booking.needPlayers ? (
            <span className="badge badge-neutral">
              <Users className="h-3 w-3" />
              {booking.confirmedPlayers}/{OPEN_MATCH_MAX_PLAYERS} jugadores
            </span>
          ) : null}
          {booking.isFixed ? (
            <span className="badge badge-neutral">
              <Repeat className="h-3 w-3" />
              Turno fijo
            </span>
          ) : null}
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-foreground/60">
          <span className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {formatLongDate(booking.fromDateTime)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {dateToTimeLabel(booking.fromDateTime)} – {dateToTimeLabel(end)}
          </span>
          <a
            href={CLUB_MAPS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 transition-colors hover:text-primary"
            title="Ver ubicación en Google Maps"
          >
            <MapPin className="h-3.5 w-3.5" />
            {CLUB_LOCATION}
          </a>
        </p>
        <p className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-bold text-foreground">{formatPrice(booking.price)}</span>
          {booking.joinedAsParticipant ? (
            <span className="flex items-center gap-1 text-xs font-medium text-primary">
              <UserPlus className="h-3.5 w-3.5" />
              Te sumaste a este partido
            </span>
          ) : null}
        </p>
      </div>

      <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
        {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}
        {booking.isFixed && (tone === "confirmed" || tone === "pending") ? (
          <p className="max-w-xs text-xs text-foreground/60">Para no ir a esta fecha, avisale al club.</p>
        ) : null}

        {(pendingAction === "cancel" || pendingAction === "leave") && isLateCancellation(booking.fromDateTime, now) ? (
          <p role="alert" className="max-w-xs text-xs font-medium text-amber-600">
            Faltan menos de {LATE_CANCELLATION_HOURS} horas para el turno:{" "}
            {pendingAction === "cancel" ? "si cancelás" : "si te das de baja"} se te descontarán {PENALTY_POINTS}{" "}
            puntos.
          </p>
        ) : null}

        {pendingAction ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/60">{CONFIRM_LABELS[pendingAction].question}</span>
            <button
              type="button"
              disabled={isPending}
              onClick={
                pendingAction === "cancel" ? handleCancel : pendingAction === "leave" ? handleLeave : handleClose
              }
              className={`btn btn-sm ${pendingAction === "close" ? "btn-dark" : "bg-danger text-white hover:bg-danger/90"}`}
            >
              {isPending ? CONFIRM_LABELS[pendingAction].pending : CONFIRM_LABELS[pendingAction].confirm}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setPendingAction(null)}
              className="icon-btn"
              aria-label="Volver"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {booking.matchId !== null ? (
              <Link href={`/open-matches/${booking.id}`} className="btn btn-soft btn-sm">
                <CalendarCheck className="h-4 w-4" />
                Ver detalle
              </Link>
            ) : null}
            {booking.chatId !== null ? (
              <Link href={`/chats/${booking.chatId}`} className="btn btn-outline btn-sm">
                <MessageCircle className="h-4 w-4" />
                Chat
              </Link>
            ) : null}
            {canCloseManually ? (
              <button
                type="button"
                onClick={() => setPendingAction("close")}
                className="icon-btn"
                aria-label="Cerrar búsqueda de jugadores"
                title="Cerrar búsqueda de jugadores"
              >
                <Lock className="h-4 w-4" />
              </button>
            ) : null}
            {canLeave ? (
              <button
                type="button"
                onClick={() => setPendingAction("leave")}
                className="icon-btn hover:border-danger/40 hover:text-danger"
                aria-label="Darme de baja del partido"
                title="Darme de baja del partido"
              >
                <LogOut className="h-4 w-4" />
              </button>
            ) : null}
            {canCancel ? (
              <button
                type="button"
                onClick={() => setPendingAction("cancel")}
                className="btn btn-sm btn-danger-soft"
                aria-label="Cancelar turno"
              >
                <Ban className="h-4 w-4" />
                Cancelar
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
