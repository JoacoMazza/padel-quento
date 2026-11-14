"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Clock,
  Search,
  Trophy,
} from "lucide-react";
import { CalendarModal } from "@/app/bookings/calendar-modal";
import { formatLongDate, parseISODate, toISODate } from "@/app/bookings/slot-utils";
import type { CourtProp } from "@/app/bookings/types";

export type TimeFilterValue = "all" | string;
export type TimeOptionItem = { time: string; availableCount?: number };

export function BookingSearchBar({
  selectedDateISO,
  onDateChange,
  timeFilter,
  onTimeChange,
  availableTimes,
  allClubTimes,
  selectedCourtId,
  onCourtChange,
  courts,
  onSearchClick,
}: {
  selectedDateISO: string;
  onDateChange: (iso: string) => void;
  timeFilter: TimeFilterValue;
  onTimeChange: (time: TimeFilterValue) => void;
  availableTimes?: TimeOptionItem[];
  allClubTimes?: string[];
  selectedCourtId: string;
  onCourtChange: (courtId: string) => void;
  courts: CourtProp[];
  onSearchClick?: () => void;
}) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isTimeDropdownOpen, setIsTimeDropdownOpen] = useState(false);
  const [isCourtDropdownOpen, setIsCourtDropdownOpen] = useState(false);

  const timeDropdownRef = useRef<HTMLDivElement>(null);
  const courtDropdownRef = useRef<HTMLDivElement>(null);

  // Fecha de hoy real (para que el calendario nunca bloquee días válidos hacia atrás si se eligió una fecha futura)
  const todayISO = toISODate(new Date());

  // Cerrar desplegables al hacer click fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (timeDropdownRef.current && !timeDropdownRef.current.contains(target)) {
        setIsTimeDropdownOpen(false);
      }
      if (courtDropdownRef.current && !courtDropdownRef.current.contains(target)) {
        setIsCourtDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formattedDate = (() => {
    try {
      const parsed = parseISODate(selectedDateISO);
      return formatLongDate(parsed);
    } catch {
      return selectedDateISO;
    }
  })();

  const timeOptions: TimeOptionItem[] = useMemo(() => {
    if (availableTimes) {
      return availableTimes;
    }
    return (allClubTimes ?? []).map((t) => ({ time: t, availableCount: undefined }));
  }, [availableTimes, allClubTimes]);

  const selectedCourtName = (() => {
    if (selectedCourtId === "all") {
      return timeFilter === "all"
        ? `Todas las canchas (${courts.length})`
        : `Todas las disponibles (${courts.length})`;
    }
    const court = courts.find((c) => String(c.id) === selectedCourtId);
    return court ? `Cancha ${court.number}` : "Todas las canchas";
  })();

  const selectedTimeName = (() => {
    if (timeFilter === "all") return "Turnos disponibles";
    return `${timeFilter} hs`;
  })();

  return (
    <div className="mb-6">
      {/* Barra de filtros principal personalizada */}
      <div className="rounded-2xl border border-line bg-card p-2 shadow-xs transition-colors hover:border-primary/30 sm:rounded-full sm:p-2 sm:pl-5">
        <div className="grid grid-cols-1 divide-y divide-line/70 sm:grid-cols-[1.3fr_1.1fr_1.1fr_auto] sm:divide-y-0 sm:divide-x sm:divide-line/70 sm:items-center">
          {/* 1. Selector de Fecha */}
          <button
            type="button"
            onClick={() => {
              setIsTimeDropdownOpen(false);
              setIsCourtDropdownOpen(false);
              setIsCalendarOpen(true);
            }}
            className="group flex cursor-pointer items-center justify-between py-2.5 px-3 text-left transition-colors hover:bg-primary-light/15 sm:px-4 sm:py-2"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                <CalendarIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                  Fecha
                </span>
                <span className="block truncate text-sm font-semibold text-foreground capitalize">
                  {formattedDate}
                </span>
              </div>
            </div>
            <span className="text-xs font-semibold text-primary sm:hidden">
              Cambiar
            </span>
          </button>

          {/* 2. Selector de Horario (Desplegable personalizado) */}
          <div ref={timeDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsCourtDropdownOpen(false);
                setIsTimeDropdownOpen((prev) => !prev);
              }}
              className="group flex w-full cursor-pointer items-center justify-between py-2.5 px-3 text-left transition-colors hover:bg-primary-light/15 sm:px-4 sm:py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                    Horario
                  </span>
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {selectedTimeName}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${
                  isTimeDropdownOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>

            {/* Menú flotante de Horarios */}
            {isTimeDropdownOpen && (
              <div className="absolute top-full left-0 z-30 mt-2 w-full min-w-[220px] max-h-64 overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-lg scrollbar-thin animate-slide-down">
                <button
                  type="button"
                  onClick={() => {
                    onTimeChange("all");
                    setIsTimeDropdownOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    timeFilter === "all"
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-foreground hover:bg-line/50"
                  }`}
                >
                  <span>Todos los turnos disponibles</span>
                  {timeFilter === "all" && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="my-1 border-t border-line/60" />
                {timeOptions.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-foreground/50">
                    No hay turnos disponibles para este día
                  </div>
                ) : (
                  timeOptions.map(({ time, availableCount }) => {
                    const isSelected = timeFilter === time;
                    return (
                      <button
                        key={time}
                        type="button"
                        onClick={() => {
                          onTimeChange(time);
                          setIsTimeDropdownOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                          isSelected
                            ? "bg-primary/10 font-bold text-primary"
                            : "text-foreground hover:bg-line/50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{time} hs</span>
                          {availableCount !== undefined && availableCount > 0 && selectedCourtId === "all" && (
                            <span className="text-[10px] font-semibold text-success">
                              ({availableCount} {availableCount === 1 ? "libre" : "libres"})
                            </span>
                          )}
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 3. Selector de Cancha (Desplegable personalizado) */}
          <div ref={courtDropdownRef} className="relative">
            <button
              type="button"
              onClick={() => {
                setIsTimeDropdownOpen(false);
                setIsCourtDropdownOpen((prev) => !prev);
              }}
              className="group flex w-full cursor-pointer items-center justify-between py-2.5 px-3 text-left transition-colors hover:bg-primary-light/15 sm:px-4 sm:py-2"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-foreground/50">
                    Cancha
                  </span>
                  <span className="block truncate text-sm font-semibold text-foreground">
                    {selectedCourtName}
                  </span>
                </div>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-foreground/40 transition-transform ${
                  isCourtDropdownOpen ? "rotate-180 text-primary" : ""
                }`}
              />
            </button>

            {/* Menú flotante de Canchas */}
            {isCourtDropdownOpen && (
              <div className="absolute top-full left-0 z-30 mt-2 w-full min-w-[200px] max-h-64 overflow-y-auto rounded-2xl border border-line bg-card p-1.5 shadow-lg scrollbar-thin animate-slide-down">
                <button
                  type="button"
                  onClick={() => {
                    onCourtChange("all");
                    setIsCourtDropdownOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                    selectedCourtId === "all"
                      ? "bg-primary/10 font-bold text-primary"
                      : "text-foreground hover:bg-line/50"
                  }`}
                >
                  <span>
                    {timeFilter === "all"
                      ? `Todas las canchas (${courts.length})`
                      : `Todas las disponibles (${courts.length})`}
                  </span>
                  {selectedCourtId === "all" && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="my-1 border-t border-line/60" />
                {courts.length === 0 ? (
                  <div className="px-3 py-3 text-center text-xs text-foreground/50">
                    No hay canchas disponibles para este horario
                  </div>
                ) : (
                  courts.map((court) => {
                    const isSelected = selectedCourtId === String(court.id);
                    return (
                      <button
                        key={court.id}
                        type="button"
                        onClick={() => {
                          onCourtChange(String(court.id));
                          setIsCourtDropdownOpen(false);
                        }}
                        className={`flex w-full cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                          isSelected
                            ? "bg-primary/10 font-bold text-primary"
                            : "text-foreground hover:bg-line/50"
                        }`}
                      >
                        <span>Cancha {court.number}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* 4. Botón de búsqueda en rojo sutil y agradable */}
          <div className="p-1 sm:pl-2">
            <button
              type="button"
              onClick={onSearchClick}
              className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-primary py-3 px-5 text-xs sm:text-sm font-bold text-white shadow-xs transition-all hover:brightness-105 active:scale-[0.98] sm:w-auto sm:rounded-full"
            >
              <Search className="h-4 w-4 text-white stroke-[2.5]" />
              <span className="text-white">Buscar turnos</span>
            </button>
          </div>
        </div>
      </div>

      {/* Modal de calendario: todayISO siempre usa la fecha real de hoy */}
      {isCalendarOpen && (
        <CalendarModal
          isOpen={isCalendarOpen}
          onClose={() => setIsCalendarOpen(false)}
          selectedISO={selectedDateISO}
          todayISO={todayISO}
          onSelect={(newDate) => {
            onDateChange(newDate);
            setIsCalendarOpen(false);
          }}
        />
      )}
    </div>
  );
}
