import { Check, CirclePlus, Lock, Users } from "lucide-react";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { SLOT_DURATION_MINUTES, formatPrice, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import { CourtTag } from "@/app/components/ui/court-tag";
import { PlayerDots, missingPlayersLabel } from "@/app/components/ui/player-dots";
import type { CourtProp, Slot } from "@/app/bookings/types";

const STATUS_LABELS: Record<Slot["status"], string> = {
  available: "disponible",
  open: "partido abierto",
  occupied: "ocupado",
  selected: "seleccionado",
};

/**
 * Grilla de disponibilidad: una fila por horario y una columna por cancha.
 * Cada cancha puede tener su propio horario, así que las filas son la unión de
 * todos los turnos y una cancha sin turno en esa franja muestra la celda vacía.
 */
export function AvailabilityGrid({
  courtSlots,
  onSlotClick,
}: {
  courtSlots: { court: CourtProp; slots: Slot[] }[];
  onSlotClick: (court: CourtProp, slot: Slot) => void;
}) {
  const rows = [...new Set(courtSlots.flatMap(({ slots }) => slots.map((s) => s.minutesOfDay)))].sort((a, b) => a - b);

  if (courtSlots.length === 0) {
    return <p className="card p-8 text-center text-sm text-foreground/60">No hay canchas para mostrar.</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="card p-8 text-center text-sm text-foreground/60">
        No hay turnos para este día. Probá con otra fecha.
      </p>
    );
  }

  const gridTemplateColumns = `5.5rem repeat(${courtSlots.length}, minmax(10rem, 1fr))`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid gap-3" style={{ gridTemplateColumns }}>
        <span className="label-caps sticky left-0 z-10 self-stretch bg-background pt-4 pl-1">Horario</span>
        {courtSlots.map(({ court }) => (
          <div key={court.id} className="card flex items-center justify-between gap-2 px-3 py-2.5 whitespace-nowrap">
            <span className="flex items-center gap-2 text-sm font-bold text-foreground">
              <CourtTag number={court.number} size="xs" />
              Cancha {court.number}
            </span>
            <span className="text-xs font-semibold text-foreground/60">{formatPrice(court.price)}</span>
          </div>
        ))}

        {rows.map((minutesOfDay) => (
          <Row key={minutesOfDay} minutesOfDay={minutesOfDay} courtSlots={courtSlots} onSlotClick={onSlotClick} />
        ))}
      </div>
    </div>
  );
}

function Row({
  minutesOfDay,
  courtSlots,
  onSlotClick,
}: {
  minutesOfDay: number;
  courtSlots: { court: CourtProp; slots: Slot[] }[];
  onSlotClick: (court: CourtProp, slot: Slot) => void;
}) {
  return (
    <>
      {/* Fija a la izquierda: con muchas canchas la grilla scrollea en horizontal. */}
      <div className="sticky left-0 z-10 flex flex-col justify-center bg-background pl-1">
        <span className="text-lg font-extrabold text-foreground tabular-nums">{minutesToTimeLabel(minutesOfDay)}</span>
        <span className="text-xs text-foreground/50">a {minutesToTimeLabel(minutesOfDay + SLOT_DURATION_MINUTES)}</span>
      </div>
      {courtSlots.map(({ court, slots }) => {
        const slot = slots.find((s) => s.minutesOfDay === minutesOfDay);
        return slot ? (
          <SlotCell key={court.id} court={court} slot={slot} onClick={() => onSlotClick(court, slot)} />
        ) : (
          <div key={court.id} className="rounded-xl border border-dashed border-line" />
        );
      })}
    </>
  );
}

function SlotCell({ court, slot, onClick }: { court: CourtProp; slot: Slot; onClick: () => void }) {
  const label = `Cancha ${court.number}, ${minutesToTimeLabel(slot.minutesOfDay)}, ${STATUS_LABELS[slot.status]}`;
  const base = "flex h-[5.5rem] w-full flex-col justify-between rounded-xl p-3 text-left transition-all";

  if (slot.status === "occupied") {
    return (
      <button
        type="button"
        disabled
        aria-label={label}
        className={`${base} cursor-not-allowed items-center justify-center gap-1 bg-line/50 text-foreground/40`}
      >
        <Lock className="h-4 w-4" />
        <span className="text-sm font-medium">Ocupado</span>
      </button>
    );
  }

  if (slot.status === "open") {
    const remaining = OPEN_MATCH_MAX_PLAYERS - (slot.confirmedPlayers ?? 0);
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={`${base} cursor-pointer border border-primary/25 bg-primary-light hover:border-primary/60`}
      >
        <span className="flex w-full items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
            <Users className="h-3.5 w-3.5" />
            Abierto
          </span>
          <PlayerDots confirmed={slot.confirmedPlayers ?? 0} tone="primary" size="sm" />
        </span>
        <span className="flex w-full items-end justify-between gap-2">
          <span className="text-xs text-foreground/70">
            {slot.alreadyJoined ? "Ya estás anotado" : missingPlayersLabel(remaining)}
          </span>
          <span className="text-sm font-bold text-primary">{formatPrice(court.price)}</span>
        </span>
      </button>
    );
  }

  const isSelected = slot.status === "selected";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={isSelected}
      className={`${base} cursor-pointer ${
        isSelected
          ? "border-2 border-primary bg-primary-light/60 shadow-md shadow-primary/10"
          : "border border-line bg-card hover:border-foreground/30 hover:shadow-sm"
      }`}
    >
      <span className="flex w-full items-center justify-between">
        {isSelected ? (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-primary">
              <Check className="h-4 w-4" />
              Seleccionado
            </span>
            <span className="h-2 w-2 rounded-full bg-primary" />
          </>
        ) : (
          <>
            <span className="flex items-center gap-1.5 text-sm font-semibold text-success">
              <span className="h-1.5 w-1.5 rounded-full bg-success" />
              Disponible
            </span>
            <CirclePlus className="h-4 w-4 text-foreground/30" />
          </>
        )}
      </span>
      <span className="flex w-full items-end justify-between gap-2">
        <span className="text-[11px] font-medium tracking-wide text-foreground/50 uppercase">
          Turno {SLOT_DURATION_MINUTES}&apos;
        </span>
        <span className={`text-sm font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
          {formatPrice(court.price)}
        </span>
      </span>
    </button>
  );
}
