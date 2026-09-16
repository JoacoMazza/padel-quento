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
  isOpenMatch,
  onIsOpenMatchChange,
  onConfirm,
}: {
  selectedDate: Date;
  selectedSlot: SelectedSlot | null;
  feedback: { type: "error" | "success"; message: string } | null;
  isPending: boolean;
  price: number;
  isOpenMatch: boolean;
  onIsOpenMatchChange: (value: boolean) => void;
  onConfirm: () => void;
}) {
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

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
              isOpenMatch ? "border-amber-300 bg-amber-50" : "border-line hover:border-amber-300"
            }`}
          >
            <input
              type="checkbox"
              checked={isOpenMatch}
              onChange={(event) => onIsOpenMatchChange(event.target.checked)}
              className="mt-0.5 h-4 w-4 cursor-pointer accent-amber-500"
            />
            <span className="flex flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                <Users className="h-4 w-4 text-amber-600" />
                ¿Es un partido abierto?
              </span>
              <span className="text-xs text-foreground/60">
                Reservás el horario como único jugador confirmado y dejás lugares libres para que
                otros jugadores de la comunidad se sumen hasta completar los {OPEN_MATCH_MAX_PLAYERS}.
              </span>
            </span>
          </label>

          <button
            type="button"
            disabled={isPending}
            onClick={onConfirm}
            className="mt-2 h-11 rounded-full bg-primary text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.99] disabled:opacity-60 shadow-sm cursor-pointer"
          >
            {isPending ? "Confirmando…" : "Reservar turno"}
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
