"use client";

import { useMemo } from "react";
import {
  CalendarX2,
  Check,
  Clock,
} from "lucide-react";
import {
  SLOT_DURATION_MINUTES,
  formatPrice,
  minutesToTimeLabel,
} from "@/app/bookings/slot-utils";
import type { CourtProp, Slot } from "@/app/bookings/types";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";

export type MatchTypeFilter = "all" | "regular" | "open";

export function TimeSlotList({
  courtSlots,
  onSlotClick,
  matchTypeFilter = "all",
  timeFilter = "all",
  selectedCourtId = "all",
  isSummaryOpen = false,
  isOpenMatch,
  onIsOpenMatchChange,
  onResetFilters,
}: {
  courtSlots: { court: CourtProp; slots: Slot[] }[];
  onSlotClick: (court: CourtProp, slot: Slot, asOpenMatch?: boolean) => void;
  matchTypeFilter?: MatchTypeFilter;
  timeFilter?: string;
  selectedCourtId?: string;
  isSummaryOpen?: boolean;
  isOpenMatch?: boolean;
  onIsOpenMatchChange?: (value: boolean) => void;
  onResetFilters?: () => void;
}) {
  const allMinutes = useMemo(() => {
    return [...new Set(courtSlots.flatMap(({ slots }) => slots.map((s) => s.minutesOfDay)))].sort(
      (a, b) => a - b,
    );
  }, [courtSlots]);

  const timeEntries = useMemo(() => {
    const list: {
      minutes: number;
      availableCourts: { court: CourtProp; slot: Slot }[];
      selectedCourt: { court: CourtProp; slot: Slot } | null;
    }[] = [];

    const isSpecificTime = timeFilter !== "all";

    for (const minutes of allMinutes) {
      const timeLabel = minutesToTimeLabel(minutes);

      // Si se filtró por un horario específico:
      if (isSpecificTime && timeLabel !== timeFilter) {
        continue;
      }

      const availableCourts: { court: CourtProp; slot: Slot }[] = [];
      let selectedCourt: { court: CourtProp; slot: Slot } | null = null;

      for (const { court, slots } of courtSlots) {
        if (selectedCourtId !== "all" && String(court.id) !== selectedCourtId) {
          continue;
        }

        const slot = slots.find((s) => s.minutesOfDay === minutes);
        if (!slot) continue;

        if (slot.status === "selected") {
          selectedCourt = { court, slot };
        } else if (slot.status === "available") {
          // Solo turnos disponibles libres; los que ya son partidos abiertos de otros jugadores se tratan como ocupados
          availableCourts.push({ court, slot });
        }
      }

      if (availableCourts.length > 0 || (selectedCourt && selectedCourt.slot.status === "selected")) {
        list.push({
          minutes,
          availableCourts,
          selectedCourt,
        });
      }
    }

    return list;
  }, [allMinutes, courtSlots, timeFilter, selectedCourtId]);

  if (courtSlots.length === 0) {
    return (
      <div className="card p-10 text-center">
        <p className="text-sm font-medium text-foreground/60">No hay canchas configuradas en el club.</p>
      </div>
    );
  }

  if (allMinutes.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-8 text-center sm:p-10">
        <CalendarX2 className="h-10 w-10 text-neutral-400" />
        <h3 className="mt-3 font-display text-base font-bold text-foreground">
          El club se encuentra cerrado en esta fecha
        </h3>
        <p className="mt-1 max-w-sm text-xs text-foreground/60">
          No hay turnos disponibles para este día. Elegí otra fecha en la barra superior.
        </p>
      </div>
    );
  }

  if (timeEntries.length === 0) {
    return (
      <div className="card flex flex-col items-center justify-center p-8 text-center sm:p-10">
        <Clock className="h-9 w-9 text-neutral-400" />
        <h3 className="mt-3 font-display text-base font-bold text-foreground">No hay turnos disponibles</h3>
        <p className="mt-1 max-w-sm text-xs text-foreground/60">
          No encontramos turnos con el horario seleccionado. Probá cambiando el horario o la fecha.
        </p>
        {onResetFilters && (
          <button
            type="button"
            onClick={onResetFilters}
            className="mt-4 cursor-pointer rounded-xl bg-neutral-900 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-black shadow-xs"
          >
            Ver todos los turnos
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {timeEntries.map(({ minutes, availableCourts, selectedCourt }) => {
        const isTimeSelected = Boolean(selectedCourt);
        const targetEntry = selectedCourt ?? availableCourts[0];

        if (!targetEntry) return null;

        const courtNumber = targetEntry.court.number;
        const courtPrice = targetEntry.court.price;
        const availableCount = availableCourts.length + (selectedCourt ? 1 : 0);

        return (
          <div
            key={minutes}
            className={`card relative flex flex-col justify-between rounded-2xl p-4 transition-all ${
              isTimeSelected
                ? "border-2 border-primary bg-card shadow-sm"
                : "border-line bg-card hover:border-foreground/30 hover:shadow-xs"
            }`}
          >
            <div>
              {/* Encabezado: Horario a la izquierda, Cancha a la derecha solo si hay filtro activo de cancha */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  {/* Cuando NO hay cancha seleccionada, lo de canchas libres va arriba a la izquierda */}
                  {selectedCourtId === "all" && (
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" />
                      <span>
                        {availableCount} {availableCount === 1 ? "cancha libre" : "canchas libres"}
                      </span>
                    </p>
                  )}

                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-xl font-bold tracking-tight text-foreground">
                      {minutesToTimeLabel(minutes)}
                    </span>
                    <span className="text-xs text-foreground/45">a</span>
                    <span className="text-xs font-semibold text-foreground/75">
                      {minutesToTimeLabel(minutes + SLOT_DURATION_MINUTES)}
                    </span>
                  </div>
                </div>

                {/* Número de cancha SOLO si se filtró por una cancha específica */}
                {selectedCourtId !== "all" && (
                  <span
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-colors ${
                      isTimeSelected
                        ? "border border-primary bg-primary/10 text-primary"
                        : "bg-neutral-100 text-neutral-800 border border-neutral-200/80"
                    }`}
                  >
                    Cancha {courtNumber}
                  </span>
                )}
              </div>

              {/* Precios limpios */}
              <div className="mt-3.5 flex items-baseline justify-between border-t border-line/60 pt-2.5">
                <div className="flex items-baseline gap-1.5">
                  <span className="font-display text-lg font-bold text-foreground">
                    {formatPrice(courtPrice)}
                  </span>
                  <span className="text-xs text-foreground/45 font-medium">total</span>
                </div>
                <span className="text-xs font-semibold text-foreground/70">
                  {formatPrice(Math.round(courtPrice / OPEN_MATCH_MAX_PLAYERS))} / jug.
                </span>
              </div>
            </div>

            {/* Botón principal */}
            <div className="mt-3.5">
              {isTimeSelected ? (
                <button
                  type="button"
                  aria-label={`Turno ${minutesToTimeLabel(minutes)} seleccionado, hacé click para desmarcar`}
                  onClick={() => onSlotClick(targetEntry.court, targetEntry.slot)}
                  className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-primary bg-neutral-100 py-2.5 px-4 text-xs font-bold text-primary shadow-xs transition-all hover:bg-neutral-200 active:scale-[0.99]"
                >
                  <Check className="h-4 w-4 text-primary stroke-[3]" />
                  <span className="text-primary font-bold">Turno seleccionado</span>
                </button>
              ) : (
                <button
                  type="button"
                  aria-label={`Cancha ${courtNumber}, ${minutesToTimeLabel(minutes)}, disponible`}
                  onClick={() => onSlotClick(targetEntry.court, targetEntry.slot)}
                  className="w-full cursor-pointer rounded-xl bg-neutral-900 py-2.5 px-4 text-xs font-semibold text-white shadow-xs transition-all hover:bg-black active:scale-[0.99]"
                >
                  Reservar turno
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
