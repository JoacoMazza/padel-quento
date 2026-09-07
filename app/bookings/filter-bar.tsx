import { Calendar, Clock, LayoutGrid } from "lucide-react";
import { SLOT_DURATION_MINUTES, formatLongDate } from "@/app/bookings/slot-utils";
import type { CourtProp } from "@/app/bookings/types";

export function FilterBar({
  selectedDate,
  dateInput,
  todayISODate,
  courts,
  courtFilter,
  onDateChange,
  onCourtFilterChange,
}: {
  selectedDate: Date;
  dateInput: string;
  todayISODate: string;
  courts: CourtProp[];
  courtFilter: string;
  onDateChange: (value: string) => void;
  onCourtFilterChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-line bg-card p-5 shadow-sm md:flex-row md:items-stretch">
      <FilterBox label="Fecha" icon={<Calendar className="h-5 w-5" />}>
        <span className="text-sm font-semibold text-foreground">{formatLongDate(selectedDate)}</span>
        <input
          type="date"
          value={dateInput}
          min={todayISODate}
          onClick={(event) => {
            event.currentTarget.showPicker?.();
          }}
          onChange={(event) => {
            const value = event.target.value;
            if (!value || value < todayISODate) return;
            onDateChange(value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </FilterBox>

      <FilterBox label="Cancha" icon={<LayoutGrid className="h-5 w-5" />}>
        <span className="text-sm font-semibold text-foreground">
          {courtFilter === "all"
            ? "Todas"
            : `Cancha ${courts.find((c) => String(c.id) === courtFilter)?.number ?? ""}`}
        </span>
        <select
          value={courtFilter}
          onChange={(event) => onCourtFilterChange(event.target.value)}
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

      <FilterBox label="Duración" icon={<Clock className="h-5 w-5" />}>
        <span className="text-sm font-semibold text-foreground">{SLOT_DURATION_MINUTES} min</span>
      </FilterBox>
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
