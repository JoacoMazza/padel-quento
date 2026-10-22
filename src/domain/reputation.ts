import {
  NEGATIVE_REVIEW_POINTS,
  REPUTATION_ALERT_PCT,
  REPUTATION_MIN_REVIEWS,
  REVIEW_WINDOW_HOURS,
} from "@/src/domain/constants";
import { BookingState, ReviewLevel } from "@/src/domain/enums";

export type ReviewAnswers = { level: ReviewLevel; goodAttitude: boolean; onTime: boolean };

/** Reputación de un jugador según las reseñas de sus compañeros (HU-36), en porcentajes. */
export type ReputationSummary = {
  reviews: number;
  /** Si alcanzan las reseñas para mostrarla (REPUTATION_MIN_REVIEWS). */
  enough: boolean;
  onTimePct: number;
  goodAttitudePct: number;
  levelAsDeclaredPct: number;
  levelLowerPct: number;
  levelHigherPct: number;
};

function pct(count: number, total: number) {
  return total === 0 ? 0 : Math.round((count / total) * 100);
}

export function summarizeReputation(reviews: ReviewAnswers[]): ReputationSummary {
  const total = reviews.length;
  const count = (test: (review: ReviewAnswers) => boolean) => reviews.filter(test).length;
  return {
    reviews: total,
    enough: total >= REPUTATION_MIN_REVIEWS,
    onTimePct: pct(count((r) => r.onTime), total),
    goodAttitudePct: pct(count((r) => r.goodAttitude), total),
    levelAsDeclaredPct: pct(count((r) => r.level === ReviewLevel.AS_DECLARED), total),
    levelLowerPct: pct(count((r) => r.level === ReviewLevel.LOWER), total),
    levelHigherPct: pct(count((r) => r.level === ReviewLevel.HIGHER), total),
  };
}

/** Alertas para la ficha del admin: lo que quedó por debajo de REPUTATION_ALERT_PCT. */
export function reputationAlerts(summary: ReputationSummary): string[] {
  if (!summary.enough) return [];

  const alerts: string[] = [];
  if (summary.onTimePct < REPUTATION_ALERT_PCT) {
    alerts.push(`Puntualidad baja: ${summary.onTimePct}%`);
  }
  if (summary.goodAttitudePct < REPUTATION_ALERT_PCT) {
    alerts.push(`Actitud: solo el ${summary.goodAttitudePct}% la considera buena`);
  }
  if (summary.levelAsDeclaredPct < REPUTATION_ALERT_PCT) {
    alerts.push(
      summary.levelLowerPct >= summary.levelHigherPct
        ? `Nivel por debajo de su categoría según el ${summary.levelLowerPct}%`
        : `Nivel por encima de su categoría según el ${summary.levelHigherPct}%`,
    );
  }
  return alerts;
}

/** Motivo del movimiento de puntos que descuenta una reseña negativa. */
export const NEGATIVE_REVIEW_REASON = "Reseña negativa en partido abierto";

/**
 * Puntos a descontar por una reseña: NEGATIVE_REVIEW_POINTS por cada aspecto
 * negativo (mala actitud, llegar tarde, nivel distinto a la categoría declarada).
 */
export function negativeReviewPoints(review: ReviewAnswers): number {
  const aspects = [review.goodAttitude, review.onTime, review.level === ReviewLevel.AS_DECLARED];
  return aspects.filter((ok) => !ok).length * NEGATIVE_REVIEW_POINTS;
}

/** Se puede calificar desde que termina el partido hasta REVIEW_WINDOW_HOURS después. */
export function isWithinReviewWindow(matchEnd: Date, now: Date = new Date()): boolean {
  const time = now.getTime();
  return time >= matchEnd.getTime() && time <= matchEnd.getTime() + REVIEW_WINDOW_HOURS * 60 * 60_000;
}

export type ReviewableMatch = {
  fromDateTime: Date;
  durationMinutes: number;
  bookingState: BookingState;
  /** Jugadores del partido que asistieron. */
  attendedPlayerIds: number[];
};

/**
 * Si el jugador puede calificar a sus compañeros de este partido: no cancelado,
 * terminado hace menos de REVIEW_WINDOW_HOURS, con él y algún compañero presentes.
 */
export function canReviewMatch(match: ReviewableMatch, playerId: number, now: Date = new Date()): boolean {
  if (match.bookingState === BookingState.CANCELLED) return false;
  if (!match.attendedPlayerIds.includes(playerId) || match.attendedPlayerIds.length < 2) return false;
  const end = new Date(new Date(match.fromDateTime).getTime() + match.durationMinutes * 60_000);
  return isWithinReviewWindow(end, now);
}
