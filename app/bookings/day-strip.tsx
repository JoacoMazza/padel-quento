import { CalendarDays } from "lucide-react";

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
  const isOtherDate = !days.some((d) => d.iso === selectedISO);

  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex gap-3 overflow-x-auto pb-1">
        {days.map((day) => {
          const isSelected = day.iso === selectedISO;
          return (
            <button
              key={day.iso}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(day.iso)}
              className={`flex w-32 shrink-0 cursor-pointer flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors ${
                isSelected ? "border-ink bg-ink text-white" : "border-line bg-card hover:border-foreground/30"
              }`}
            >
              <span className={`text-[10px] font-semibold tracking-wider uppercase ${isSelected ? "text-white/60" : "text-foreground/45"}`}>
                {day.caption}
              </span>
              <span className="text-sm font-bold">{day.label}</span>
              <span
                className={`text-xs ${
                  !day.hasSchedule || day.free === 0
                    ? isSelected
                      ? "text-red-300"
                      : "text-primary"
                    : isSelected
                      ? "text-white/60"
                      : "text-foreground/50"
                }`}
              >
                {!day.hasSchedule ? "Cerrado" : day.free === 0 ? "Agotado" : `${day.free} libre${day.free === 1 ? "" : "s"}`}
              </span>
            </button>
          );
        })}
      </div>

      <label
        className={`btn btn-outline relative shrink-0 ${isOtherDate ? "border-ink" : ""}`}
        title="Elegir otra fecha"
      >
        <CalendarDays className="h-4 w-4 text-primary" />
        Elegir otra fecha
        <input
          type="date"
          aria-label="Elegir otra fecha"
          value={selectedISO}
          min={todayISO}
          onClick={(event) => {
            event.currentTarget.showPicker?.();
          }}
          onChange={(event) => {
            const value = event.target.value;
            if (!value || value < todayISO) return;
            onSelect(value);
          }}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
      </label>
    </div>
  );
}
