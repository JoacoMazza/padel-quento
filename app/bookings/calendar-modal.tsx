"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { parseISODate, toISODate } from "@/app/bookings/slot-utils";

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const WEEKDAY_NAMES = ["Lu", "Ma", "Mi", "Ju", "Vi", "Sá", "Do"];

export function CalendarModal({
  isOpen,
  onClose,
  selectedISO,
  todayISO,
  onSelect,
}: {
  isOpen: boolean;
  onClose: () => void;
  selectedISO: string;
  todayISO: string;
  onSelect: (iso: string) => void;
}) {
  const initialDate = useMemo(() => parseISODate(selectedISO || todayISO), [selectedISO, todayISO]);
  const [currentYear, setCurrentYear] = useState(() => initialDate.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => initialDate.getMonth());

  if (!isOpen) return null;

  function prevMonth() {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  }

  // Primer día del mes (0 = domingo, 1 = lunes, ..., 6 = sábado).
  // Ajustamos para que la semana empiece en Lunes (0 = lunes, 6 = domingo).
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
  const leadingBlanks = (firstDayOfMonth + 6) % 7;
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const days: { date: Date; iso: string; dayNumber: number }[] = [];
  for (let i = 1; i <= daysInMonth; i++) {
    const d = new Date(currentYear, currentMonth, i);
    days.push({
      date: d,
      iso: toISODate(d),
      dayNumber: i,
    });
  }

  const today = parseISODate(todayISO);
  const isCurrentMonthPast =
    currentYear < today.getFullYear() ||
    (currentYear === today.getFullYear() && currentMonth < today.getMonth());

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Elegir fecha">
      <div className="modal-panel max-w-sm p-5 sm:p-6 animate-slide-down">
        {/* Cabecera del modal */}
        <div className="flex items-center justify-between border-b border-line pb-4">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-bold text-foreground">
              {MONTH_NAMES[currentMonth]} {currentYear}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar calendario"
            className="icon-btn"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navegación de mes */}
        <div className="flex items-center justify-between py-3">
          <button
            type="button"
            onClick={prevMonth}
            disabled={isCurrentMonthPast}
            aria-label="Mes anterior"
            className="icon-btn disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs font-semibold uppercase tracking-wider text-foreground/50">
            Navegar fechas
          </span>
          <button
            type="button"
            onClick={nextMonth}
            aria-label="Mes siguiente"
            className="icon-btn"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-foreground/45">
          {WEEKDAY_NAMES.map((name) => (
            <span key={name} className="py-1">
              {name}
            </span>
          ))}
        </div>

        {/* Grilla del mes */}
        <div className="mt-1 grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, idx) => (
            <div key={`blank-${idx}`} className="h-10" />
          ))}

          {days.map(({ iso, dayNumber }) => {
            const isSelected = iso === selectedISO;
            const isToday = iso === todayISO;
            const isPast = iso < todayISO;

            return (
              <button
                key={iso}
                type="button"
                disabled={isPast}
                onClick={() => {
                  onSelect(iso);
                  onClose();
                }}
                className={`relative flex h-10 w-full cursor-pointer items-center justify-center rounded-xl text-sm font-semibold transition-all ${
                  isSelected
                    ? "bg-primary font-bold text-white shadow-xs ring-2 ring-primary/20"
                    : isPast
                      ? "cursor-not-allowed text-foreground/25 opacity-40"
                      : "text-foreground hover:bg-line/60"
                } ${isToday && !isSelected ? "ring-2 ring-primary/30 font-bold text-primary" : ""}`}
              >
                {dayNumber}
                {isToday && (
                  <span
                    className={`absolute bottom-1 h-1 w-1 rounded-full ${
                      isSelected ? "bg-white" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Acciones inferiores */}
        <div className="mt-5 flex items-center justify-between border-t border-line pt-4">
          <button
            type="button"
            onClick={() => {
              onSelect(todayISO);
              onClose();
            }}
            className="btn btn-sm btn-outline"
          >
            Ir a Hoy
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-sm btn-primary"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

