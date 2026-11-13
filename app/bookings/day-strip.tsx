"use client";

import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { CalendarModal } from "@/app/bookings/calendar-modal";

export type DayOption = {
  iso: string;
  /** "Hoy", "Mañana" o el día de la semana. */
  caption: string;
  /** "Mié 14 Oct". */
  label: string;
  free: number;
  /** false si ninguna cancha abre ese día. */
  hasSchedule: boolean;
};

const DAY_CAPTION_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "long" });
const DAY_LABEL_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("es-AR", { weekday: "short" });
const DAY_LABEL_MONTH_FORMATTER = new Intl.DateTimeFormat("es-AR", { month: "short" });

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(".", "");
}

/** "Hoy", "Mañana" o el día de la semana, según cuántos días faltan. */
export function dayCaption(date: Date, offset: number): string {
  return offset === 0 ? "Hoy" : offset === 1 ? "Mañana" : DAY_CAPTION_FORMATTER.format(date);
}

/** "Mié 14 Oct". */
export function dayLabel(date: Date): string {
  return `${capitalize(DAY_LABEL_WEEKDAY_FORMATTER.format(date))} ${date.getDate()} ${capitalize(DAY_LABEL_MONTH_FORMATTER.format(date))}`;
}

/** Tira de próximos días con la cantidad de turnos libres, más un selector para cualquier otra fecha. */
export function DayStrip({
  days,
  selectedISO,
  todayISO,
  onSelect,
}: {
  days: DayOption[];
  selectedISO: string;
  todayISO: string;
  onSelect: (iso: string) => void;
}) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const isOtherDate = !days.some((d) => d.iso === selectedISO);

  return (
    <>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-2.5 overflow-x-auto pb-1 scrollbar-none">
          {days.map((day) => {
            const isSelected = day.iso === selectedISO;
            return (
              <button
                key={day.iso}
                type="button"
                aria-pressed={isSelected}
                onClick={() => onSelect(day.iso)}
                className={`group flex w-28 sm:w-32 shrink-0 cursor-pointer flex-col items-start rounded-2xl border px-3 py-2.5 sm:p-3 text-left transition-all ${
                  isSelected
                    ? "border-2 border-primary bg-background shadow-xs ring-2 ring-primary/10"
                    : "border-line bg-card hover:border-foreground/30 hover:bg-background/40"
                }`}
              >
                <span
                  className={`text-[10px] font-bold tracking-wider uppercase ${
                    isSelected ? "text-primary font-extrabold" : "text-foreground/45"
                  }`}
                >
                  {day.caption}
                </span>
                <span className="text-sm font-bold tracking-tight text-foreground">{day.label}</span>
                <span
                  className={`mt-0.5 text-xs font-semibold ${
                    !day.hasSchedule || day.free === 0
                      ? "text-primary"
                      : isSelected
                        ? "text-primary"
                        : "text-foreground/50"
                  }`}
                >
                  {!day.hasSchedule
                    ? "Cerrado"
                    : day.free === 0
                      ? "Agotado"
                      : `${day.free} libre${day.free === 1 ? "" : "s"}`}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setIsCalendarOpen(true)}
          className={`btn btn-outline shrink-0 gap-2 border-line text-xs font-semibold ${
            isOtherDate ? "border-2 border-primary bg-background text-foreground font-bold" : ""
          }`}
          title="Abrir calendario completo"
        >
          <CalendarDays className={`h-4 w-4 ${isOtherDate ? "text-white" : "text-primary"}`} />
          <span>{isOtherDate ? "Fecha elegida" : "Elegir otra fecha"}</span>
        </button>
      </div>

      <CalendarModal
        isOpen={isCalendarOpen}
        onClose={() => setIsCalendarOpen(false)}
        selectedISO={selectedISO}
        todayISO={todayISO}
        onSelect={onSelect}
      />
    </>
  );
}
