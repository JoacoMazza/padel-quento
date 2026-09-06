import { CourtState } from "@/src/domain/enums";
import { minutesToTimeLabel } from "@/app/bookings/slot-utils";
import type { CourtProp, Slot } from "@/app/bookings/types";

export function CourtCard({
  court,
  slots,
  onSlotClick,
}: {
  court: CourtProp;
  slots: Slot[];
  onSlotClick: (slot: Slot) => void;
}) {
  const isAvailable = court.state === CourtState.AVAILABLE;

  return (
    <div className="rounded-2xl border border-line bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-extrabold text-foreground">Cancha {court.number}</h3>
        <span
          className={`flex items-center gap-1.5 text-xs font-semibold ${
            isAvailable ? "text-green-600" : "text-danger"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${isAvailable ? "bg-green-600" : "bg-danger"}`} />
          {isAvailable ? "Disponible" : "Fuera de servicio"}
        </span>
      </div>
      <p className="mt-0.5 text-sm text-foreground/60">Pista de pádel · Nivel estándar</p>

      <div className="mt-4 border-t border-line pt-4">
        {slots.length === 0 ? (
          <p className="text-sm text-foreground/50">Sin turnos para este día.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2.5">
            {slots.map((slot) => (
              <button
                key={slot.minutesOfDay}
                type="button"
                disabled={slot.status === "occupied"}
                onClick={() => onSlotClick(slot)}
                className={`h-11 rounded-lg text-sm font-semibold transition-all ${
                  slot.status === "selected"
                    ? "bg-primary text-white shadow-sm"
                    : slot.status === "occupied"
                      ? "cursor-not-allowed bg-line/70 text-foreground/40"
                      : "border border-line bg-card text-foreground hover:border-primary hover:text-primary cursor-pointer"
                }`}
              >
                {minutesToTimeLabel(slot.minutesOfDay)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
