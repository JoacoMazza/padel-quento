"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, Calendar, CalendarCheck, Clock, MapPin, Volleyball, X } from "lucide-react";
import { BookingState } from "@/src/domain/enums";
import { updateBooking } from "@/src/actions/booking";
import { formatLongDate, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import {
  getBookingBadgeClasses,
  getBookingEnd,
  getBookingStatusLabel,
  getBookingTone,
} from "@/app/my-bookings/booking-status";
import type { MyBookingItem } from "@/app/my-bookings/types";

function timeLabel(date: Date) {
  return minutesToTimeLabel(date.getHours() * 60 + date.getMinutes());
}

export function BookingRow({ booking, now }: { booking: MyBookingItem; now: Date }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const end = getBookingEnd(booking);
  const tone = getBookingTone(booking, now);
  const canCancel = tone === "confirmed" || tone === "pending";

  function handleCancel() {
    setError(null);
    startTransition(async () => {
      const result = await updateBooking(booking.id, { bookingState: BookingState.CANCELLED });
      if (!result.success) {
        setError(result.error);
        setConfirming(false);
        return;
      }
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        <Volleyball className="h-5 w-5" />
      </span>

      <div className="flex flex-1 flex-col gap-0.5">
        <p className="text-sm font-bold text-foreground">Pista de pádel</p>
        <p className="text-xs text-foreground/60">Nivel estándar</p>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-foreground/60">
          <Calendar className="h-3.5 w-3.5" />
          {formatLongDate(booking.fromDateTime)}
        </p>
      </div>

      <div className="flex flex-col gap-1 sm:w-40">
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <Clock className="h-4 w-4 text-foreground/50" />
          {timeLabel(booking.fromDateTime)} – {timeLabel(end)}
        </p>
        <p className="flex items-center gap-1.5 text-sm text-foreground">
          <MapPin className="h-4 w-4 text-foreground/50" />
          Cancha {booking.courtNumber}
        </p>
      </div>

      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${getBookingBadgeClasses(tone)}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-current" />
        {getBookingStatusLabel(tone)}
      </span>

      <div className="flex flex-col items-stretch gap-1.5 sm:items-end">
        {error ? <p className="text-xs font-medium text-danger">{error}</p> : null}

        {confirming ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-foreground/60">¿Cancelar turno?</span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleCancel}
              className="h-8 rounded-full bg-danger px-3 text-xs font-semibold text-white transition-colors hover:bg-danger/90 disabled:opacity-60 cursor-pointer"
            >
              {isPending ? "Cancelando…" : "Sí, cancelar"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => setConfirming(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-foreground/60 hover:bg-line/40 cursor-pointer"
              aria-label="Volver"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-primary px-4 text-sm font-semibold text-primary transition-colors hover:bg-primary-light cursor-pointer"
            >
              <CalendarCheck className="h-4 w-4" />
              Ver detalle
            </button>
            {canCancel ? (
              <button
                type="button"
                onClick={() => setConfirming(true)}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line text-foreground/60 transition-colors hover:border-danger hover:text-danger cursor-pointer"
                aria-label="Cancelar turno"
              >
                <Ban className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
