import { Banknote, Calendar, Clock, LayoutGrid, Users } from "lucide-react";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import {
  SLOT_DURATION_MINUTES,
  formatLongDate,
  formatPrice,
  minutesToTimeLabel,
} from "@/app/bookings/slot-utils";
import type { SelectedSlot } from "@/app/bookings/types";

export function BookingSummary({
  selectedDate,
  selectedSlot,
  feedback,
  isPending,
  price,
  groupSize,
  onGroupSizeChange,
  onConfirm,
}: {
  selectedDate: Date;
  selectedSlot: SelectedSlot | null;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  price: number;
  groupSize: number;
  onGroupSizeChange: (value: number) => void;
  onConfirm: () => void;
}) {
  const isOpenMatch = groupSize < OPEN_MATCH_MAX_PLAYERS;
  const groupSizeOptions = Array.from({ length: OPEN_MATCH_MAX_PLAYERS }, (_, i) => i + 1);
  return (
    <aside className="h-fit rounded-2xl border border-line bg-card p-6 shadow-sm">
      <h2 className="text-lg font-extrabold text-foreground">Tu reserva</h2>

      {feedback ? (
        <p
          role="alert"
          className={`mt-3 rounded-lg px-3 py-2 text-sm font-medium ${
            feedback.type === "error"
              ? "border border-danger/30 bg-danger-light text-danger"
              : "border border-primary/30 bg-primary-light text-primary"
          }`}
        >
          {feedback.message}
        </p>
      ) : null}

      {selectedSlot ? (
        <div className="mt-4 flex flex-col gap-4">
          <SummaryRow icon={<Calendar className="h-5 w-5" />} label="Fecha" value={formatLongDate(selectedDate)} />
          <SummaryRow
            icon={<LayoutGrid className="h-5 w-5" />}
            label="Cancha"
            value={`Cancha ${selectedSlot.courtNumber}`}
          />
          <SummaryRow
            icon={<Clock className="h-5 w-5" />}
            label="Horario"
            value={`${minutesToTimeLabel(selectedSlot.start.getHours() * 60 + selectedSlot.start.getMinutes())} – ${minutesToTimeLabel(selectedSlot.end.getHours() * 60 + selectedSlot.end.getMinutes())}`}
          />
          <SummaryRow icon={<Clock className="h-5 w-5" />} label="Duración" value={`${SLOT_DURATION_MINUTES} min`} />
          <SummaryRow icon={<Banknote className="h-5 w-5" />} label="Precio" value={formatPrice(price)} />

          <div className="rounded-xl border border-line p-3">
            <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-foreground/50" />
              ¿Con cuántos jugadores vas?
            </span>

            <div className="mt-2.5 grid grid-cols-4 gap-2">
              {groupSizeOptions.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onGroupSizeChange(size)}
                  className={`h-9 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    groupSize === size
                      ? "bg-primary text-white shadow-sm"
                      : "border border-line bg-card text-foreground hover:border-primary hover:text-primary"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>

            <p className="mt-2.5 text-xs text-foreground/60">
              {isOpenMatch
                ? `Partido abierto: te anotás con ${groupSize} de ${OPEN_MATCH_MAX_PLAYERS} y otros jugadores de la comunidad pueden sumarse hasta completar los lugares.`
                : "Reserva completa: ya están definidos los 4 jugadores del partido."}
            </p>
          </div>

          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="mt-2 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
          >
            {isPending
              ? "Confirmando…"
              : isOpenMatch
                ? "Crear partido abierto"
                : "Confirmar reserva"}
          </button>
        </div>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-foreground/60">
          Elegí un turno disponible para ver el resumen de tu reserva.
        </p>
      )}
    </aside>
  );
}

function SummaryRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 text-foreground/40">{icon}</span>
      <div className="flex flex-col">
        <span className="text-xs text-foreground/50">{label}</span>
        <span className="text-sm font-semibold text-foreground">{value}</span>
      </div>
    </div>
  );
}
