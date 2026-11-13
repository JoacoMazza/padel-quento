"use client";

import { useMemo, useState } from "react";
import {
  CalendarX2,
  Clock,
  Sparkles,
  Users,
  Check,
} from "lucide-react";
import {
  SLOT_DURATION_MINUTES,
  formatPrice,
  minutesToTimeLabel,
} from "@/app/bookings/slot-utils";
import { CourtTag } from "@/app/components/ui/court-tag";
import type { CourtProp, Slot } from "@/app/bookings/types";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";

export type MatchTypeFilter = "all" | "regular" | "open";
export type TimeOfDayFilter = "all" | "morning" | "afternoon" | "night";

const STATUS_LABELS: Record<Slot["status"], string> = {
  available: "disponible",
  open: "partido abierto",
  occupied: "ocupado",
  outOfService: "fuera de servicio",
  selected: "seleccionado",
};

export function TimeSlotList({
  courtSlots,
  onSlotClick,
  matchTypeFilter = "all",
  timeOfDayFilter = "all",
  isSummaryOpen = false,
  onResetFilters,
}: {
  courtSlots: { court: CourtProp; slots: Slot[] }[];
  onSlotClick: (court: CourtProp, slot: Slot) => void;
  matchTypeFilter?: MatchTypeFilter;
  timeOfDayFilter?: TimeOfDayFilter;
  isSummaryOpen?: boolean;
  onResetFilters?: () => void;
}) {
  const [selectedCourtByTime, setSelectedCourtByTime] = useState<Record<number, number>>({});

  const allMinutes = useMemo(() => {
    return [...new Set(courtSlots.flatMap(({ slots }) => slots.map((s) => s.minutesOfDay)))].sort(
      (a, b) => a - b,
    );
  }, [courtSlots]);

  const timeEntries = useMemo(() => {
    const list: {
      minutes: number;
      availableCourts: { court: CourtProp; slot: Slot }[];
      openMatches: { court: CourtProp; slot: Slot }[];
      selectedCourt: { court: CourtProp; slot: Slot } | null;
    }[] = [];

    for (const minutes of allMinutes) {
      if (timeOfDayFilter === "morning" && minutes >= 14 * 60) continue;
      if (timeOfDayFilter === "afternoon" && (minutes < 14 * 60 || minutes >= 19 * 60)) continue;
      if (timeOfDayFilter === "night" && minutes < 19 * 60) continue;

      const availableCourts: { court: CourtProp; slot: Slot }[] = [];
      const openMatches: { court: CourtProp; slot: Slot }[] = [];
      let selectedCourt: { court: CourtProp; slot: Slot } | null = null;

      for (const { court, slots } of courtSlots) {
        const slot = slots.find((s) => s.minutesOfDay === minutes);
        if (!slot) continue;

        if (slot.status === "selected") {
          selectedCourt = { court, slot };
        } else if (slot.status === "open") {
          openMatches.push({ court, slot });
        } else if (slot.status === "available") {
          availableCourts.push({ court, slot });
        }
      }

      const showRegular = matchTypeFilter !== "open";
      const showOpen = matchTypeFilter !== "regular";

      const hasRelevantItems =
        (showRegular && (availableCourts.length > 0 || (selectedCourt && selectedCourt.slot.status === "selected"))) ||
        (showOpen && openMatches.length > 0);

      if (hasRelevantItems) {
        list.push({
          minutes,
          availableCourts: showRegular ? availableCourts : [],
          openMatches: showOpen ? openMatches : [],
          selectedCourt,
        });
      }
    }

    return list;
  }, [allMinutes, courtSlots, matchTypeFilter, timeOfDayFilter]);

  if (courtSlots.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm font-medium text-foreground/60">No hay canchas configuradas en el club.</p>
      </div>
    );
  }

  if (allMinutes.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-8 sm:p-10 text-center">
        <CalendarX2 className="h-10 w-10 text-foreground/30" />
        <h3 className="mt-3 font-display text-base font-bold text-foreground">El club se encuentra cerrado en esta fecha</h3>
        <p className="mt-1 max-w-sm text-xs text-foreground/60">
          No hay turnos disponibles para este día. Elegí otra fecha en la barra superior.
        </p>
      </div>
    );
  }

  if (timeEntries.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-8 sm:p-10 text-center">
        <Clock className="h-9 w-9 text-foreground/30" />
        <h3 className="mt-3 font-display text-base font-bold text-foreground">No hay turnos disponibles</h3>
        <p className="mt-1 max-w-sm text-xs text-foreground/60">
          No encontramos turnos con los filtros seleccionados. Probá cambiando la franja horaria o la fecha.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="btn btn-sm btn-outline mt-4"
          >
            Ver todos los turnos
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-2 ${
        isSummaryOpen ? "lg:grid-cols-2 xl:grid-cols-3" : "lg:grid-cols-3"
      } gap-3.5 items-start`}
    >
      {timeEntries.map(({ minutes, availableCourts, openMatches, selectedCourt }) => {
        const isTimeSelected = Boolean(selectedCourt && !openMatches.some((m) => m.court.id === selectedCourt.court.id));
        const activeCourtId =
          selectedCourt?.court.id ??
          selectedCourtByTime[minutes] ??
          availableCourts[0]?.court.id;

        const activeEntry =
          availableCourts.find((c) => c.court.id === activeCourtId) ??
          availableCourts[0] ??
          selectedCourt;

        return (
          <div key={minutes} className="contents">
            {/* 1. Tarjeta para Cancha Completa */}
            {activeEntry && (
              <div
                className={`card relative flex flex-col rounded-2xl p-4 transition-all ${
                  isTimeSelected
                    ? "border-primary/80 ring-2 ring-primary/20 bg-primary-light/10 shadow-sm"
                    : "border-line bg-card hover:border-foreground/30 hover:shadow-xs"
                }`}
              >
                <div>
                  {/* Horario y duración alineados con badge */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                          {minutesToTimeLabel(minutes)}
                        </span>
                        <span className="text-xs text-foreground/45">a</span>
                        <span className="text-xs font-bold text-foreground/70">
                          {minutesToTimeLabel(minutes + SLOT_DURATION_MINUTES)}
                        </span>
                      </div>

                      <p className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {availableCourts.length + (selectedCourt ? 1 : 0)}{" "}
                        {availableCourts.length + (selectedCourt ? 1 : 0) === 1
                          ? "cancha libre"
                          : "canchas libres"}
                      </p>
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground/50 uppercase">
                        {SLOT_DURATION_MINUTES}&apos;
                      </span>
                      {isTimeSelected && (
                        <span className="badge badge-primary text-[10px] font-bold">
                          ✓ Elegido
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Línea media: Cancha y Precios */}
                <div className="mt-4 flex items-center justify-between border-t border-line/60 pt-3">
                  {availableCourts.length > 1 ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-foreground/55 uppercase">Cancha:</span>
                      <select
                        value={activeCourtId}
                        onChange={(e) => {
                          const newCourtId = Number(e.target.value);
                          setSelectedCourtByTime((prev) => ({ ...prev, [minutes]: newCourtId }));
                          const chosen = availableCourts.find((c) => c.court.id === newCourtId);
                          if (chosen) {
                            onSlotClick(chosen.court, chosen.slot);
                          }
                        }}
                        className="h-7.5 rounded-lg border border-line bg-background px-2 text-xs font-bold text-foreground transition-colors hover:border-foreground/40 focus:border-primary focus:outline-none"
                      >
                        {availableCourts.map(({ court }) => (
                          <option key={court.id} value={court.id} className="text-foreground bg-card">
                            Cancha {court.number}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      <CourtTag number={activeEntry.court.number} size="xs" tone="dark" />
                      <span className="text-xs font-bold text-foreground">
                        Cancha {activeEntry.court.number}
                      </span>
                    </div>
                  )}

                  <div className="text-right">
                    <span className="font-display text-base font-extrabold tracking-tight text-foreground">
                      {formatPrice(activeEntry.court.price)}
                    </span>
                    <span className="block text-[10px] text-foreground/50">
                      {formatPrice(Math.round(activeEntry.court.price / OPEN_MATCH_MAX_PLAYERS))} / jug.
                    </span>
                  </div>
                </div>

                {/* Botón: fondo suave "gris rosita" con texto rojo cuando está seleccionado */}
                <div className="mt-3.5">
                  <button
                    type="button"
                    role="button"
                    aria-label={`Cancha ${activeEntry.court.number}, ${minutesToTimeLabel(
                      activeEntry.slot.minutesOfDay,
                    )}, ${isTimeSelected ? "seleccionado" : "disponible"}`}
                    onClick={() => onSlotClick(activeEntry.court, activeEntry.slot)}
                    className={`btn btn-sm flex-col w-full font-bold transition-all ${
                      isTimeSelected
                        ? "border border-primary bg-primary-light text-primary shadow-xs hover:bg-primary-light/80"
                        : "border border-primary text-primary bg-card hover:bg-primary hover:text-white shadow-2xs"
                    }`}
                  >
                    {isTimeSelected ? "✓ Seleccionado" : "Reservar turno"}
                  </button>
                </div>
              </div>
            )}

            {/* 2. Tarjeta para Partidos Abiertos */}
            {openMatches.map(({ court, slot }) => {
              const isMatchSelected =
                selectedCourt?.court.id === court.id && selectedCourt?.slot.status === "selected";
              const confirmed = slot.confirmedPlayers ?? 0;
              const missingPlayers = OPEN_MATCH_MAX_PLAYERS - confirmed;
              const pricePerPlayer = Math.round(court.price / OPEN_MATCH_MAX_PLAYERS);

              return (
                <div
                  key={`open-${court.id}`}
                  className={`card relative flex flex-col rounded-2xl p-4 transition-all ${
                    isMatchSelected
                      ? "border-primary/80 ring-2 ring-primary/20 bg-primary-light/15 shadow-sm"
                      : "border-primary/30 bg-primary-light/20 hover:border-primary/60 hover:shadow-xs"
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-baseline gap-1.5">
                          <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
                            {minutesToTimeLabel(minutes)}
                          </span>
                          <span className="badge badge-primary text-[10px] font-bold">
                            <Sparkles className="h-3 w-3" />
                            Partido Abierto
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-1.5">
                          <CourtTag number={court.number} size="xs" tone="dark" />
                          <span className="text-xs font-bold text-primary">
                            Faltan {missingPlayers} jugadores ({confirmed}/4)
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        <span className="rounded-md bg-background px-1.5 py-0.5 text-[10px] font-semibold text-foreground/50 uppercase">
                          {SLOT_DURATION_MINUTES}&apos;
                        </span>
                        {isMatchSelected && (
                          <span className="badge badge-primary text-[10px] font-bold">
                            ✓ Elegido
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t border-primary/15 pt-3">
                    <span className="text-xs font-medium text-foreground/60">
                      Cancha {court.number}
                    </span>
                    <div className="text-right">
                      <span className="font-display text-base font-extrabold tracking-tight text-foreground">
                        {formatPrice(pricePerPlayer)}
                      </span>
                      <span className="block text-[10px] text-foreground/50">por jugador</span>
                    </div>
                  </div>

                  <div className="mt-3.5">
                    <button
                      type="button"
                      role="button"
                      aria-label={`Cancha ${court.number}, ${minutesToTimeLabel(
                        slot.minutesOfDay,
                      )}, ${isMatchSelected ? "seleccionado" : "partido abierto"}`}
                      onClick={() => onSlotClick(court, slot)}
                      className={`btn btn-sm flex-col w-full font-bold transition-all ${
                        isMatchSelected
                          ? "border border-primary bg-primary-light text-primary shadow-xs hover:bg-primary-light/80"
                          : "border border-primary text-primary bg-card hover:bg-primary hover:text-white shadow-2xs"
                      }`}
                    >
                      {isMatchSelected ? "✓ Seleccionado" : "Sumarme"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
