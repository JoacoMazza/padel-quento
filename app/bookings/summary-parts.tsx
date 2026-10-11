import { X } from "lucide-react";
import { CourtTag } from "@/app/components/ui/court-tag";
import { CLUB_LOCATION } from "@/app/components/club-info";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatPrice } from "@/app/bookings/slot-utils";

/** Piezas del panel oscuro de resumen que comparten BookingSummary y JoinMatchPanel. */

/** Columna lateral oscura con el resumen del turno elegido; acompaña el scroll en desktop. */
export function SummaryPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <aside aria-label={label} className="card-dark h-fit p-6 lg:sticky lg:top-24">
      {children}
    </aside>
  );
}
export function SummaryHeader({
  title,
  status,
  onClose,
}: {
  title: string;
  status?: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-5">
      <span className="label-caps text-white/50">{title}</span>
      <div className="flex items-center gap-3">
        {status ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">{status}</span> : null}
        <button
          type="button"
          onClick={onClose}
          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-lg bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/20"
        >
          <X className="h-3.5 w-3.5" />
          Cerrar
        </button>
      </div>
    </div>
  );
}
export function SummaryCourt({ courtNumber }: { courtNumber: number }) {
  return (
    <div className="flex items-center gap-4 border-b border-white/10 py-5">
      <CourtTag number={courtNumber} size="lg" tone="light" />
      <div>
        <p className="text-2xl font-extrabold tracking-tight">Cancha {courtNumber}</p>
        <p className="text-xs text-white/50">{CLUB_LOCATION} · Quento Club</p>
      </div>
    </div>
  );
}

export function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold tracking-[0.12em] text-white/45 uppercase">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>
  );
}

/** Total de la cancha y lo que le toca pagar a cada jugador si se divide entre los cuatro. */
export function SummaryTotal({ price }: { price: number }) {
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <span className="text-sm text-white/60">Total cancha</span>
        <span className="text-4xl font-extrabold tracking-tight">{formatPrice(price)}</span>
      </div>
      <p className="mt-1 text-right text-sm text-white/60">
        {formatPrice(Math.round(price / OPEN_MATCH_MAX_PLAYERS))} por jugador ({OPEN_MATCH_MAX_PLAYERS} jugadores)
      </p>
    </div>
  );
}

export function SummaryFeedback({ feedback }: { feedback: { type: "error" | "success"; message: string } | null }) {
  if (!feedback) return null;
  return (
    <p
      role="alert"
      className={`mt-4 rounded-xl px-3.5 py-2.5 text-sm font-medium ${
        feedback.type === "error" ? "bg-primary/15 text-red-200" : "bg-success/15 text-emerald-300"
      }`}
    >
      {feedback.message}
    </p>
  );
}

/** Botones 1..n para elegir con cuántos jugadores se reserva o se suma. */
export function GroupSizePicker({
  question,
  options,
  value,
  onChange,
}: {
  question: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-white/60">{question}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((size) => (
          <button
            key={size}
            type="button"
            aria-label={`${size} jugador${size === 1 ? "" : "es"}`}
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={`h-10 cursor-pointer rounded-lg text-sm font-semibold transition-colors ${
              value === size ? "bg-white text-ink" : "bg-white/5 text-white ring-1 ring-white/10 hover:bg-white/10"
            }`}
          >
            {size}
          </button>
        ))}
      </div>
    </div>
  );
}
