import Link from "next/link";
import { CalendarPlus, RefreshCw } from "lucide-react";
import { Avatar, getInitials } from "@/app/components/ui/avatar";
import type { DateFilter, StatusFilter } from "@/app/my-bookings/types";

const DATE_FILTER_OPTIONS: { value: DateFilter; label: string }[] = [
  { value: "all", label: "Todos los días" },
  { value: "today", label: "Hoy" },
  { value: "week", label: "Próximos 7 días" },
  { value: "month", label: "Próximos 30 días" },
];

const STATUS_FILTER_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "confirmed", label: "Confirmados" },
  { value: "pending", label: "Pendientes" },
];

export function FiltersPanel({
  userName,
  userEmail,
  upcomingCount,
  pastCount,
  dateFilter,
  statusFilter,
  onDateFilterChange,
  onStatusFilterChange,
  onClear,
}: {
  userName?: string | null;
  userEmail?: string | null;
  upcomingCount: number;
  pastCount: number;
  dateFilter: DateFilter;
  statusFilter: StatusFilter;
  onDateFilterChange: (value: DateFilter) => void;
  onStatusFilterChange: (value: StatusFilter) => void;
  onClear: () => void;
}) {
  return (
    // En pantallas chicas va antes de la lista: al final quedaría debajo de todos los turnos.
    <aside className="order-first flex h-fit flex-col gap-4 lg:sticky lg:top-24 lg:order-none">
      <div className="card p-6">
        <div className="flex items-center gap-3">
          <Avatar initials={getInitials(userName, userEmail)} tone="dark" />
          <div className="flex flex-col overflow-hidden">
            <p className="truncate text-sm font-bold text-foreground">{userName ?? "Mi cuenta"}</p>
            <p className="truncate text-xs text-foreground/60">{userEmail}</p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-background p-3">
            <p className="label-caps">Próximos</p>
            <p className="text-2xl font-extrabold text-foreground">{upcomingCount}</p>
          </div>
          <div className="rounded-xl bg-background p-3">
            <p className="label-caps">Anteriores</p>
            <p className="text-2xl font-extrabold text-foreground">{pastCount}</p>
          </div>
        </div>

        <Link href="/bookings" className="btn btn-primary mt-5 w-full">
          <CalendarPlus className="h-4 w-4" />
          Nuevo turno
        </Link>
      </div>

      <div className="card p-6">
        <p className="label-caps">Filtros</p>

        <label htmlFor="date-filter" className="field-label mt-4">
          Fecha
        </label>
        <select
          id="date-filter"
          value={dateFilter}
          onChange={(event) => onDateFilterChange(event.target.value as DateFilter)}
          className="field cursor-pointer"
        >
          {DATE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <p className="field-label mt-4">Estado</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={statusFilter === option.value}
              onClick={() => onStatusFilterChange(option.value)}
              className={`chip h-9 pointer-coarse:h-11 ${statusFilter === option.value ? "chip-active" : ""}`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <button type="button" onClick={onClear} className="btn btn-outline mt-5 w-full">
          <RefreshCw className="h-4 w-4" />
          Limpiar filtros
        </button>
      </div>
    </aside>
  );
}
