import { MapPin, X } from "lucide-react";
import { CourtTag } from "@/app/components/ui/court-tag";
import type { ComplexLocation } from "@/src/domain/complex";
import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";
import { formatPrice } from "@/app/bookings/slot-utils";

/** Piezas del panel de resumen que comparten BookingSummary y JoinMatchPanel. */

/** Columna lateral estilizada como ticket/resumen de reserva; acompaña el scroll en desktop. */
export function SummaryPanel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <aside
      aria-label={label}
      className="card h-fit rounded-3xl border border-line bg-card p-5 sm:p-6 shadow-xl shadow-black/5 lg:sticky lg:top-22 text-foreground"
    >
      {children}
    </aside>
  );
}

export function SummaryHeader({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line pb-3.5">
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="label-caps font-bold text-foreground/60">{title}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar"
        className="icon-btn pointer-coarse:size-11 hover:bg-background"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

/** La cancha elegida y el complejo donde está, con link a su ubicación. */
export function SummaryCourt({ courtNumber, location }: { courtNumber: number; location?: ComplexLocation }) {
  return (
    <div className="flex items-center gap-3.5 border-b border-line py-3.5">
      <CourtTag number={courtNumber} size="md" tone="dark" />
      <div>
        <p className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
          Cancha {courtNumber}
        </p>
        {location ? (
          <a
            href={location.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="Ver ubicación en Google Maps"
            className="flex items-center gap-1 text-xs font-medium text-foreground/55 transition-colors hover:text-primary"
          >
            <MapPin className="h-3 w-3 shrink-0 text-primary" aria-hidden="true" />
            {location.name} · {location.address}, {location.city}
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function SummaryField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-background/80 p-2.5 sm:p-3 border border-line/60">
      <p className="text-[10px] font-bold tracking-[0.12em] text-foreground/45 uppercase">{label}</p>
      <p className="mt-0.5 text-xs sm:text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

/** Total de la cancha y lo que le toca pagar a cada jugador si se divide entre los cuatro. */
export function SummaryTotal({ price }: { price: number }) {
  return (
    <div className="rounded-2xl bg-background/80 p-3.5 sm:p-4 border border-line">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/55">Total a abonar</span>
        <span className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
          {formatPrice(price)}
        </span>
      </div>
      <p className="mt-1 text-right text-xs font-semibold text-foreground/50">
        {formatPrice(Math.round(price / OPEN_MATCH_MAX_PLAYERS))} por jugador
      </p>
    </div>
  );
}

export function SummaryFeedback({ feedback }: { feedback: { type: "error" | "success"; message: string } | null }) {
  if (!feedback) return null;
  return (
    <p
      role="alert"
      className={`my-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
        feedback.type === "error"
          ? "border border-danger/20 bg-danger-light text-danger"
          : "border border-success/20 bg-success-light text-success"
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
    <div className="mt-3">
      <p className="mb-2 text-xs font-semibold text-foreground/70">{question}</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((size) => (
          <button
            key={size}
            type="button"
            aria-label={`${size} jugador${size === 1 ? "" : "es"}`}
            aria-pressed={value === size}
            onClick={() => onChange(size)}
            className={`h-10 cursor-pointer rounded-xl text-xs font-bold transition-all pointer-coarse:h-11 ${
              value === size
                ? "bg-primary text-white font-bold shadow-xs ring-1 ring-primary"
                : "border border-line bg-card text-foreground/80 hover:border-foreground/30 hover:bg-background"
            }`}
          >
            {size} {size === 1 ? "jugador" : "jugadores"}
          </button>
        ))}
      </div>
    </div>
  );
}
