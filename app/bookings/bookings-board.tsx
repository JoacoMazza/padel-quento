"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { createBooking, joinOpenMatch } from "@/src/actions/booking";
import { AvailabilityGrid } from "@/app/bookings/availability-grid";
import { BookingSearchBar, type TimeFilterValue } from "@/app/bookings/booking-search-bar";
import { BookingSummary } from "@/app/bookings/booking-summary";
import { JoinMatchPanel } from "@/app/bookings/join-match-panel";
import { TimeSlotList } from "@/app/bookings/time-slot-list";
import {
  SLOT_DURATION_MINUTES,
  buildCourtSlots,
  formatLongDate,
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

/** Turno que se había elegido antes de ir a iniciar sesión (llega en la URL de /bookings). */
export type InitialSelection = { date: string; courtId: number; time: string; isOpenMatch?: boolean };

/** Login que, al terminar, vuelve a /bookings con el mismo turno elegido. */
function loginUrlFor(courtId: number, start: Date) {
  const time = minutesToTimeLabel(start.getHours() * 60 + start.getMinutes());
  const bookingsUrl = `/bookings?date=${toISODate(start)}&court=${courtId}&time=${time}`;
  return `/login?callbackUrl=${encodeURIComponent(bookingsUrl)}`;
}

function toSelectedSlot(court: CourtProp, slot: Slot): SelectedSlot {
  return {
    courtId: court.id,
    courtNumber: court.number,
    location: court.location,
    price: court.price,
    start: slot.start,
    end: slot.end,
  };
}

function toSelectedOpenMatch(court: CourtProp, slot: Slot, bookings: BookingProp[]): SelectedOpenMatch {
  const openBooking = bookings.find((b) => b.id === slot.bookingId);
  return {
    bookingId: slot.bookingId!,
    courtId: court.id,
    courtNumber: court.number,
    location: court.location,
    price: openBooking?.price ?? court.price,
    start: slot.start,
    end: slot.end,
    confirmedPlayers: slot.confirmedPlayers ?? 0,
    alreadyJoined: slot.alreadyJoined ?? false,
  };
}

export function BookingsBoard({
  playerId,
  isGuest,
  initialSelection,
  hasCategory,
  defaultView,
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
  /** Vista inicial del tablero: "list" (por defecto) o "grid". */
  defaultView?: "list" | "grid";
  courts: CourtProp[];
  schedules: ScheduleProp[];
  bookings: BookingProp[];
  outOfServices: OutOfServiceProp[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [timeFilter, setTimeFilter] = useState<TimeFilterValue>("all");

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

  const resultsRef = useRef<HTMLDivElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedSlot && !selectedOpenMatch) return;
    if (window.matchMedia?.("(min-width: 64rem)").matches) return;
    summaryRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [selectedSlot, selectedOpenMatch]);

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);
  const now = new Date();

  const visibleCourts = useMemo(
    () => (courtFilter === "all" ? courts : courts.filter((c) => String(c.id) === courtFilter)),
    [courts, courtFilter],
  );

  const slotsForDay = (date: Date, dayCourts: CourtProp[]) =>
    dayCourts.map((court) => ({
      court,
      slots: buildCourtSlots({ court, schedules, bookings, outOfServices, date, now, playerId }),
    }));

  // Solo los horarios que efectivamente tienen turnos disponibles para reservar en la fecha y canchas seleccionadas
  const availableClubTimes = useMemo(() => {
    const courtsToCheck = courtFilter === "all" ? courts : courts.filter((c) => String(c.id) === courtFilter);
    const dayCourtSlots = slotsForDay(selectedDate, courtsToCheck);

    const timeMap = new Map<string, number>();

    for (const { slots } of dayCourtSlots) {
      for (const slot of slots) {
        if (slot.status === "available") {
          const timeLabel = minutesToTimeLabel(slot.minutesOfDay);
          timeMap.set(timeLabel, (timeMap.get(timeLabel) ?? 0) + 1);
        }
      }
    }

    const sortedTimes = [...timeMap.keys()].sort((a, b) => a.localeCompare(b));
    return sortedTimes.map((time) => ({
      time,
      availableCount: timeMap.get(time) ?? 0,
    }));
  }, [selectedDate, courts, courtFilter, schedules, bookings, outOfServices, now, playerId]);

  // Canchas disponibles para reservar en la fecha seleccionada, filtradas dinámicamente si hay un horario seleccionado
  const availableCourts = useMemo(() => {
    const allSlots = slotsForDay(selectedDate, courts);

    return courts.filter((court) => {
      const courtData = allSlots.find((c) => c.court.id === court.id);
      if (!courtData) return false;

      if (timeFilter === "all") {
        return courtData.slots.some(
          (s) =>
            s.status === "available" ||
            (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === s.start.getTime()),
        );
      } else {
        const slotAtTime = courtData.slots.find((s) => minutesToTimeLabel(s.minutesOfDay) === timeFilter);
        if (!slotAtTime) return false;
        return (
          slotAtTime.status === "available" ||
          (selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === slotAtTime.start.getTime())
        );
      }
    });
  }, [selectedDate, courts, timeFilter, schedules, bookings, outOfServices, now, playerId, selectedSlot]);

  // Si cambia la fecha o la cancha y el horario seleccionado ya no tiene disponibilidad, volvemos a "all"
  useEffect(() => {
    if (timeFilter !== "all" && availableClubTimes.length > 0) {
      const isStillAvailable = availableClubTimes.some((t) => t.time === timeFilter);
      if (!isStillAvailable) {
        setTimeFilter("all");
      }
    }
  }, [availableClubTimes, timeFilter]);

  // Si cambia el horario y la cancha seleccionada ya no está disponible en ese horario, volvemos a "all"
  useEffect(() => {
    if (courtFilter !== "all" && availableCourts.length > 0) {
      const isStillAvailable = availableCourts.some((c) => String(c.id) === courtFilter);
      if (!isStillAvailable) {
        setCourtFilter("all");
      }
    }
  }, [availableCourts, courtFilter]);

  // El turno elegido se marca sobre los turnos calculados
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

  function handleSlotClick(court: CourtProp, slot: Slot, asOpenMatch?: boolean) {
    if (slot.status === "occupied" || slot.status === "outOfService") return;
    setFeedback(null);

    // Si ya está elegido, desmarcarlo
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
    setIsOpenMatch(asOpenMatch ?? false);
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

  const dateDescription = formatLongDate(selectedDate);

  return (
    <div className="mt-6">
      {/* 1. Barra de búsqueda principal estilo flotante */}
      <BookingSearchBar
        selectedDateISO={dateInput}
        onDateChange={(iso) => {
          setDateInput(iso);
          resetSelection();
          setFeedback(null);
        }}
        timeFilter={timeFilter}
        onTimeChange={(val) => {
          setTimeFilter(val);
          resetSelection();
        }}
        availableTimes={availableClubTimes}
        selectedCourtId={courtFilter}
        onCourtChange={(val) => {
          setCourtFilter(val);
          resetSelection();
        }}
        courts={availableCourts}
        onSearchClick={() => {
          resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
        }}
      />

      {/* 2. Barra de estado limpia */}
      <div ref={resultsRef} className="scroll-mt-4 mb-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-sm font-bold text-foreground">
              Turnos para el {dateDescription}
            </h3>
            <p className="text-xs text-foreground/50">
              {daySummary.free} {daySummary.free === 1 ? "opción libre" : "opciones libres"}
              {courtFilter !== "all" && (
                <span className="font-semibold text-foreground">
                  {" "}· Cancha {courts.find((c) => String(c.id) === courtFilter)?.number}
                </span>
              )}
            </p>
          </div>
        </div>
      </div>

      {/* 3. Lista de turnos y columna de resumen */}
      <div
        className={`mt-4 grid grid-cols-1 gap-6 items-start ${
          selectedSlot || selectedOpenMatch ? "lg:grid-cols-[minmax(0,1fr)_340px]" : ""
        }`}
      >
        {defaultView === "grid" ? (
          <AvailabilityGrid courtSlots={courtSlots} onSlotClick={handleSlotClick} />
        ) : (
          <TimeSlotList
            courtSlots={courtSlots}
            onSlotClick={handleSlotClick}
            timeFilter={timeFilter}
            selectedCourtId={courtFilter}
            isSummaryOpen={Boolean(selectedSlot || selectedOpenMatch)}
            isOpenMatch={isOpenMatch}
            onIsOpenMatchChange={setIsOpenMatch}
            onResetFilters={() => {
              setTimeFilter("all");
              setCourtFilter("all");
            }}
          />
        )}

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
    </div>
  );
}
