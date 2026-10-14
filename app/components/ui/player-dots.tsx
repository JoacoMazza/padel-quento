import { OPEN_MATCH_MAX_PLAYERS } from "@/src/domain/constants";

/** Un punto por plaza del partido: lleno si está confirmada, vacío si sigue libre. */
export function PlayerDots({
  confirmed,
  tone = "ink",
  size = "md",
}: {
  confirmed: number;
  tone?: "ink" | "primary";
  size?: "sm" | "md";
}) {
  const filled = tone === "primary" ? "bg-primary" : "bg-ink";
  const empty = tone === "primary" ? "bg-primary/25" : "bg-line";
  const dot = size === "sm" ? "h-1.5 w-1.5" : "h-3 w-3";

  return (
    <span className="flex items-center gap-1" aria-label={`${confirmed} de ${OPEN_MATCH_MAX_PLAYERS} jugadores`}>
      {Array.from({ length: OPEN_MATCH_MAX_PLAYERS }, (_, i) => (
        <span key={i} className={`rounded-full ${dot} ${i < confirmed ? filled : empty}`} />
      ))}
    </span>
  );
}

/** "Falta 1 jugador" / "Faltan 2 jugadores". */
export function missingPlayersLabel(remaining: number): string {
  return remaining === 1 ? "Falta 1 jugador" : `Faltan ${remaining} jugadores`;
}
