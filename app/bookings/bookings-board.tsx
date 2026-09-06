"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookingState, CourtState, DayOfWeek } from "@/src/domain/enums";
import { createBooking } from "@/src/actions/booking";
import {
  SLOT_DURATION_MINUTES,
  buildSlotDate,
  dayOfWeekFromDate,
  formatLongDate,
  formatPrice,
  minutesToTimeLabel,
  parseISODate,
  rangesOverlap,
  timeStringToMinutes,
  toISODate,
} from "@/app/bookings/slot-utils";

const SLOT_PRICE = 10000;

type CourtProp = { id: number; number: number; state: CourtState };
type ScheduleProp = {
  id: number;
  dayOfWeek: DayOfWeek;
  openingTime: string;
  closingTime: string;
  courtId?: number;
};
type BookingProp = {
  id: number;
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  courtId?: number;
};
type OutOfServiceProp = {
  id: number;
  fromDateTime: Date;
  toDateTime: Date;
  courtId?: number;
};

type SlotStatus = "available" | "occupied" | "selected";

type Slot = {
  minutesOfDay: number;
  start: Date;
  end: Date;
  status: SlotStatus;
};

type SelectedSlot = {
  courtId: number;
  courtNumber: number;
  start: Date;
  end: Date;
};

export function BookingsBoard({
  playerId,
  courts,
  schedules,
  bookings,
  outOfServices,
}: {
  playerId: number | null;
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateInput, setDateInput] = useState(() => toISODate(new Date()));
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);
  const dayOfWeek = useMemo(() => dayOfWeekFromDate(selectedDate), [selectedDate]);

  const now = new Date();
  const isToday = toISODate(selectedDate) === toISODate(now);

  const visibleCourts = useMemo(
    () => (courtFilter === "all" ? courts : courts.filter((c) => String(c.id) === courtFilter)),
    [courts, courtFilter],
  );

  const courtSlots = useMemo(() => {
    return visibleCourts.map((court) => {
      const schedule = schedules.find(
        (s) => s.courtId === court.id && s.dayOfWeek === dayOfWeek,
      );

      const slots: Slot[] = [];

      if (schedule) {
        const openMinutes = timeStringToMinutes(schedule.openingTime);
        const closeMinutes = timeStringToMinutes(schedule.closingTime);
        const isCourtOutOfService = court.state !== CourtState.AVAILABLE;

        for (
          let minutesOfDay = openMinutes;
          minutesOfDay + SLOT_DURATION_MINUTES <= closeMinutes;
          minutesOfDay += SLOT_DURATION_MINUTES
        ) {
          const start = buildSlotDate(selectedDate, minutesOfDay);
          const end = new Date(start.getTime() + SLOT_DURATION_MINUTES * 60_000);

          const isPast = isToday && start < now;

          const isSelected =
            selectedSlot?.courtId === court.id &&
            selectedSlot.start.getTime() === start.getTime();

          const isBlockedByOutOfService = outOfServices.some(
            (o) =>
              o.courtId === court.id &&
              rangesOverlap(start, end, new Date(o.fromDateTime), new Date(o.toDateTime)),
          );

          const isBlockedByBooking = bookings.some((b) => {
            if (b.courtId !== court.id || b.bookingState === BookingState.CANCELLED) return false;
            const bookingStart = new Date(b.fromDateTime);
            const bookingEnd = new Date(bookingStart.getTime() + b.durationMinutes * 60_000);
            return rangesOverlap(start, end, bookingStart, bookingEnd);
          });

          const status: SlotStatus =
            isSelected
              ? "selected"
              : isCourtOutOfService || isPast || isBlockedByOutOfService || isBlockedByBooking
                ? "occupied"
                : "available";

          slots.push({ minutesOfDay, start, end, status });
        }
      }

      return { court, slots };
    });
  }, [visibleCourts, schedules, dayOfWeek, selectedDate, isToday, now, selectedSlot, outOfServices, bookings]);

  function handleSlotClick(court: CourtProp, slot: Slot) {
    if (slot.status === "occupied") return;
    setFeedback(null);

    if (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slot.start.getTime()) {
      setSelectedSlot(null);
      return;
    }

    setSelectedSlot({ courtId: court.id, courtNumber: court.number, start: slot.start, end: slot.end });
  }

  function handleConfirm() {
    if (!selectedSlot) return;

    if (!playerId) {
      setFeedback({ type: "error", message: "Tu cuenta no puede reservar turnos." });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await createBooking({
        fromDateTime: selectedSlot.start,
        durationMinutes: SLOT_DURATION_MINUTES,
        playerId,
        courtId: selectedSlot.courtId,
      });

      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      setFeedback({ type: "success", message: "¡Reserva confirmada!" });
      setSelectedSlot(null);
      router.refresh();
    });
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm md:flex-row md:items-stretch">
        <FilterBox label="Fecha" icon={<CalendarIcon />}>
          <span className="text-sm font-semibold text-foreground">
            {formatLongDate(selectedDate)}
          </span>
          <input
            type="date"
            value={dateInput}
            onChange={(event) => {
              setDateInput(event.target.value);
              setSelectedSlot(null);
              setFeedback(null);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </FilterBox>

        <FilterBox label="Cancha" icon={<CourtIcon />}>
          <span className="text-sm font-semibold text-foreground">
            {courtFilter === "all"
              ? "Todas"
              : `Cancha ${courts.find((c) => String(c.id) === courtFilter)?.number ?? ""}`}
          </span>
          <select
            value={courtFilter}
            onChange={(event) => {
              setCourtFilter(event.target.value);
              setSelectedSlot(null);
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          >
            <option value="all">Todas</option>
            {courts.map((court) => (
              <option key={court.id} value={String(court.id)}>
                Cancha {court.number}
              </option>
            ))}
          </select>
        </FilterBox>

        <FilterBox label="Duración" icon={<ClockIcon />}>
          <span className="text-sm font-semibold text-foreground">{SLOT_DURATION_MINUTES} min</span>
        </FilterBox>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {courtSlots.map(({ court, slots }) => (
            <CourtCard
              key={court.id}
              court={court}
              slots={slots}
              onSlotClick={(slot) => handleSlotClick(court, slot)}
            />
          ))}
          {courtSlots.length === 0 ? (
            <p className="text-sm text-foreground/60">No hay canchas para mostrar.</p>
          ) : null}
        </div>

        <aside className="h-fit rounded-2xl border border-line bg-card p-6 shadow-sm">
          <h2 className="text-lg font-extrabold text-foreground">Tu reserva</h2>

          {feedback ? (
            <p
              role="alert"
              className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
                feedback.type === "error"
                  ? "border border-danger/30 bg-danger-light text-danger"
                  : "border border-primary/30 bg-primary-light text-primary"
              }`}
            >
              {feedback.message}
            </p>
          ) : null}

          {selectedSlot ? (
            <div className="mt-4 flex flex-col gap-4">
              <SummaryRow icon={<CalendarIcon />} label="Fecha" value={formatLongDate(selectedDate)} />
              <SummaryRow
                icon={<CourtIcon />}
                label="Cancha"
                value={`Cancha ${selectedSlot.courtNumber}`}
              />
              <SummaryRow
                icon={<ClockIcon />}
                label="Horario"
                value={`${minutesToTimeLabel(selectedSlot.start.getHours() * 60 + selectedSlot.start.getMinutes())} – ${minutesToTimeLabel(selectedSlot.end.getHours() * 60 + selectedSlot.end.getMinutes())}`}
              />
              <SummaryRow icon={<ClockIcon />} label="Duración" value={`${SLOT_DURATION_MINUTES} min`} />
              <SummaryRow icon={<PriceIcon />} label="Precio" value={formatPrice(SLOT_PRICE)} />

              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="mt-2 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
              >
                {isPending ? "Confirmando…" : "Confirmar reserva"}
              </button>
            </div>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-foreground/60">
              Elegí un turno disponible para ver el resumen de tu reserva.
            </p>
          )}
        </aside>
      </div>

      <div className="mt-6 flex items-center gap-6 text-sm text-foreground/70">
        <LegendItem className="border border-line bg-card" label="Disponible" />
        <LegendItem className="bg-line" label="Ocupado" />
        <LegendItem className="bg-primary" label="Seleccionado" />
      </div>
    </div>
  );
}

function CourtCard({
  court,
  slots,
  onSlotClick,
}: {
  court: CourtProp;
  slots: Slot[];
  onSlotClick: (slot: Slot) => void;
}) {
  const isAvailable = court.state === CourtState.AVAILABLE;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-foreground">Cancha {court.number}</h3>
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isAvailable ? "text-green-600" : "text-danger"
          }`}
        >
          <span
            className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-600" : "bg-danger"}`}
          />
          {isAvailable ? "Disponible" : "Fuera de servicio"}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-foreground/60">Pista de pádel · Nivel estándar</p>

      <div className="mt-4 border-t border-line pt-4">
        {slots.length === 0 ? (
          <p className="text-sm text-foreground/50">Sin turnos para este día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot) => (
              <button
                key={slot.minutesOfDay}
                type="button"
                disabled={slot.status === "occupied"}
                onClick={() => onSlotClick(slot)}
                className={`h-11 rounded-lg text-sm font-semibold transition-all ${
                  slot.status === "selected"
                    ? "bg-primary text-white shadow-sm"
                    : slot.status === "occupied"
                      ? "cursor-not-allowed bg-line/70 text-foreground/40"
                      : "border border-line bg-card text-foreground hover:border-primary hover:text-primary cursor-pointer"
                }`}
              >
                {minutesToTimeLabel(slot.minutesOfDay)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBox({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex flex-1 items-center gap-3 rounded-xl border border-line bg-background px-4 py-2.5">
      <span className="text-foreground/50">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-foreground/50">{label}</span>
        {children}
      </div>
    </div>
  );
}

function SummaryRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-foreground/40">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-foreground/50">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}

function LegendItem({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span className={`h-3.5 w-3.5 rounded-full ${className}`} />
      {label}
    </span>
  );
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" strokeLinecap="round" />
    </svg>
  );
}

function CourtIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18M3 12h18" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PriceIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 15.5c0 1 1 1.8 2.5 1.8s2.5-.7 2.5-1.7c0-2.5-5-1.3-5-3.8 0-1 1-1.7 2.5-1.7s2.5.7 2.5 1.7M12 7.5v9" strokeLinecap="round" />
    </svg>
  );
}
