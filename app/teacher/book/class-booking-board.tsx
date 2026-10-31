"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";
import { MAX_CLASS_CAPACITY, MIN_CLASS_CAPACITY } from "@/src/domain/constants";
import { createClassBooking } from "@/src/actions/teacherClass";
import { dateToTimeLabel } from "@/src/domain/time-format";
import { AvailabilityGrid } from "@/app/bookings/availability-grid";
import { DayStrip, dayCaption, dayLabel, type DayOption } from "@/app/bookings/day-strip";
import {
  SLOT_DURATION_MINUTES,
  buildCourtSlots,
  formatLongDate,
  formatPrice,
  getInitialBoardDate,
  parseISODate,
  summarizeSlots,
  toISODate,
} from "@/app/bookings/slot-utils";
import { SummaryCourt, SummaryFeedback, SummaryField, SummaryHeader, SummaryPanel } from "@/app/bookings/summary-parts";
import type { BookingProp, CourtProp, OutOfServiceProp, ScheduleProp, SelectedSlot, Slot } from "@/app/bookings/types";

const DAY_STRIP_LENGTH = 5;
const DEFAULT_CAPACITY = 4;
const CAPACITY_OPTIONS = Array.from(
  { length: MAX_CLASS_CAPACITY - MIN_CLASS_CAPACITY + 1 },
  (_, i) => MIN_CLASS_CAPACITY + i,
);

/**
 * Reserva de turnos de clase del profesor (HU-43): la misma disponibilidad que
 * Turnos (días, grilla y turnos libres), pero solo se eligen turnos libres y
 * se fija el cupo de alumnos. La clase se paga al precio de la cancha.
 */
export function ClassBookingBoard({
  courts,
  schedules,
  bookings,
  outOfServices,
}: {
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateInput, setDateInput] = useState(() => toISODate(getInitialBoardDate(courts, schedules, new Date())));
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [capacity, setCapacity] = useState(DEFAULT_CAPACITY);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(null);

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);
  const now = new Date();
  const todayISODate = toISODate(now);

  const slotsForDay = (date: Date) =>
    courts.map((court) => ({
      court,
      slots: buildCourtSlots({ court, schedules, bookings, outOfServices, date, now, playerId: null }),
    }));

  const courtSlots = slotsForDay(selectedDate).map(({ court, slots }) => ({
    court,
    slots: slots.map((slot): Slot =>
      selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slot.start.getTime()
        ? { ...slot, status: "selected" }
        : slot,
    ),
  }));

  const days: DayOption[] = Array.from({ length: DAY_STRIP_LENGTH }, (_, offset) => {
    const date = parseISODate(todayISODate);
    date.setDate(date.getDate() + offset);
    const slotsByCourt = slotsForDay(date).map((c) => c.slots);
    return {
      iso: toISODate(date),
      caption: dayCaption(date, offset),
      label: dayLabel(date),
      free: summarizeSlots(slotsByCourt).free,
      hasSchedule: slotsByCourt.some((slots) => slots.length > 0),
    };
  });

  function handleSlotClick(court: CourtProp, slot: Slot) {
    // Una clase ocupa la cancha entera: solo se eligen turnos libres.
    if (slot.status !== "available" && slot.status !== "selected") return;
    setFeedback(null);
    if (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slot.start.getTime()) {
      setSelectedSlot(null);
      return;
    }
    setSelectedSlot({
      courtId: court.id,
      courtNumber: court.number,
      location: court.location,
      price: court.price,
      start: slot.start,
      end: slot.end,
    });
  }

  function handleConfirm() {
    if (!selectedSlot) return;
    setFeedback(null);
    startTransition(async () => {
      const result = await createClassBooking({
        courtId: selectedSlot.courtId,
        fromDateTime: selectedSlot.start,
        classCapacity: capacity,
      });
      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }
      router.push("/teacher");
    });
  }

  return (
    <div className="mt-8">
      <p className="label-caps mb-3">Elegí el día</p>
      <DayStrip
        days={days}
        selectedISO={dateInput}
        todayISO={todayISODate}
        onSelect={(value) => {
          setDateInput(value);
          setSelectedSlot(null);
          setFeedback(null);
        }}
      />

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AvailabilityGrid courtSlots={courtSlots} onSlotClick={handleSlotClick} />

        {selectedSlot ? (
          <SummaryPanel label="Tu turno de clase">
            <SummaryHeader title="Tu turno de clase" onClose={() => setSelectedSlot(null)} />
            <SummaryFeedback feedback={feedback} />
            <SummaryCourt courtNumber={selectedSlot.courtNumber} location={selectedSlot.location} />

            <div className="grid grid-cols-2 gap-4 border-b border-white/10 py-5">
              <SummaryField label="Día" value={formatLongDate(selectedDate)} />
              <SummaryField label="Horario" value={`${dateToTimeLabel(selectedSlot.start)} · ${SLOT_DURATION_MINUTES} min`} />
            </div>

            <div className="border-b border-white/10 py-5">
              <label
                htmlFor="class-capacity"
                className="mb-2 block text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase"
              >
                Cupo de alumnos
              </label>
              <select
                id="class-capacity"
                value={capacity}
                onChange={(event) => setCapacity(Number(event.target.value))}
                className="w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-sm font-semibold text-white pointer-coarse:min-h-11"
              >
                {CAPACITY_OPTIONS.map((option) => (
                  <option key={option} value={option} className="text-foreground">
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end justify-between gap-3 pt-5">
              <span className="text-sm text-white/60">Total cancha</span>
              <span className="text-4xl font-extrabold tracking-tight">{formatPrice(selectedSlot.price)}</span>
            </div>
            <p className="mt-3 text-xs text-white/45">
              Las clases no suman ni descuentan puntos. El pago se abona en la recepción del club.
            </p>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={isPending}
              className="btn btn-primary mt-5 w-full"
            >
              <GraduationCap className="h-4 w-4" />
              Reservar clase
            </button>
          </SummaryPanel>
        ) : (
          <div className="card hidden h-fit p-6 text-sm text-foreground/60 lg:block">
            Elegí un turno libre en la grilla para reservarlo como clase.
          </div>
        )}
      </div>
    </div>
  );
}
