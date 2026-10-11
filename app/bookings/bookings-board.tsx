"use client";

import { useMemo, useState, useTransition } from "react";
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

/** "Mié 14 Oct". */
function dayLabel(date: Date) {
  return `${capitalize(DAY_LABEL_WEEKDAY_FORMATTER.format(date))} ${date.getDate()} ${capitalize(DAY_LABEL_MONTH_FORMATTER.format(date))}`;
}

export function BookingsBoard({
  playerId,
  bookerId,
  courts,
  schedules,
  bookings,
  outOfServices,
}: {
  playerId: number | null;
  bookerId: number | null;
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dateInput, setDateInput] = useState(() =>
    toISODate(getInitialBoardDate(courts, schedules, new Date())),
  );
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [isOpenMatch, setIsOpenMatch] = useState(false);
  const [openMatchGroupSize, setOpenMatchGroupSize] = useState(1);
  const [selectedOpenMatch, setSelectedOpenMatch] = useState<SelectedOpenMatch | null>(null);
  const [joinGroupSize, setJoinGroupSize] = useState(1);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

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

  function handleSlotClick(court: CourtProp, slot: Slot) {
    if (slot.status === "occupied") return;
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
      const openBooking = bookings.find((b) => b.id === slot.bookingId);
      setSelectedOpenMatch({
        bookingId: slot.bookingId!,
        courtId: court.id,
        courtNumber: court.number,
        price: openBooking?.price ?? court.price,
        start: slot.start,
        end: slot.end,
        confirmedPlayers: slot.confirmedPlayers ?? 0,
        alreadyJoined: slot.alreadyJoined ?? false,
      });
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
    setSelectedSlot({
      courtId: court.id,
      courtNumber: court.number,
      price: court.price,
      start: slot.start,
      end: slot.end,
    });
    setIsOpenMatch(false);
    setOpenMatchGroupSize(1);
  }

  function handleConfirm() {
    if (!selectedSlot) return;

    if (!bookerId) {
      setFeedback({ type: "error", message: "Tu cuenta no puede reservar turnos." });
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
        bookerId,
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

    if (!playerId) {
      setFeedback({ type: "error", message: "Tu cuenta no puede sumarse a partidos." });
      return;
    }

    setFeedback(null);
    startTransition(async () => {
      const result = await joinOpenMatch({
        bookingId: selectedOpenMatch.bookingId,
        playerId,
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

      <div className="mt-6 flex items-center gap-2 overflow-x-auto pb-1">
        <span className="label-caps mr-2 shrink-0">Filtrar:</span>
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

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <AvailabilityGrid courtSlots={courtSlots} onSlotClick={handleSlotClick} />

        {selectedOpenMatch ? (
          <JoinMatchPanel
            selectedDate={selectedDate}
            selectedMatch={selectedOpenMatch}
            feedback={feedback}
            isPending={isPending}
            alreadyJoined={selectedOpenMatch.alreadyJoined}
            groupSize={joinGroupSize}
            onGroupSizeChange={setJoinGroupSize}
            onConfirm={handleJoinConfirm}
          />
        ) : (
          <BookingSummary
            selectedDate={selectedDate}
            selectedSlot={selectedSlot}
            feedback={feedback}
            isPending={isPending}
            isOpenMatch={isOpenMatch}
            onIsOpenMatchChange={setIsOpenMatch}
            openMatchGroupSize={openMatchGroupSize}
            onOpenMatchGroupSizeChange={setOpenMatchGroupSize}
            onConfirm={handleConfirm}
          />
        )}
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
