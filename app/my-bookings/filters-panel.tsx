import { Calendar, Filter, RefreshCw, User } from "lucide-react";
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

function getInitials(name?: string | null, email?: string | null) {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    const first = parts[0]?.[0] ?? "";
    const second = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
    return `${first}${second}`.toUpperCase();
  }
  if (email) return email[0]?.toUpperCase() ?? "?";
  return "?";
}

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
    <aside className="h-fit rounded-2xl border border-line bg-card p-6 shadow-sm">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
          {getInitials(userName, userEmail)}
        </span>
        <div className="flex flex-col overflow-hidden">
          <p className="truncate text-sm font-bold text-foreground">{userName ?? "Mi cuenta"}</p>
          <p className="truncate text-xs text-foreground/60">{userEmail}</p>
        </div>
      </div>

      <div className="mt-4 flex items-start gap-2.5 rounded-xl bg-background px-3.5 py-3">
        <User className="mt-0.5 h-4 w-4 text-foreground/50" />
        <p className="text-sm text-foreground/70">
          Tenés {upcomingCount} turno{upcomingCount === 1 ? "" : "s"} próximo{upcomingCount === 1 ? "" : "s"}
          <br />y {pastCount} turno{pastCount === 1 ? "" : "s"} anterior{pastCount === 1 ? "" : "es"}
        </p>
      </div>

      <div className="mt-6 flex items-center gap-2 text-sm font-bold text-foreground">
        <Filter className="h-4 w-4" />
        Filtros
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <label className="flex items-center gap-1.5 text-xs font-medium text-foreground/60">
          <Calendar className="h-3.5 w-3.5" />
          Fecha
        </label>
        <select
          value={dateFilter}
          onChange={(event) => onDateFilterChange(event.target.value as DateFilter)}
          className="h-10 cursor-pointer rounded-lg border border-line bg-background px-3 text-sm font-medium text-foreground outline-none focus:border-primary"
        >
          {DATE_FILTER_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-xs font-medium text-foreground/60">Estado</span>
        <div className="flex gap-2">
          {STATUS_FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => onStatusFilterChange(option.value)}
              className={`h-9 flex-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                statusFilter === option.value
                  ? "bg-primary text-white"
                  : "border border-line text-foreground hover:border-primary"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={onClear}
        className="mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-full border border-primary text-sm font-semibold text-primary transition-colors hover:bg-primary-light cursor-pointer"
      >
        <RefreshCw className="h-4 w-4" />
        Limpiar filtros
      </button>
    </aside>
  );
}
