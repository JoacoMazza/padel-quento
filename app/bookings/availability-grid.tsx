import { CircleCheck, CirclePlus, Lock, Users, Wrench } from "lucide-react";
import { SLOT_DURATION_MINUTES, minutesToTimeLabel } from "@/app/bookings/slot-utils";
import { CourtTag } from "@/app/components/ui/court-tag";
import type { CourtProp, Slot } from "@/app/bookings/types";

const STATUS_LABELS: Record<Slot["status"], string> = {
  available: "disponible",
  open: "partido abierto",
  occupied: "ocupado",
  outOfService: "fuera de servicio",
  selected: "seleccionado",
};

const CELL_TEXTS: Record<Slot["status"], string> = {
  available: "Disponible",
  open: "Partido abierto",
  occupied: "Ocupado",
  outOfService: "Fuera de servicio",
  selected: "Seleccionado",
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

  const gridTemplateColumns = `5.5rem repeat(${courtSlots.length}, minmax(7.5rem, 1fr))`;

  return (
    <div className="overflow-x-auto pb-2">
      <div className="grid gap-3" style={{ gridTemplateColumns }}>
        <span className="label-caps sticky left-0 z-10 self-stretch bg-background pt-4 pl-1">Horario</span>
        {courtSlots.map(({ court }) => (
          <div key={court.id} className="card flex justify-center items-center gap-2 px-3 py-2.5 text-sm font-bold whitespace-nowrap text-foreground">
            <CourtTag number={court.number} size="xs" />
            Cancha {court.number}
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

const CELL_STYLES: Record<Slot["status"], string> = {
  available: "cursor-pointer border border-line bg-card text-success hover:border-foreground/30 hover:shadow-sm",
  open: "cursor-pointer border border-primary/25 bg-primary-light text-primary hover:border-primary/60",
  selected: "cursor-pointer bg-panel text-white shadow-md shadow-black/20",
  occupied: "cursor-not-allowed bg-line/50 text-foreground/40",
  outOfService: "cursor-not-allowed border border-dashed border-danger/30 bg-danger-light text-danger/70",
};

const CELL_ICONS: Record<Slot["status"], React.ReactNode> = {
  available: <CirclePlus className="h-4 w-4" />,
  open: <Users className="h-4 w-4" />,
  selected: <CircleCheck className="h-4 w-4" />,
  occupied: <Lock className="h-4 w-4" />,
  outOfService: <Wrench className="h-4 w-4" />,
};

/** Celda de un turno: solo muestra su estado; el detalle aparece en el resumen al elegirlo. */
function SlotCell({ court, slot, onClick }: { court: CourtProp; slot: Slot; onClick: () => void }) {
  const isDisabled = slot.status === "occupied" || slot.status === "outOfService";

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={onClick}
      aria-label={`Cancha ${court.number}, ${minutesToTimeLabel(slot.minutesOfDay)}, ${STATUS_LABELS[slot.status]}`}
      aria-pressed={slot.status === "available" || slot.status === "selected" ? slot.status === "selected" : undefined}
      className={`flex h-16 w-full flex-col items-center justify-center gap-1 rounded-xl px-2 text-center text-sm leading-tight font-semibold transition-all ${CELL_STYLES[slot.status]}`}
    >
      <span aria-hidden="true">{CELL_ICONS[slot.status]}</span>
      {CELL_TEXTS[slot.status]}
    </button>
  );
}