import { REPUTATION_ALERT_PCT } from "@/src/domain/constants";
import type { ReputationSummary } from "@/src/domain/reputation";

/**
 * Reputación de un jugador según las reseñas de sus compañeros (HU-36), en
 * porcentajes. Con pocas reseñas no se muestra, para que una sola no lo marque.
 */
export function ReputationBadge({ summary }: { summary: ReputationSummary }) {
  if (!summary.enough) {
    return <span className="text-xs text-foreground/50">Pocas reseñas todavía</span>;
  }

  const items = [
    { label: "Puntual", pct: summary.onTimePct },
    { label: "Buena actitud", pct: summary.goodAttitudePct },
    { label: "Nivel acorde", pct: summary.levelAsDeclaredPct },
  ];

  return (
    <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {items.map(({ label, pct }) => (
        <span
          key={label}
          className={pct < REPUTATION_ALERT_PCT ? "font-semibold text-danger" : "font-medium text-foreground/70"}
        >
          {label} {pct}%
        </span>
      ))}
      <span className="text-foreground/40">{summary.reviews} reseñas</span>
    </span>
  );
}
