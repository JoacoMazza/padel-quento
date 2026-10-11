import { CourtTag } from "@/app/components/ui/court-tag";
import { CLUB_LOCATION } from "@/app/components/club-info";

/** Piezas del panel oscuro de resumen que comparten BookingSummary y JoinMatchPanel. */

export function SummaryHeader({ title, status }: { title: string; status?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-5">
      <span className="label-caps text-white/50">{title}</span>
      {status ? <span className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400">{status}</span> : null}
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
