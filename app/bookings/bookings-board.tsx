"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookingState, CourtState } from "@/src/domain/enums";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { createBooking } from "@/src/actions/booking";
import { BookingSummary } from "@/app/bookings/booking-summary";
import { CourtCard } from "@/app/bookings/court-card";
import { FilterBar } from "@/app/bookings/filter-bar";
import { Legend } from "@/app/bookings/legend";
import {
  SLOT_DURATION_MINUTES,
  buildSlotDate,
  dayOfWeekFromDate,
  getInitialBoardDate,
  parseISODate,
  rangesOverlap,
  timeStringToMinutes,
  toISODate,
} from "@/app/bookings/slot-utils";
import type {
  BookingProp,
  CourtProp,
  OutOfServiceProp,
  ScheduleProp,
  SelectedSlot,
  Slot,
  SlotStatus,
} from "@/app/bookings/types";

const SLOT_PRICE = 10000;

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
  const [dateInput, setDateInput] = useState(() =>
    toISODate(getInitialBoardDate(courts, schedules, new Date())),
  );
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [selectedSlot, setSelectedSlot] = useState<SelectedSlot | null>(null);
  const [isOpenMatch, setIsOpenMatch] = useState(false);
  const [openMatchGroupSize, setOpenMatchGroupSize] = useState(1);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; message: string } | null>(
    null,
  );

  const selectedDate = useMemo(() => parseISODate(dateInput), [dateInput]);
  const dayOfWeek = useMemo(() => dayOfWeekFromDate(selectedDate), [selectedDate]);

  const now = new Date();
  const todayISODate = toISODate(now);
  const isToday = toISODate(selectedDate) === todayISODate;

  const visibleCourts = useMemo(
    () => (courtFilter === "all" ? courts : courts.filter((c) => String(c.id) === courtFilter)),
    [courts, courtFilter],
  );

  const courtSlots = useMemo(() => {
    return visibleCourts.map((court) => {
      const schedule = schedules.find((s) => s.courtId === court.id && s.dayOfWeek === dayOfWeek);
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
            selectedSlot?.courtId === court.id && selectedSlot.start.getTime() === start.getTime();

          const isBlockedByOutOfService = outOfServices.some(
            (o) =>
              o.courtId === court.id &&
              rangesOverlap(start, end, new Date(o.fromDateTime), new Date(o.toDateTime)),
          );

          const overlappingBooking = bookings.find((b) => {
            if (b.courtId !== court.id || b.bookingState === BookingState.CANCELLED) return false;
            const bookingStart = new Date(b.fromDateTime);
            const bookingEnd = new Date(bookingStart.getTime() + b.durationMinutes * 60_000);
            return rangesOverlap(start, end, bookingStart, bookingEnd);
          });

          // Un partido abierto no cuenta como ocupado: todavía busca jugadores.
          const isOpenMatch = overlappingBooking?.needPlayers === true;

          const status: SlotStatus = isSelected
            ? "selected"
            : isCourtOutOfService || isPast || isBlockedByOutOfService || overlappingBooking
              ? isOpenMatch && !isCourtOutOfService && !isPast && !isBlockedByOutOfService
                ? "open"
                : "occupied"
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
      setIsOpenMatch(false);
      setOpenMatchGroupSize(1);
      return;
    }

    setSelectedSlot({ courtId: court.id, courtNumber: court.number, start: slot.start, end: slot.end });
    setIsOpenMatch(false);
    setOpenMatchGroupSize(1);
  }

  function handleConfirm() {
    if (!selectedSlot) return;

    if (!playerId) {
      setFeedback({ type: "error", message: "Tu cuenta no puede reservar turnos." });
      return;
    }

    const groupSize = isOpenMatch ? openMatchGroupSize : OPEN_MATCH_MAX_PLAYERS;

    setFeedback(null);
    startTransition(async () => {
      const result = await createBooking({
        fromDateTime: selectedSlot.start,
        durationMinutes: SLOT_DURATION_MINUTES,
        groupSize,
        playerId,
        courtId: selectedSlot.courtId,
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
      <FilterBar
        selectedDate={selectedDate}
        dateInput={dateInput}
        todayISODate={todayISODate}
        courts={courts}
        courtFilter={courtFilter}
        onDateChange={(value) => {
          setDateInput(value);
          setSelectedSlot(null);
          setIsOpenMatch(false);
          setOpenMatchGroupSize(1);
          setFeedback(null);
        }}
        onCourtFilterChange={(value) => {
          setCourtFilter(value);
          setSelectedSlot(null);
          setIsOpenMatch(false);
          setOpenMatchGroupSize(1);
        }}
      />

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

        <BookingSummary
          selectedDate={selectedDate}
          selectedSlot={selectedSlot}
          feedback={feedback}
          isPending={isPending}
          price={SLOT_PRICE}
          isOpenMatch={isOpenMatch}
          onIsOpenMatchChange={setIsOpenMatch}
          openMatchGroupSize={openMatchGroupSize}
          onOpenMatchGroupSizeChange={setOpenMatchGroupSize}
          onConfirm={handleConfirm}
        />
      </div>

      <Legend />
    </div>
  );
}
