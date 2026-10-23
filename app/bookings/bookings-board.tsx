"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldCheck, Users, Zap } from "lucide-react";
import { LATE_CANCELLATION_HOURS, OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { createBooking, joinOpenMatch } from "@/src/actions/booking";
import { AvailabilityGrid } from "@/app/bookings/availability-grid";
import { BookingSummary } from "@/app/bookings/booking-summary";
import { DayStrip, type DayOption } from "@/app/bookings/day-strip";
import { JoinMatchPanel } from "@/app/bookings/join-match-panel";
import {
  SLOT_DURATION_MINUTES,
  buildCourtSlots,
  getInitialBoardDate,
  minutesToTimeLabel,
  parseISODate,
  summarizeSlots,
  toISODate,
} from "@/app/bookings/slot-utils";
import type {
  BookingProp,
  CourtProp,
  OutOfServiceProp,
  ScheduleProp,
  SelectedOpenMatch,
  SelectedSlot,
  Slot,
} from "@/app/bookings/types";

/** Cantidad de días que se muestran en la tira de fechas, empezando por hoy. */
const DAY_STRIP_LENGTH = 5;

const DAY_CAPTION_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
const DAY_LABEL_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short" });
const DAY_LABEL_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "short" });

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(".", "");
}

/** Turno que se había elegido antes de ir a iniciar sesión (llega en la URL de /bookings). */
export type InitialSelection = { date: string; courtId: number; time: string; isOpenMatch?: boolean };

/** Login que, al terminar, vuelve a /bookings con el mismo turno elegido. */
function loginUrlFor(courtId: number, start: Date) {
  const time = minutesToTimeLabel(start.getHours() * 60 + start.getMinutes());
  const bookingsUrl = `/bookings?date=${toISODate(start)}&court=${courtId}&time=${time}`;
  return `/login?callbackUrl=${encodeURIComponent(bookingsUrl)}`;
}

function toSelectedSlot(court: CourtProp, slot: Slot): SelectedSlot {
  return { courtId: court.id, courtNumber: court.number, price: court.price, start: slot.start, end: slot.end };
}

function toSelectedOpenMatch(court: CourtProp, slot: Slot, bookings: BookingProp[]): SelectedOpenMatch {
  const openBooking = bookings.find((b) => b.id === slot.bookingId);
  return {
    bookingId: slot.bookingId!,
    courtId: court.id,
    courtNumber: court.number,
    price: openBooking?.price ?? court.price,
    start: slot.start,
    end: slot.end,
    confirmedPlayers: slot.confirmedPlayers ?? 0,
    alreadyJoined: slot.alreadyJoined ?? false,
  };
}

/** "Mié 14 Oct". */
function dayLabel(date: Date) {
  return `${capitalize(DAY_LABEL_WEEKDAY_FORMATTER.format(date))} ${date.getDate()} ${capitalize(DAY_LABEL_MONTH_FORMATTER.format(date))}`;
}

export function BookingsBoard({
  playerId,
  isGuest,
  initialSelection,
  hasCategory,
  courts,
  schedules,
  bookings,
  outOfServices,
}: {
  playerId: number | null;
  /** Visitante sin sesión: puede ver y elegir turnos, pero reservar lo manda a iniciar sesión. */
  isGuest: boolean;
  initialSelection?: InitialSelection;
  /** Si el jugador logueado cargó su categoría: la requieren los partidos abiertos. */
  hasCategory: boolean;
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // El turno elegido antes de iniciar sesión vuelve seleccionado, si sigue disponible.
  const [initialPick] = useState(() => {
    const court = initialSelection && courts.find((c) => c.id === initialSelection.courtId);
    if (!initialSelection || !court) return null;
    const slot = buildCourtSlots({
      court,
      schedules,
      bookings,
      outOfServices,
      date: parseISODate(initialSelection.date),
      now: new Date(),
      playerId,
    }).find((s) => minutesToTimeLabel(s.minutesOfDay) === initialSelection.time);
    if (slot?.status === "available") return { date: initialSelection.date, slot: toSelectedSlot(court, slot) };
    if (slot?.status === "open") return { date: initialSelection.date, openMatch: toSelectedOpenMatch(court, slot, bookings) };
    return null;
  });
  const [dateInput, setDateInput] = useState(
    () => initialPick?.date ?? toISODate(getInitialBoardDate(courts, schedules, new Date())),
  );
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(initialPick?.slot ?? null);
  const [isOpenMatch, setIsOpenMatch] = useState(() => initialSelection?.isOpenMatch ?? false);
  const [openMatchGroupSize, setOpenMatchGroupSize] = useState(1);
  const [selectedOpenMatch, setSelectedOpenMatch] = useState<SelectedOpenMatch | null>(initialPick?.openMatch ?? null);
  const [joinGroupSize, setJoinGroupSize] = useState(1);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  // Debajo de lg el resumen queda debajo de la grilla, fuera de la vista: al elegir
  // un turno o un partido se lleva la vista hasta él.
  const summaryRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!selectedSlot && !selectedOpenMatch) return;
    if (window.matchMedia?.("(min-width: 64rem)").matches) return;
    summaryRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [selectedSlot, selectedOpenMatch]);

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);

  const now = new Date();
  const todayISODate = toISODate(now);

  const visibleCourts = useMemo(
    () => (courtFilter === "all" ? courts : courts.filter((c) => String(c.id) === courtFilter)),
    [courts, courtFilter],
  );

  const slotsForDay = (date: Date, dayCourts: CourtProp[]) =>
    dayCourts.map((court) => ({
      court,
      slots: buildCourtSlots({ court, schedules, bookings, outOfServices, date, now, playerId }),
    }));

  // El turno elegido (para reservar o para sumarse) se marca sobre los turnos calculados.
  const courtSlots = slotsForDay(selectedDate, visibleCourts).map(({ court, slots }) => ({
    court,
    slots: slots.map((slot): Slot => {
      const isSelected =
        (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slot.start.getTime()) ||
        (selectedOpenMatch?.courtId === court.id && selectedOpenMatch.start.getTime() === slot.start.getTime());
      return isSelected ? { ...slot, status: "selected" } : slot;
    }),
  }));

  const daySummary = summarizeSlots(slotsForDay(selectedDate, courts).map((c) => c.slots));

  const days: DayOption[] = Array.from({ length: DAY_STRIP_LENGTH }, (_, offset) => {
    const date = parseISODate(todayISODate);
    date.setDate(date.getDate() + offset);
    const slotsByCourt = slotsForDay(date, courts).map((c) => c.slots);
    return {
      iso: toISODate(date),
      caption: offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : DAY_CAPTION_FORMATTER.format(date),
      label: dayLabel(date),
      free: summarizeSlots(slotsByCourt).free,
      hasSchedule: slotsByCourt.some((slots) => slots.length > 0),
    };
  });

  function resetSelection() {
    setSelectedSlot(null);
    setIsOpenMatch(false);
    setOpenMatchGroupSize(1);
    setSelectedOpenMatch(null);
    setJoinGroupSize(1);
  }

  function handleSummaryClose() {
    resetSelection();
    setFeedback(null);
  }

  function handleSlotClick(court: CourtProp, slot: Slot) {
    if (slot.status === "occupied" || slot.status === "outOfService") return;
    setFeedback(null);

    // Ya elegido, el partido abierto figura como "selected": volver a tocarlo lo deselecciona.
    if (selectedOpenMatch?.courtId === court.id && selectedOpenMatch.start.getTime() === slot.start.getTime()) {
      setSelectedOpenMatch(null);
      setJoinGroupSize(1);
      return;
    }

    if (slot.status === "open") {
      setSelectedSlot(null);
      setIsOpenMatch(false);
      setOpenMatchGroupSize(1);
      setJoinGroupSize(1);
      setSelectedOpenMatch(toSelectedOpenMatch(court, slot, bookings));
      return;
    }

    if (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slot.start.getTime()) {
      setSelectedSlot(null);
      setIsOpenMatch(false);
      setOpenMatchGroupSize(1);
      return;
    }

    setSelectedOpenMatch(null);
    setJoinGroupSize(1);
    setSelectedSlot(toSelectedSlot(court, slot));
    setIsOpenMatch(false);
    setOpenMatchGroupSize(1);
  }

  function handleConfirm() {
    if (!selectedSlot) return;

    if (isGuest) {
      router.push(loginUrlFor(selectedSlot.courtId, selectedSlot.start));
      return;
    }

    const groupSize = isOpenMatch ? openMatchGroupSize : OPEN_MATCH_MAX_PLAYERS;

    setFeedback(null);
    startTransition(async () => {
      const result = await createBooking({
        fromDateTime: selectedSlot.start,
        durationMinutes: SLOT_DURATION_MINUTES,
        price: selectedSlot.price,
        groupSize,
        courtId: selectedSlot.courtId,
      });

      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      router.push("/my-bookings");
    });
  }

  function handleJoinConfirm() {
    if (!selectedOpenMatch || selectedOpenMatch.alreadyJoined) return;

    if (isGuest) {
      router.push(loginUrlFor(selectedOpenMatch.courtId, selectedOpenMatch.start));
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await joinOpenMatch({
        bookingId: selectedOpenMatch.bookingId,
        groupSize: joinGroupSize,
      });

      if (!result.success) {
        setFeedback({ type: "error", message: result.error });
        return;
      }

      router.push("/my-bookings");
    });
  }

  return (
    <div className="mt-8">
      <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
        <span className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-success" />
          Libres: <strong>{daySummary.free} turnos</strong>
        </span>
        <span className="flex items-center gap-2 rounded-full border border-line bg-card px-4 py-2">
          <span className="h-2 w-2 rounded-full bg-primary" />
          Partidos abiertos: <strong>{daySummary.open}</strong>
        </span>
      </div>

      <p className="label-caps mb-3">Filtrar</p>
      <DayStrip
        days={days}
        selectedISO={dateInput}
        todayISO={todayISODate}
        onSelect={(value) => {
          setDateInput(value);
          resetSelection();
          setFeedback(null);
        }}
      />

      <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {[{ id: "all", label: `Todas las canchas (${courts.length})` }, ...courts.map((c) => ({ id: String(c.id), label: `Cancha ${c.number}` }))].map(
          (option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={courtFilter === option.id}
              onClick={() => {
                setCourtFilter(option.id);
                resetSelection();
              }}
              className={`chip shrink-0 ${courtFilter === option.id ? "chip-active" : ""}`}
            >
              {option.label}
            </button>
          ),
        )}
      </div>

      {/* La columna del resumen aparece solo mientras hay un turno elegido. */}
      <div
        className={`mt-6 grid grid-cols-1 gap-6 ${selectedSlot || selectedOpenMatch ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""}`}
      >
        <AvailabilityGrid courtSlots={courtSlots} onSlotClick={handleSlotClick} />

        {selectedSlot || selectedOpenMatch ? (
          <div ref={summaryRef} className="scroll-mt-20">
            {selectedOpenMatch ? (
              <JoinMatchPanel
                selectedDate={selectedDate}
                selectedMatch={selectedOpenMatch}
                feedback={feedback}
                isPending={isPending}
                alreadyJoined={selectedOpenMatch.alreadyJoined}
                hasCategory={hasCategory}
                groupSize={joinGroupSize}
                onGroupSizeChange={setJoinGroupSize}
                onConfirm={handleJoinConfirm}
                onClose={handleSummaryClose}
              />
            ) : selectedSlot ? (
              <BookingSummary
                selectedDate={selectedDate}
                selectedSlot={selectedSlot}
                feedback={feedback}
                isPending={isPending}
                isOpenMatch={isOpenMatch}
                onIsOpenMatchChange={setIsOpenMatch}
                hasCategory={hasCategory}
                openMatchGroupSize={openMatchGroupSize}
                onOpenMatchGroupSizeChange={setOpenMatchGroupSize}
                onConfirm={handleConfirm}
                onClose={handleSummaryClose}
              />
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
        <InfoCard icon={<Zap className="h-5 w-5" />} title="Confirmación al instante">
          Tu turno de {SLOT_DURATION_MINUTES} minutos queda reservado apenas lo confirmás.
        </InfoCard>
        <InfoCard icon={<Users className="h-5 w-5" />} title="Partidos abiertos">
          ¿Te faltan jugadores? Abrí el partido y la comunidad completa los {OPEN_MATCH_MAX_PLAYERS} lugares.
        </InfoCard>
        <InfoCard icon={<ShieldCheck className="h-5 w-5" />} title="Cancelación sin cargo">
          Hasta {LATE_CANCELLATION_HOURS} horas antes del turno, sin descuento de puntos.
        </InfoCard>
      </div>
    </div>
  );
}

function InfoCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="card flex items-start gap-4 p-5">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary-light text-primary">
        {icon}
      </span>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-foreground/60">{children}</p>
      </div>
    </div>
  );
}
